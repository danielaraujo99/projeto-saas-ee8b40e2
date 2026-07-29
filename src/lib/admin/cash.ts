import { supabase } from "@/lib/custom-supabase";

/* eslint-disable @typescript-eslint/no-explicit-any */
const sb = supabase as any;

export type CashSession = {
  id: string;
  restaurant_id: string;
  opened_by: string;
  opened_at: string;
  opening_amount: number;
  closed_by: string | null;
  closed_at: string | null;
  closing_amount: number | null;
  expected_amount: number | null;
  status: "open" | "closed";
  notes: string | null;
};

export type CashMovement = {
  id: string;
  session_id: string;
  restaurant_id: string;
  kind: "sangria" | "suprimento";
  amount: number;
  reason: string | null;
  created_at: string;
};

function num(v: unknown): number {
  return Number(v ?? 0);
}

export async function getOpenSession(restaurantId: string): Promise<CashSession | null> {
  const { data, error } = await sb
    .from("cash_sessions")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("status", "open")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    opening_amount: num(data.opening_amount),
    closing_amount: data.closing_amount == null ? null : num(data.closing_amount),
    expected_amount: data.expected_amount == null ? null : num(data.expected_amount),
  } as CashSession;
}

export async function openCashSession(input: {
  restaurantId: string;
  userId: string;
  openingAmount: number;
}): Promise<CashSession> {
  const existing = await getOpenSession(input.restaurantId);
  if (existing) throw new Error("Já existe um caixa aberto para este restaurante.");
  const { data, error } = await sb
    .from("cash_sessions")
    .insert({
      restaurant_id: input.restaurantId,
      opened_by: input.userId,
      opening_amount: input.openingAmount,
      status: "open",
    })
    .select()
    .single();
  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      throw new Error("Já existe um caixa aberto para este restaurante.");
    }
    throw error;
  }
  return data as CashSession;
}

export async function listMovements(sessionId: string): Promise<CashMovement[]> {
  const { data, error } = await sb
    .from("cash_movements")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as any[]).map((m) => ({ ...m, amount: num(m.amount) })) as CashMovement[];
}

export async function addMovement(input: {
  sessionId: string;
  restaurantId: string;
  userId: string;
  kind: "sangria" | "suprimento";
  amount: number;
  reason?: string;
}) {
  if (!(input.amount > 0)) throw new Error("Informe um valor maior que zero.");
  const { error } = await sb.from("cash_movements").insert({
    session_id: input.sessionId,
    restaurant_id: input.restaurantId,
    created_by: input.userId,
    kind: input.kind,
    amount: input.amount,
    reason: input.reason?.trim() || null,
  });
  if (error) throw error;
}

export type SessionSummary = {
  opening: number;
  sales: number;
  cashSales: number;
  supplies: number;
  withdrawals: number;
  expected: number;
  ordersCount: number;
};

/**
 * Resumo do turno. O valor esperado em gaveta considera abertura +
 * vendas em dinheiro + suprimentos − sangrias.
 */
export async function getSessionSummary(session: CashSession): Promise<SessionSummary> {
  const [ordersRes, movs] = await Promise.all([
    sb.from("orders").select("total,payment").eq("cash_session_id", session.id),
    listMovements(session.id),
  ]);
  if (ordersRes.error) throw ordersRes.error;
  const orders = (ordersRes.data ?? []) as Array<{ total: unknown; payment: unknown }>;

  let sales = 0;
  let cashSales = 0;
  for (const o of orders) {
    const v = num(o.total);
    sales += v;
    const kind = (o.payment as { kind?: string } | null)?.kind;
    if (kind === "cash") cashSales += v;
  }
  const supplies = movs.filter((m) => m.kind === "suprimento").reduce((s, m) => s + m.amount, 0);
  const withdrawals = movs.filter((m) => m.kind === "sangria").reduce((s, m) => s + m.amount, 0);

  const expected = session.opening_amount + cashSales + supplies - withdrawals;
  return {
    opening: session.opening_amount,
    sales: Math.round(sales * 100) / 100,
    cashSales: Math.round(cashSales * 100) / 100,
    supplies,
    withdrawals,
    expected: Math.round(expected * 100) / 100,
    ordersCount: orders.length,
  };
}

export async function closeCashSession(input: {
  session: CashSession;
  userId: string;
  closingAmount: number;
  notes?: string;
}): Promise<{ expected: number; difference: number }> {
  const summary = await getSessionSummary(input.session);
  const { error } = await sb
    .from("cash_sessions")
    .update({
      status: "closed",
      closed_by: input.userId,
      closed_at: new Date().toISOString(),
      closing_amount: input.closingAmount,
      expected_amount: summary.expected,
      notes: input.notes?.trim() || null,
    })
    .eq("id", input.session.id)
    .eq("status", "open");
  if (error) throw error;
  return {
    expected: summary.expected,
    difference: Math.round((input.closingAmount - summary.expected) * 100) / 100,
  };
}
