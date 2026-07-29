import { supabase } from "@/lib/custom-supabase";

/* eslint-disable @typescript-eslint/no-explicit-any */
const sb = supabase as any;

export type StockItem = {
  id: string;
  restaurant_id: string;
  name: string;
  unit: string;
  qty: number;
  min_qty: number;
  cost: number;
};

export type StockMovement = {
  id: string;
  restaurant_id: string;
  item_id: string;
  kind: "in" | "out" | "adjust";
  qty: number;
  cost: number;
  note: string | null;
  created_at: string;
};

/**
 * A tabela real usa `quantity` / `min_quantity`. A UI usa `qty` / `min_qty`.
 * O mapeamento fica isolado aqui — o schema do banco é a fonte de verdade.
 */
function fromDbItem(i: any): StockItem {
  return {
    id: i.id,
    restaurant_id: i.restaurant_id,
    name: i.name,
    unit: i.unit ?? "un",
    qty: Number(i.quantity ?? 0),
    min_qty: Number(i.min_quantity ?? 0),
    cost: Number(i.cost ?? 0),
  };
}

function toDbItem(p: Partial<StockItem> & Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  if (p.restaurant_id !== undefined) out.restaurant_id = p.restaurant_id;
  if (p.name !== undefined) out.name = p.name;
  if (p.unit !== undefined) out.unit = p.unit;
  if (p.qty !== undefined) out.quantity = p.qty;
  if (p.min_qty !== undefined) out.min_quantity = p.min_qty;
  if (p.cost !== undefined) out.cost = p.cost;
  return out;
}

export async function listStockItems(restaurantId: string): Promise<StockItem[]> {
  const { data, error } = await sb
    .from("stock_items")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("name", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as any[]).map(fromDbItem);
}

export async function createStockItem(input: {
  restaurant_id: string;
  name: string;
  unit: string;
  qty: number;
  min_qty: number;
  cost: number;
}) {
  const { error } = await sb.from("stock_items").insert(toDbItem(input));
  if (error) throw error;
}

export async function updateStockItem(id: string, patch: Partial<StockItem>) {
  const { error } = await sb.from("stock_items").update(toDbItem(patch)).eq("id", id);
  if (error) throw error;
}

export async function deleteStockItem(id: string) {
  const { error } = await sb.from("stock_items").delete().eq("id", id);
  if (error) throw error;
}


export async function listMovements(
  restaurantId: string,
  limit = 50,
): Promise<StockMovement[]> {
  const { data, error } = await sb
    .from("stock_movements")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as any[]).map((m) => ({
    ...m,
    qty: Number(m.qty),
    cost: Number(m.cost),
  })) as StockMovement[];
}

/** Registra movimento e atualiza quantidade do item. */
export async function registerMovement(input: {
  restaurant_id: string;
  item_id: string;
  kind: "in" | "out" | "adjust";
  qty: number;
  cost?: number;
  note?: string | null;
}) {
  const { data: item, error: e1 } = await sb
    .from("stock_items")
    .select("qty")
    .eq("id", input.item_id)
    .maybeSingle();
  if (e1) throw e1;
  const current = Number(item?.qty ?? 0);
  const delta =
    input.kind === "in" ? input.qty : input.kind === "out" ? -input.qty : input.qty - current;
  const newQty =
    input.kind === "adjust" ? input.qty : Math.max(0, current + delta);

  const { error: e2 } = await sb.from("stock_movements").insert({
    restaurant_id: input.restaurant_id,
    item_id: input.item_id,
    kind: input.kind,
    qty: Math.abs(delta),
    cost: input.cost ?? 0,
    note: input.note ?? null,
  });
  if (e2) throw e2;
  const { error: e3 } = await sb
    .from("stock_items")
    .update({ qty: newQty })
    .eq("id", input.item_id);
  if (e3) throw e3;
}
