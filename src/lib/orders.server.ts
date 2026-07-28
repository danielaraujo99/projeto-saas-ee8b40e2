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
import { products } from "@/data/menu";
import { coupons } from "@/data/coupons";
import { restaurant } from "@/data/restaurant";

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

export function recomputeOrderTotals(input: RecomputeInput): RecomputeResult {
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new Error("Pedido sem itens.");
  }

  let subtotal = 0;
  for (const line of input.items) {
    const p = products.find((x) => x.id === line.productId);
    if (!p) throw new Error("Item inválido no pedido.");
    if (p.available === false) throw new Error(`Item indisponível: ${p.name}`);

    const qty = Number(line.quantity ?? 0);
    if (!Number.isInteger(qty) || qty <= 0 || qty > 99) {
      throw new Error("Quantidade inválida.");
    }

    // Recalcula custom deltas contra o menu (não confia no cliente).
    let unit = p.price;
    const cust = Array.isArray(line.customizations) ? line.customizations : [];
    for (const c of cust) {
      const group = (p.customizations ?? []).find((g) => g.id === c.groupId);
      const opt = group?.options.find((o) => o.id === c.optionId);
      if (!opt) throw new Error("Personalização inválida.");
      unit += opt.priceDelta ?? 0;
    }
    subtotal += unit * qty;
  }
  subtotal = round2(subtotal);

  // Frete
  const deliveryFee = input.pickup ? 0 : round2(restaurant.deliveryFee);

  // Cupom
  let discount = 0;
  if (input.couponCode) {
    const c = coupons.find(
      (x) => x.code.toLowerCase() === input.couponCode!.trim().toLowerCase(),
    );
    if (!c) throw new Error("Cupom inválido.");
    if (c.minOrder && subtotal < c.minOrder) {
      throw new Error(`Cupom exige pedido mínimo de R$ ${c.minOrder.toFixed(2)}.`);
    }
    discount = c.kind === "percent" ? (subtotal * c.value) / 100 : c.value;
  }
  discount = round2(Math.min(discount, subtotal));

  const total = round2(Math.max(0, subtotal - discount) + deliveryFee);

  // Compara com o que o cliente enviou.
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
