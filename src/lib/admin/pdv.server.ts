import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function backendFetch(apiKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(init?.headers);
    if (apiKey.startsWith("sb_") && headers.get("Authorization") === `Bearer ${apiKey}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", apiKey);
    return fetch(input, { ...init, headers });
  };
}

function getCustomAdmin(): SupabaseClient {
  const url = process.env.CUSTOM_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key =
    process.env.CUSTOM_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Backend não configurado.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: backendFetch(key) },
  });
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export type PdvLineInput = {
  productId: string;
  quantity: number;
  optionIds?: string[];
  note?: string;
};

export type PdvOrderInput = {
  accessToken: string;
  restaurantId: string;
  cashSessionId?: string | null;
  discount: number;
  payment: { kind: string; change?: number };
  items: PdvLineInput[];
  customerName?: string;
};

/**
 * Cria a venda do PDV com recomputo de totais no servidor.
 * Nenhum preço enviado pelo cliente é aceito: tudo vem de products /
 * product_options do tenant. O papel do usuário é validado no servidor.
 */
export async function createPdvOrderRecord(input: PdvOrderInput) {
  const admin = getCustomAdmin();
  const token = input.accessToken.trim();
  if (!token) throw new Error("Sua sessão expirou.");

  const { data: authData, error: authError } = await admin.auth.getUser(token);
  const user = authData?.user;
  if (authError || !user) throw new Error("Sua sessão expirou.");

  const { data: member } = await admin
    .from("restaurant_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("restaurant_id", input.restaurantId)
    .maybeSingle();
  const role = (member as { role?: string } | null)?.role;
  if (role !== "admin" && role !== "caixa") {
    throw new Error("Você não tem permissão para operar o caixa.");
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new Error("Adicione ao menos um item.");
  }

  const productIds = Array.from(new Set(input.items.map((l) => l.productId)));
  const optionIds = Array.from(new Set(input.items.flatMap((l) => l.optionIds ?? [])));

  const [prodRes, optRes] = await Promise.all([
    admin
      .from("products")
      .select("id,name,price,active,image_url")
      .eq("restaurant_id", input.restaurantId)
      .in("id", productIds),
    optionIds.length
      ? admin
          .from("product_options")
          .select("id,name,price_delta,group_id")
          .eq("restaurant_id", input.restaurantId)
          .in("id", optionIds)
      : Promise.resolve({ data: [], error: null } as const),
  ]);
  if (prodRes.error) throw prodRes.error;
  if (optRes.error) throw optRes.error;

  const products = (prodRes.data ?? []) as Array<{
    id: string;
    name: string;
    price: number;
    active: boolean;
    image_url: string | null;
  }>;
  const options = (optRes.data ?? []) as Array<{
    id: string;
    name: string;
    price_delta: number;
    group_id: string;
  }>;

  let subtotal = 0;
  const items = input.items.map((line) => {
    const p = products.find((x) => x.id === line.productId);
    if (!p) throw new Error("Item inválido na venda.");
    if (p.active === false) throw new Error(`Item indisponível: ${p.name}`);
    const qty = Number(line.quantity);
    if (!Number.isInteger(qty) || qty <= 0 || qty > 99) throw new Error("Quantidade inválida.");

    const customizations = (line.optionIds ?? []).map((oid) => {
      const o = options.find((x) => x.id === oid);
      if (!o) throw new Error("Personalização inválida.");
      return {
        groupId: o.group_id,
        groupName: "",
        optionId: o.id,
        optionName: o.name,
        priceDelta: Number(o.price_delta ?? 0),
      };
    });

    const unit = round2(
      Number(p.price ?? 0) + customizations.reduce((s, c) => s + c.priceDelta, 0),
    );
    subtotal += unit * qty;

    return {
      id: crypto.randomUUID(),
      productId: p.id,
      name: p.name,
      image: p.image_url ?? undefined,
      basePrice: Number(p.price ?? 0),
      unitPrice: unit,
      quantity: qty,
      note: line.note?.trim() || undefined,
      customizations,
    };
  });

  subtotal = round2(subtotal);
  const discount = round2(Math.min(Math.max(0, Number(input.discount) || 0), subtotal));
  const total = round2(subtotal - discount);

  let cashSessionId: string | null = null;
  if (input.cashSessionId) {
    const { data: sess } = await admin
      .from("cash_sessions")
      .select("id,status,restaurant_id")
      .eq("id", input.cashSessionId)
      .maybeSingle();
    const s = sess as { id: string; status: string; restaurant_id: string } | null;
    if (!s || s.restaurant_id !== input.restaurantId || s.status !== "open") {
      throw new Error("Caixa não está aberto.");
    }
    cashSessionId = s.id;
  }

  const shortId = "PDV" + Math.floor(100000 + Math.random() * 900000);
  const { data: order, error } = await admin
    .from("orders")
    .insert({
      short_id: shortId,
      device_id: `pdv-${user.id.slice(0, 8)}`,
      restaurant_id: input.restaurantId,
      items,
      subtotal,
      delivery_fee: 0,
      discount,
      total,
      pickup: true,
      payment: input.payment,
      eta_minutes: 10,
      status: "received",
      payment_confirmed_at: new Date().toISOString(),
      cash_session_id: cashSessionId,
      address: null,
    })
    .select()
    .single();
  if (error) throw error;

  return { id: (order as { id: string }).id, shortId, subtotal, discount, total };
}
