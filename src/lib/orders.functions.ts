import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Admin client helper (executado sempre dentro dos handlers).
// ---------------------------------------------------------------------------
async function getAdmin() {
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

// ---------------------------------------------------------------------------
// Criação de pedido com chave de idempotência.
// ---------------------------------------------------------------------------
export const createOrderRecord = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        deviceId: z.string().min(1).max(160),
        restaurantId: z.string().uuid().optional(),
        restaurantSlug: z.string().min(1).max(120).optional(),
        items: z.array(z.unknown()).min(1),
        subtotal: z.number().nonnegative(),
        deliveryFee: z.number().nonnegative(),
        discount: z.number().nonnegative(),
        total: z.number().nonnegative(),
        couponCode: z.string().optional(),
        address: z.unknown().optional(),
        pickup: z.boolean(),
        payment: z.unknown(),
        etaMinutes: z.number().int().positive().max(240),
        idempotencyKey: z.string().min(8).max(120).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const admin = await getAdmin();

    // Idempotência: se já existe pedido para este device+chave, retorna-o.
    if (data.idempotencyKey) {
      const { data: existing } = await admin
        .from("orders")
        .select("*")
        .eq("device_id", data.deviceId)
        .eq("idempotency_key", data.idempotencyKey)
        .maybeSingle();
      if (existing) return existing;
    }

    let restaurantId = data.restaurantId ?? null;
    if (restaurantId) {
      const { data: restaurant } = await admin
        .from("restaurants")
        .select("id")
        .eq("id", restaurantId)
        .maybeSingle();
      restaurantId = restaurant?.id ?? null;
    }
    if (!restaurantId && data.restaurantSlug) {
      const { data: restaurant, error } = await admin
        .from("restaurants")
        .select("id")
        .eq("slug", data.restaurantSlug)
        .maybeSingle();
      if (error) throw error;
      restaurantId = restaurant?.id ?? null;
    }
    if (!restaurantId) throw new Error("Restaurante não encontrado para criar o pedido.");

    const shortId = "PED" + Math.floor(100000 + Math.random() * 900000);
    const insertPayload: Record<string, unknown> = {
      short_id: shortId,
      device_id: data.deviceId,
      restaurant_id: restaurantId,
      items: data.items,
      subtotal: data.subtotal,
      delivery_fee: data.deliveryFee,
      discount: data.discount,
      total: data.total,
      coupon_code: data.couponCode ?? null,
      address: data.address ?? null,
      pickup: data.pickup,
      payment: data.payment,
      eta_minutes: data.etaMinutes,
      status: "pending_payment",
    };
    if (data.idempotencyKey) insertPayload.idempotency_key = data.idempotencyKey;

    const { data: order, error } = await admin
      .from("orders")
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      // Corrida entre dois cliques simultâneos: se conflitou por unique de
      // idempotência, devolve o pedido já criado.
      if (data.idempotencyKey && /idempotency|duplicate|unique/i.test(error.message)) {
        const { data: existing } = await admin
          .from("orders")
          .select("*")
          .eq("device_id", data.deviceId)
          .eq("idempotency_key", data.idempotencyKey)
          .maybeSingle();
        if (existing) return existing;
      }
      throw error;
    }
    if (!order) throw new Error("Falha ao criar pedido.");
    return order;
  });

// ---------------------------------------------------------------------------
// Confirmação de pagamento — nunca aceita apenas "id" como confiança.
//   * Requer deviceId igual ao do pedido (escopo do dispositivo).
//   * Se o pedido é Pix, valida junto ao Mercado Pago:
//       - status === "approved"
//       - external_reference === orderId
//     usando o pixPaymentId enviado pelo cliente (armazenado localmente ao
//     criar a cobrança) OU o já persistido em orders.pix_payment_id.
//   * Para cartão/dinheiro (fluxo manual/simulado), exige apenas escopo por
//     dispositivo.
// ---------------------------------------------------------------------------
export const confirmOrderPayment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        deviceId: z.string().min(1).max(160),
        pixPaymentId: z.number().int().positive().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const admin = await getAdmin();

    const { data: order, error: readErr } = await admin
      .from("orders")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (readErr) throw readErr;
    if (!order) throw new Error("Pedido não encontrado.");
    if ((order as Record<string, unknown>).device_id !== data.deviceId) {
      throw new Error("Pedido pertence a outro dispositivo.");
    }
    if (order.status !== "pending_payment") {
      // Já confirmado antes; devolve o estado atual sem alterar.
      return order;
    }

    const paymentKind =
      (order.payment as { kind?: string } | null)?.kind ?? "unknown";

    if (paymentKind === "pix") {
      const rec = order as Record<string, unknown>;
      const storedPixId =
        typeof rec.pix_payment_id === "number"
          ? (rec.pix_payment_id as number)
          : rec.pix_payment_id
            ? Number(rec.pix_payment_id)
            : null;
      const pixPaymentId = data.pixPaymentId ?? storedPixId;
      if (!pixPaymentId) {
        throw new Error("Pagamento Pix não pôde ser validado (id ausente).");
      }
      const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
      if (!token) throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado.");
      const res = await fetch(`https://api.mercadopago.com/v1/payments/${pixPaymentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Falha ao consultar Mercado Pago (${res.status}).`);
      const mp = (await res.json()) as {
        status?: string;
        external_reference?: string | null;
      };
      if (mp.status !== "approved") {
        throw new Error(`Pagamento não aprovado no Mercado Pago (status: ${mp.status ?? "?"}).`);
      }
      if ((mp.external_reference ?? "") !== data.id) {
        throw new Error("Pagamento não corresponde a este pedido.");
      }
    }

    const now = new Date().toISOString();
    const { data: updated, error } = await admin
      .from("orders")
      .update({ status: "received", payment_confirmed_at: now })
      .eq("id", data.id)
      .eq("device_id", data.deviceId)
      .select()
      .single();
    if (error) throw error;
    if (!updated) throw new Error("Falha ao confirmar pagamento.");
    return updated;
  });

// ---------------------------------------------------------------------------
// Leitura de um pedido específico com escopo por dispositivo.
// Executa no servidor com service role, mas só devolve linhas cujo device_id
// bata com o do chamador. Isso fecha a brecha de vazamento por UUID.
// ---------------------------------------------------------------------------
export const fetchOrderByIdScoped = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        deviceId: z.string().min(1).max(160),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const admin = await getAdmin();
    const { data: order, error } = await admin
      .from("orders")
      .select("*")
      .eq("id", data.id)
      .eq("device_id", data.deviceId)
      .maybeSingle();
    if (error) throw error;
    return order ?? null;
  });
