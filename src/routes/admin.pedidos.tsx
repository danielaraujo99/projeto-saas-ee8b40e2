import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin/admin-shell";
import { OrderKanban } from "@/components/admin/order-kanban";
import { OrderList } from "@/components/admin/order-list";
import { OrderDetailsSheet } from "@/components/admin/order-details-sheet";
import { NewOrderForm } from "@/components/admin/new-order-form";
import { listRestaurantOrders } from "@/lib/admin/admin-orders";
import { useAdminSession } from "@/lib/admin/session";
import { supabase } from "@/lib/custom-supabase";
import type { OrderRow } from "@/lib/orders-api";
import { Loader2, Plus, Calendar, LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { requireAdminRole } from "@/lib/admin/role-guard";

export const Route = createFileRoute("/admin/pedidos")({
  head: () => ({
    meta: [
      { title: "Pedidos — Painel" },
      { name: "description", content: "Kanban e lista de pedidos em tempo real." },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: () => requireAdminRole(["admin", "caixa"]),
  component: OrdersPage,
});

type ViewMode = "kanban" | "list";

function OrdersPage() {
  const { data: session } = useAdminSession();
  const restaurantId = session?.restaurantId;
  const qc = useQueryClient();
  const [selected, setSelected] = React.useState<OrderRow | null>(null);
  const [openNew, setOpenNew] = React.useState(false);
  const [period, setPeriod] = React.useState("today");
  const [mode, setMode] = React.useState<ViewMode>("kanban");

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["admin", "orders", restaurantId],
    queryFn: () => listRestaurantOrders(restaurantId!),
    enabled: !!restaurantId,
  });

  React.useEffect(() => {
    if (!restaurantId) return;
    const channel = supabase
      .channel(`admin-orders-${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["admin", "orders", restaurantId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId, qc]);

  const filtered = data ?? [];
  const showInlineSpinner = !data && isFetching;

  return (
    <AdminShell title="Pedidos">
      <div className="px-4 py-6 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
              Pedidos
              {showInlineSpinner && (
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              )}
            </h2>
            <p className="text-sm text-slate-500">Kanban e lista em tempo real.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm shadow-sm">
              <button
                onClick={() => setMode("kanban")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition",
                  mode === "kanban"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:text-slate-900",
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Kanban
              </button>
              <button
                onClick={() => setMode("list")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition",
                  mode === "list"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:text-slate-900",
                )}
              >
                <List className="h-3.5 w-3.5" /> Lista
              </button>
            </div>
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="h-9 rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700"
              >
                <option value="today">Hoje</option>
                <option value="week">Últimos 7 dias</option>
                <option value="month">Este mês</option>
              </select>
            </div>
            <Button onClick={() => setOpenNew(true)}>
              <Plus className="h-4 w-4" /> Novo pedido
            </Button>
          </div>
        </div>

        <div className="mt-5">
          {mode === "kanban" ? (
            <OrderKanban
              orders={filtered}
              onOrderClick={setSelected}
              onChanged={() => refetch()}
            />
          ) : (
            <OrderList
              orders={filtered}
              onOrderClick={setSelected}
              onChanged={() => refetch()}
            />
          )}
        </div>
      </div>

      <OrderDetailsSheet
        order={selected}
        onClose={() => setSelected(null)}
        onChanged={() => refetch()}
      />

      <Sheet open={openNew} onOpenChange={setOpenNew}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>Novo pedido manual</SheetTitle>
            <SheetDescription>
              Adicione itens, cliente, entrega e pagamento. O pedido entra em "Pedido feito".
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            <NewOrderForm
              onDone={() => {
                setOpenNew(false);
                refetch();
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </AdminShell>
  );
}
