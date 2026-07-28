import { supabase } from "@/lib/custom-supabase";
import { getDeviceId } from "@/lib/device-id";
import {
  createOrderRecord,
  confirmOrderPayment,
  fetchOrderByIdScoped,
} from "@/lib/orders.functions";
import { computeStatus, type OrderStatus } from "@/lib/order-status";
import type { Address, CartItem, PaymentMethod } from "@/types";


export type OrderRow = {
  id: string;
  short_id: string;
  device_id: string;
  restaurant_id: string;
  items: CartItem[];
  subtotal: number;
  delivery_fee: number;
  discount: number;
  total: number;
  coupon_code: string | null;
  address: Address | null;
  pickup: boolean;
  payment: PaymentMethod;
  eta_minutes: number;
  status: OrderStatus;
  payment_confirmed_at: string | null;
  rated: boolean;
  rating_food: number | null;
  rating_delivery: number | null;
  rating_comment: string | null;
  created_at: string;
  updated_at: string;
};

/** Parse a DB row (jsonb columns arrive typed as unknown) into our OrderRow shape. */
function parseRow(row: Record<string, unknown>): OrderRow {
  return {
    ...row,
    items: (row.items ?? []) as CartItem[],
    address: (row.address ?? null) as Address | null,
    payment: row.payment as PaymentMethod,
    subtotal: Number(row.subtotal),
    delivery_fee: Number(row.delivery_fee),
    discount: Number(row.discount),
    total: Number(row.total),
  } as OrderRow;
}

/** Compute the current status from elapsed time and persist it if it changed. */
async function reconcileStatus(row: OrderRow): Promise<OrderRow> {
  if (!row.payment_confirmed_at) return row;
  if (row.status === "delivered") return row;
  const expected = computeStatus(row.payment_confirmed_at);
  if (expected === row.status) return row;
  await supabase.from("orders").update({ status: expected }).eq("id", row.id);
  return { ...row, status: expected };
}

export type CreateOrderInput = {
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  couponCode?: string;
  address?: Address;
  pickup: boolean;
  payment: PaymentMethod;
  etaMinutes: number;
  restaurantId: string;
  restaurantSlug?: string;
  idempotencyKey?: string;
};

export async function createOrder(input: CreateOrderInput): Promise<OrderRow> {
  const deviceId = getDeviceId();
  const data = await createOrderRecord({
    data: {
      deviceId,
      restaurantId: input.restaurantId,
      restaurantSlug: input.restaurantSlug,
      items: input.items,
      subtotal: input.subtotal,
      deliveryFee: input.deliveryFee,
      discount: input.discount,
      total: input.total,
      couponCode: input.couponCode,
      address: input.address,
      pickup: input.pickup,
      payment: input.payment,
      etaMinutes: input.etaMinutes,
      idempotencyKey: input.idempotencyKey,
    },
  });
  return parseRow(data as Record<string, unknown>);
}

export async function confirmPayment(id: string, pixPaymentId?: number): Promise<OrderRow> {
  const deviceId = getDeviceId();
  const data = await confirmOrderPayment({ data: { id, deviceId, pixPaymentId } });
  return parseRow(data as Record<string, unknown>);
}

export async function getOrderById(id: string): Promise<OrderRow | null> {
  const deviceId = getDeviceId();
  const data = await fetchOrderByIdScoped({ data: { id, deviceId } });
  if (!data) return null;
  return reconcileStatus(parseRow(data as Record<string, unknown>));
}


export async function listMyOrders(): Promise<OrderRow[]> {
  const deviceId = getDeviceId();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("device_id", deviceId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const parsed = (data ?? []).map((r) => parseRow(r as Record<string, unknown>));
  return Promise.all(parsed.map(reconcileStatus));
}

export async function rateOrder(
  id: string,
  ratings: { food: number; delivery: number; comment?: string },
): Promise<void> {
  const { error } = await supabase
    .from("orders")
    .update({
      rated: true,
      rating_food: ratings.food,
      rating_delivery: ratings.delivery,
      rating_comment: ratings.comment ?? null,
    })
    .eq("id", id);
  if (error) throw error;
}
