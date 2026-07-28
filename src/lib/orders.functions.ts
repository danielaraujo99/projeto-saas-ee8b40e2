import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getAdmin, recomputeOrderTotals, safeErrorMessage } from "./orders.server";
import { assertRateLimit } from "./rate-limit.server";

// ---------------------------------------------------------------------------
// Criação de pedido com chave de idempotência + recomputo server-side.
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
    try {
      // Freio anti-enumeração: 20 pedidos por IP por minuto é folgado para
      // um comprador legítimo e inviabiliza scripts.
      assertRateLimit("create_order", { max: 20, windowMs: 60_000 });
      // 1) Recomputa e valida totais no servidor — rejeita divergência.
      recomputeOrderTotals({
        items: data.items as Parameters<typeof recomputeOrderTotals>[0]["items"],
        pickup: data.pickup,
        couponCode: data.couponCode ?? null,
        clientSubtotal: data.subtotal,
        clientDeliveryFee: data.deliveryFee,
        clientDiscount: data.discount,
        clientTotal: data.total,
      });

      const admin = await getAdmin();

      // 2) Idempotência: se já existe pedido para este device+chave, devolve-o.
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
      if (!restaurantId) throw new Error("Restaurante não encontrado.");

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
    } catch (err) {
      console.error("[createOrderRecord]", err);
      throw new Error(safeErrorMessage(err, "Não foi possível criar o pedido."));
    }
  });

// ---------------------------------------------------------------------------
// Confirmação de pagamento — nunca aceita apenas "id" como confiança.
//   * Requer deviceId igual ao do pedido (escopo do dispositivo).
//   * Se o pedido é Pix, valida junto ao Mercado Pago:
//       - status === "approved"
//       - external_reference === orderId
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
    try {
      // Confirmação é polled a cada ~1.5s pelo cliente; 60/min por IP cobre
      // isso com folga e barra brute-force de (id + deviceId).
      assertRateLimit("confirm_order", { max: 60, windowMs: 60_000 });
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
          throw new Error("Pagamento Pix não pôde ser validado.");
        }
        const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
        if (!token) throw new Error("Gateway de pagamento indisponível.");
        const res = await fetch(`https://api.mercadopago.com/v1/payments/${pixPaymentId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Falha ao consultar o gateway.");
        const mp = (await res.json()) as {
          status?: string;
          external_reference?: string | null;
        };
        if (mp.status !== "approved") {
          throw new Error("Pagamento ainda não aprovado.");
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
    } catch (err) {
      console.error("[confirmOrderPayment]", err);
      throw new Error(safeErrorMessage(err, "Não foi possível confirmar o pagamento."));
    }
  });

// ---------------------------------------------------------------------------
// Leitura de um pedido específico com escopo por dispositivo.
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
    try {
      const admin = await getAdmin();
      const { data: order, error } = await admin
        .from("orders")
        .select("*")
        .eq("id", data.id)
        .eq("device_id", data.deviceId)
        .maybeSingle();
      if (error) throw error;
      return order ?? null;
    } catch (err) {
      console.error("[fetchOrderByIdScoped]", err);
      throw new Error(safeErrorMessage(err, "Não foi possível carregar o pedido."));
    }
  });
