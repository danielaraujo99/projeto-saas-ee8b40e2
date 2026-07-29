/**
 * Helpers server-only para pedidos.
 *
 * Fica separado de `orders.functions.ts` porque o Vite plugin do TanStack
 * remove os handlers do bundle do cliente, mas mantém tudo o mais no arquivo
 * `.functions.ts`. Se colocarmos helpers como siblings do createServerFn,
 * o transformer pode dropá-los e o handler quebra em runtime com
 * ReferenceError. Ficando aqui e sendo importados, o transformer preserva.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** Cliente admin (service role). Somente para uso em server functions. */
export async function getAdmin(): Promise<SupabaseClient> {
  const customUrl = process.env.CUSTOM_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey =
    process.env.CUSTOM_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!customUrl || !serviceKey) throw new Error("Backend custom não configurado.");
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(customUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (serviceKey.startsWith("sb_") && headers.get("Authorization") === `Bearer ${serviceKey}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", serviceKey);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

/**
 * Recomputa o total do pedido no servidor a partir do cardápio e dos cupons.
 * Retorna o objeto validado. Lança se houver divergência maior que 1 centavo
 * ou item inexistente/indisponível.
 */
export type RecomputeInput = {
  restaurantId: string;
  items: Array<{
    productId?: string;
    basePrice?: number;
    quantity?: number;
    customizations?: Array<{ optionId?: string; groupId?: string; priceDelta?: number }>;
  }>;
  pickup: boolean;
  couponCode?: string | null;
  clientSubtotal: number;
  clientDeliveryFee: number;
  clientDiscount: number;
  clientTotal: number;
};

export type RecomputeResult = {
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
};

const EPS = 0.011;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function recomputeOrderTotals(
  admin: SupabaseClient,
  input: RecomputeInput,
): Promise<RecomputeResult> {
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new Error("Pedido sem itens.");
  }
  if (!input.restaurantId) throw new Error("Restaurante inválido.");

  const productIds = Array.from(
    new Set(input.items.map((l) => l.productId).filter(Boolean) as string[]),
  );
  if (productIds.length === 0) throw new Error("Itens inválidos no pedido.");

  const [prodsRes, optsRes, restRes] = await Promise.all([
    admin
      .from("products")
      .select("id,price,active,name,restaurant_id")
      .in("id", productIds)
      .eq("restaurant_id", input.restaurantId),
    admin
      .from("product_options")
      .select("id,price_delta,restaurant_id")
      .eq("restaurant_id", input.restaurantId),
    admin
      .from("restaurants")
      .select("settings")
      .eq("id", input.restaurantId)
      .maybeSingle(),
  ]);
  if (prodsRes.error) throw prodsRes.error;
  if (optsRes.error) throw optsRes.error;
  if (restRes.error) throw restRes.error;

  const products = (prodsRes.data ?? []) as Array<{
    id: string;
    price: number;
    active: boolean;
    name: string;
  }>;
  const options = (optsRes.data ?? []) as Array<{ id: string; price_delta: number }>;
  const settings = ((restRes.data?.settings ?? {}) as Record<string, unknown>) || {};

  let subtotal = 0;
  for (const line of input.items) {
    const p = products.find((x) => x.id === line.productId);
    if (!p) throw new Error("Item inválido no pedido.");
    if (p.active === false) throw new Error(`Item indisponível: ${p.name}`);
    const qty = Number(line.quantity ?? 0);
    if (!Number.isInteger(qty) || qty <= 0 || qty > 99) {
      throw new Error("Quantidade inválida.");
    }
    let unit = Number(p.price ?? 0);
    const cust = Array.isArray(line.customizations) ? line.customizations : [];
    for (const c of cust) {
      const opt = options.find((o) => o.id === c.optionId);
      if (!opt) throw new Error("Personalização inválida.");
      unit += Number(opt.price_delta ?? 0);
    }
    subtotal += unit * qty;
  }
  subtotal = round2(subtotal);

  const settingsFee = Number((settings as { delivery_fee?: number }).delivery_fee ?? 0);
  const deliveryFee = input.pickup ? 0 : round2(settingsFee);

  let discount = 0;
  const rawCode = (input.couponCode ?? "").trim();
  if (rawCode) {
    const { data: cRow, error: cErr } = await admin
      .from("coupons")
      .select("code,kind,amount,min_order_value,usage_limit,used_count,valid_from,valid_to,active")
      .eq("restaurant_id", input.restaurantId)
      .ilike("code", rawCode)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!cRow || !cRow.active) throw new Error("Cupom inválido.");
    const now = Date.now();
    if (cRow.valid_from && new Date(cRow.valid_from).getTime() > now) {
      throw new Error("Cupom ainda não está válido.");
    }
    if (cRow.valid_to && new Date(cRow.valid_to).getTime() < now) {
      throw new Error("Cupom expirado.");
    }
    if (cRow.usage_limit != null && Number(cRow.used_count ?? 0) >= Number(cRow.usage_limit)) {
      throw new Error("Cupom esgotado.");
    }
    const minOrder = Number(cRow.min_order_value ?? 0);
    if (minOrder > 0 && subtotal < minOrder) {
      throw new Error(`Cupom exige pedido mínimo de R$ ${minOrder.toFixed(2)}.`);
    }
    const amount = Number(cRow.amount ?? 0);
    discount = cRow.kind === "percent" ? (subtotal * amount) / 100 : amount;
  }
  discount = round2(Math.min(discount, subtotal));

  const total = round2(Math.max(0, subtotal - discount) + deliveryFee);

  if (Math.abs(subtotal - Number(input.clientSubtotal)) > EPS) {
    throw new Error("Valor de itens divergente. Recarregue o carrinho.");
  }
  if (Math.abs(deliveryFee - Number(input.clientDeliveryFee)) > EPS) {
    throw new Error("Taxa de entrega divergente. Recarregue o carrinho.");
  }
  if (Math.abs(discount - Number(input.clientDiscount)) > EPS) {
    throw new Error("Desconto divergente. Recarregue o carrinho.");
  }
  if (Math.abs(total - Number(input.clientTotal)) > EPS) {
    throw new Error("Total divergente. Recarregue o carrinho.");
  }

  return { subtotal, deliveryFee, discount, total };
}

/** Mensagem segura para o cliente. Sem stack traces / detalhes internos. */
export function safeErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    // Só passa mensagens curtas em português (nossas). Nunca mensagens de rede.
    const msg = err.message;
    if (msg && msg.length < 160 && !/https?:\/\//i.test(msg) && !/\bat\s/i.test(msg)) {
      return msg;
    }
  }
  return fallback;
}
