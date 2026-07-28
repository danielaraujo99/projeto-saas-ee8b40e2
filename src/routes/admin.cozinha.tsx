import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin/admin-shell";
import { KdsCard } from "@/components/admin/kds-card";
import { useAdminSession } from "@/lib/admin/session";
import { listRestaurantOrders } from "@/lib/admin/admin-orders";
import { supabase } from "@/lib/custom-supabase";
import { ChefHat, Loader2, Clock, Flame, CheckCircle2 } from "lucide-react";
import { requireAdminRole } from "@/lib/admin/role-guard";

export const Route = createFileRoute("/admin/cozinha")({
  head: () => ({
    meta: [
      { title: "Cozinha — Painel" },
      { name: "description", content: "Tela dedicada ao preparo de pedidos." },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: () => requireAdminRole(["admin", "cozinha"]),
  component: KdsPage,
});

function KdsPage() {
  const { data: session } = useAdminSession();
  const qc = useQueryClient();
  const restaurantId = session?.restaurantId;
  const [tab, setTab] = React.useState<"todos" | "novos" | "preparo">("todos");
  const [now, setNow] = React.useState(Date.now());

  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["kds", restaurantId],
    queryFn: () => listRestaurantOrders(restaurantId!),
    enabled: !!restaurantId,
    refetchInterval: 20_000,
  });

  React.useEffect(() => {
    if (!restaurantId) return;
    const c = supabase
      .channel(`kds-${restaurantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurantId}` },
        () => qc.invalidateQueries({ queryKey: ["kds", restaurantId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(c);
    };
  }, [restaurantId, qc]);

  const orders = (data ?? []).filter(
    (o) =>
      (o.status as string) === "received" ||
      (o.status as string) === "confirmed" ||
      (o.status as string) === "preparing",
  );

  const filtered = orders.filter((o) => {
    const s = o.status as string;
    if (tab === "novos") return s === "received" || s === "confirmed";
    if (tab === "preparo") return s === "preparing";
    return true;
  });

  const stats = React.useMemo(() => {
    const novos = orders.filter((o) => {
      const s = o.status as string;
      return s === "received" || s === "confirmed";
    }).length;
    const preparando = orders.filter((o) => (o.status as string) === "preparing").length;
    const atrasados = orders.filter(
      (o) => (now - new Date(o.created_at).getTime()) / 60000 >= 25,
    ).length;
    return { novos, preparando, atrasados };
  }, [orders, now]);

  const initialLoading = !data && isFetching;

  return (
    <AdminShell title="Cozinha (KDS)" minimal>
      <div className="min-h-[calc(100vh-56px)] bg-slate-950">
        <div className="border-b border-slate-800 bg-slate-900/50 px-4 py-4 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-amber-500/10 text-amber-400">
                <ChefHat className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Fila da cozinha</h2>
                <p className="text-xs text-slate-400">
                  Atualizado em tempo real · {new Date(now).toLocaleTimeString("pt-BR")}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatChip icon={<Clock className="h-3.5 w-3.5" />} label="Novos" value={stats.novos} tone="blue" />
              <StatChip icon={<Flame className="h-3.5 w-3.5" />} label="Em preparo" value={stats.preparando} tone="amber" />
              <StatChip
                icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                label="Atrasados"
                value={stats.atrasados}
                tone={stats.atrasados > 0 ? "rose" : "slate"}
              />
            </div>
          </div>

          <div className="mt-4 inline-flex rounded-lg border border-slate-800 bg-slate-950 p-0.5">
            {(
              [
                { id: "todos", label: `Todos (${orders.length})` },
                { id: "novos", label: `Novos (${stats.novos})` },
                { id: "preparo", label: `Em preparo (${stats.preparando})` },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  tab === t.id
                    ? "bg-amber-400 text-slate-900"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 sm:p-8">
          {initialLoading ? (
            <div className="grid place-items-center py-24 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="mx-auto grid max-w-md place-items-center gap-3 py-24 text-center text-slate-400">
              <ChefHat className="h-12 w-12 text-slate-700" />
              <h2 className="text-xl font-bold text-slate-200">Sem pedidos para preparar</h2>
              <p className="text-sm">Quando novos pedidos chegarem, aparecem aqui automaticamente.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filtered.map((o) => (
                <KdsCard key={o.id} order={o} onDone={() => refetch()} />
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}

function StatChip({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "blue" | "amber" | "rose" | "slate";
}) {
  const toneCls = {
    blue: "border-blue-500/30 bg-blue-500/10 text-blue-300",
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    rose: "border-rose-500/40 bg-rose-500/10 text-rose-300",
    slate: "border-slate-700 bg-slate-800/60 text-slate-300",
  }[tone];
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${toneCls}`}
    >
      {icon}
      <span>{label}</span>
      <span className="rounded-full bg-black/30 px-1.5 tabular-nums">{value}</span>
    </div>
  );
}
