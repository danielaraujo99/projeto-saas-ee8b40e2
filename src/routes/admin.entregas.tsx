import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin/admin-shell";
import { useAdminSession } from "@/lib/admin/session";
import { supabase } from "@/lib/custom-supabase";
import type { OrderRow } from "@/lib/orders-api";
import { OrderDetailsSheet } from "@/components/admin/order-details-sheet";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Eye, Trash2, Loader2 } from "lucide-react";
import { brl } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { requireAdminRole } from "@/lib/admin/role-guard";

export const Route = createFileRoute("/admin/entregas")({
  head: () => ({
    meta: [
      { title: "Entregas — Painel" },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: () => requireAdminRole(["admin", "caixa"]),
  component: EntregasPage,
});

type StatusFilter = "all" | "delivering" | "delivered";
type PeriodFilter = "today" | "7d" | "30d" | "all";

function parseRow(row: Record<string, unknown>): OrderRow {
  return {
    ...row,
    items: (row.items ?? []) as OrderRow["items"],
    address: (row.address ?? null) as OrderRow["address"],
    payment: row.payment as OrderRow["payment"],
    subtotal: Number(row.subtotal),
    delivery_fee: Number(row.delivery_fee),
    discount: Number(row.discount),
    total: Number(row.total),
  } as OrderRow;
}

async function listDeliveries(
  restaurantId: string,
  status: StatusFilter,
  period: PeriodFilter,
): Promise<OrderRow[]> {
  let q = supabase
    .from("orders")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("pickup", false)
    .order("created_at", { ascending: false })
    .limit(300);
  if (status === "all") q = q.in("status", ["delivering", "delivered"]);
  else q = q.eq("status", status);
  if (period !== "all") {
    const days = period === "today" ? 1 : period === "7d" ? 7 : 30;
    const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
    q = q.gte("created_at", since);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => parseRow(r as Record<string, unknown>));
}

function fmtElapsed(fromIso: string) {
  const m = Math.max(0, Math.floor((Date.now() - new Date(fromIso).getTime()) / 60000));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}min`;
}

function EntregasPage() {
  const { data: session } = useAdminSession();
  const rid = session?.restaurantId;
  const qc = useQueryClient();
  const [status, setStatus] = React.useState<StatusFilter>("all");
  const [period, setPeriod] = React.useState<PeriodFilter>("today");
  const [selected, setSelected] = React.useState<OrderRow | null>(null);
  const [confirmDel, setConfirmDel] = React.useState<OrderRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["deliveries", rid, status, period],
    queryFn: () => listDeliveries(rid!, status, period),
    enabled: !!rid,
    refetchInterval: 15_000,
  });

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["deliveries", rid] });
  }

  async function doDelete() {
    if (!confirmDel) return;
    const { error } = await supabase.from("orders").delete().eq("id", confirmDel.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Pedido removido");
      setConfirmDel(null);
      await refresh();
    }
  }

  return (
    <AdminShell title="Entregas">
      <div className="px-4 py-6 sm:px-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Entregas</h2>
            <p className="text-sm text-slate-500">
              Pedidos em rota e já entregues. Fonte: pedidos do restaurante.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="delivering">Saiu para entrega</SelectItem>
                <SelectItem value="delivered">Entregue</SelectItem>
              </SelectContent>
            </Select>
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodFilter)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="7d">7 dias</SelectItem>
                <SelectItem value="30d">30 dias</SelectItem>
                <SelectItem value="all">Tudo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {!data || data.length === 0 ? (
            <div className="grid h-40 place-items-center text-sm text-slate-500">
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              ) : (
                "Nenhuma entrega no período."
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Pedido</th>
                  <th className="px-4 py-2.5">Cliente</th>
                  <th className="px-4 py-2.5">Endereço</th>
                  <th className="px-4 py-2.5">Saída</th>
                  <th className="px-4 py-2.5">Tempo</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Total</th>
                  <th className="px-4 py-2.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((o) => {
                  const ref = o.payment_confirmed_at ?? o.created_at;
                  const addr = o.address
                    ? `${o.address.street}, ${o.address.number}${o.address.neighborhood ? " · " + o.address.neighborhood : ""}`
                    : "—";
                  const customer = o.address?.label ?? "Cliente";
                  return (
                    <tr key={o.id}>
                      <td className="px-4 py-3 font-mono text-slate-700">#{o.short_id}</td>
                      <td className="px-4 py-3 text-slate-700">{customer}</td>
                      <td className="px-4 py-3 max-w-[240px] truncate text-slate-600">{addr}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {new Date(ref).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{fmtElapsed(ref)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                            o.status === "delivering"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-emerald-50 text-emerald-700",
                          )}
                        >
                          {o.status === "delivering" ? "Saiu para entrega" : "Entregue"}
                        </span>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-700">{brl(o.total)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setSelected(o)}
                            aria-label="Ver detalhes"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setConfirmDel(o)}
                            aria-label="Excluir"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <OrderDetailsSheet
        order={selected}
        onClose={() => setSelected(null)}
        onChanged={refresh}
      />

      <AlertDialog open={!!confirmDel} onOpenChange={(v) => !v && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              O pedido #{confirmDel?.short_id} será excluído do banco. Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}
