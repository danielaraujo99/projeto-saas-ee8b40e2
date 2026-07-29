import { supabase } from "@/lib/custom-supabase";

/* eslint-disable @typescript-eslint/no-explicit-any */
const sb = supabase as any;

export type CouponRow = {
  id: string;
  restaurant_id: string;
  code: string;
  kind: "percent" | "fixed";
  value: number;
  min_order: number;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  active: boolean;
  description: string | null;
  created_at: string;
};

/**
 * Colunas reais: amount, min_order_value, usage_limit, valid_to.
 * A UI usa value/min_order/max_uses/expires_at — mapeamento isolado aqui.
 */
function fromDb(c: any): CouponRow {
  return {
    id: c.id,
    restaurant_id: c.restaurant_id,
    code: c.code,
    kind: (c.kind ?? "percent") as CouponRow["kind"],
    value: Number(c.amount ?? 0),
    min_order: Number(c.min_order_value ?? 0),
    max_uses: c.usage_limit ?? null,
    used_count: Number(c.used_count ?? 0),
    expires_at: c.valid_to ?? null,
    active: !!c.active,
    description: c.description ?? null,
    created_at: c.created_at,
  };
}

function toDb(p: Partial<CouponRow>) {
  const out: Record<string, unknown> = {};
  if (p.restaurant_id !== undefined) out.restaurant_id = p.restaurant_id;
  if (p.code !== undefined) out.code = p.code.toUpperCase();
  if (p.kind !== undefined) out.kind = p.kind;
  if (p.value !== undefined) out.amount = p.value;
  if (p.min_order !== undefined) out.min_order_value = p.min_order;
  if (p.max_uses !== undefined) out.usage_limit = p.max_uses;
  if (p.expires_at !== undefined) out.valid_to = p.expires_at;
  if (p.description !== undefined) out.description = p.description;
  if (p.active !== undefined) out.active = p.active;
  return out;
}

export async function listCoupons(restaurantId: string): Promise<CouponRow[]> {
  const { data, error } = await sb
    .from("coupons")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as any[]).map(fromDb);
}

export async function createCoupon(input: {
  restaurant_id: string;
  code: string;
  kind: "percent" | "fixed";
  value: number;
  min_order?: number;
  max_uses?: number | null;
  expires_at?: string | null;
  description?: string | null;
  active?: boolean;
}) {
  const { error } = await sb.from("coupons").insert(toDb(input as Partial<CouponRow>));
  if (error) throw error;
}

export async function updateCoupon(id: string, patch: Partial<CouponRow>) {
  const { error } = await sb.from("coupons").update(toDb(patch)).eq("id", id);
  if (error) throw error;
}


export async function deleteCoupon(id: string) {
  const { error } = await sb.from("coupons").delete().eq("id", id);
  if (error) throw error;
}
