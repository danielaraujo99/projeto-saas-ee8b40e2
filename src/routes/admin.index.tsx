import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin/admin-shell";
import { SmoothArea } from "@/components/admin/charts";
import { useAdminSession } from "@/lib/admin/session";
import { getDashboardStats } from "@/lib/admin/dashboard";
import {
import { requireAdminRole } from "@/lib/admin/role-guard";
  Calendar,
  DollarSign,
  ShoppingBag,
  Receipt,
  Clock,
  TrendingUp,
} from "lucide-react";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Dashboard — MenuAltas" },
      { name: "description", content: "Visão geral do seu restaurante." },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: () => requireAdminRole(["admin"]),
  component: DashboardPage,
});

const HEATMAP_ROWS = ["00h", "06h", "12h", "18h", "23h"];
const HEATMAP_COLS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function DashboardPage() {
  const { data: session } = useAdminSession();
  const restaurantId = session?.restaurantId;

  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-dashboard", restaurantId],
    queryFn: () => getDashboardStats(restaurantId!),
    enabled: !!restaurantId,
    staleTime: 30_000,
  });

  const s = stats;
  const empty = !isLoading && (!s || s.orders === 0);

  return (
    <AdminShell title="Dashboard">
      <div className="px-4 py-6 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>
            <p className="mt-1 text-sm text-slate-500">Visão geral do seu restaurante</p>
          </div>
          <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm">
            <Calendar className="h-4 w-4 text-slate-500" />
            Últimos 7 dias
          </button>
        </div>

        {/* Metric cards */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Faturamento"
            value={s ? brl(s.revenue) : "—"}
            tint="bg-emerald-50 text-emerald-600"
            icon={<DollarSign className="h-5 w-5" />}
          />
          <MetricCard
            label="Pedidos"
            value={s ? String(s.orders) : "—"}
            tint="bg-blue-50 text-blue-600"
            icon={<ShoppingBag className="h-5 w-5" />}
          />
          <MetricCard
            label="Ticket médio"
            value={s ? brl(s.ticket) : "—"}
            tint="bg-violet-50 text-violet-600"
            icon={<Receipt className="h-5 w-5" />}
          />
          <MetricCard
            label="Tempo médio preparo"
            value={s ? `${s.prepTimeMin} min` : "—"}
            tint="bg-amber-50 text-amber-600"
            icon={<Clock className="h-5 w-5" />}
          />
        </div>

        {/* Revenue + Heatmap */}
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">Faturamento no período</div>
                <div className="mt-1 text-2xl font-bold text-slate-900">
                  {s ? brl(s.revenue) : "—"}
                </div>
              </div>
              <span className="text-xs font-medium text-slate-500">Últimos 7 dias</span>
            </div>
            <div className="mt-4">
              {empty || !s || s.revenue7d.every((r) => r.value === 0) ? (
                <EmptyChart />
              ) : (
                <SmoothArea
                  data={s.revenue7d.map((r) => ({ x: r.date, y: r.value }))}
                  color="#2563eb"
                  height={240}
                  yFormatter={(v) => brl(v)}
                />
              )}
            </div>
          </div>

          <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">Horário de pico</div>
              <span className="text-xs text-slate-500">Últimos 7 dias</span>
            </div>
            <div className="mt-4 grid flex-1 grid-cols-[36px_1fr] gap-1.5">
              <div className="flex flex-col justify-between py-0.5 text-[10px] text-slate-500">
                {HEATMAP_ROWS.map((r) => (
                  <span key={r}>{r}</span>
                ))}
              </div>
              <div className="flex flex-col">
                <div
                  className="grid flex-1 grid-cols-7 gap-1.5"
                  style={{
                    gridTemplateRows: `repeat(${s?.heatmap.length ?? 5}, minmax(20px, 1fr))`,
                  }}
                >
                  {(s?.heatmap ?? []).map((row, ri) =>
                    row.map((v, ci) => (
                      <div
                        key={`${ri}-${ci}`}
                        className="rounded-md"
                        style={{ background: `rgba(37, 99, 235, ${0.08 + v * 0.75})` }}
                        title={`${HEATMAP_COLS[ci]} — ${(v * 100).toFixed(0)}%`}
                      />
                    )),
                  )}
                </div>
                <div className="mt-2 grid grid-cols-7 text-center text-[10px] text-slate-500">
                  {HEATMAP_COLS.map((c) => (
                    <span key={c}>{c}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom row */}
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold text-slate-900">Produtos mais vendidos</div>
            {s && s.topProducts.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {s.topProducts.map((p, i) => (
                  <li key={p.name} className="flex items-center gap-3 rounded-lg p-1.5 hover:bg-slate-50">
                    <span className="w-4 text-center text-xs font-semibold text-slate-500">{i + 1}</span>
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-blue-600">
                      <TrendingUp className="h-4 w-4" />
                    </span>
                    <span className="flex-1 truncate text-sm font-medium text-slate-800">{p.name}</span>
                    <span className="text-xs text-slate-500">{p.sales} vendas</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyRow>Nenhum produto vendido ainda.</EmptyRow>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold text-slate-900">Formas de pagamento</div>
            {s && s.paymentMethods.length > 0 ? (
              <ul className="mt-3 space-y-2.5">
                {s.paymentMethods.map((p) => (
                  <li key={p.name} className="flex items-center gap-3 text-sm">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    <span className="flex-1 text-slate-800">{p.name}</span>
                    <span className="w-10 text-right text-slate-600">{p.pct}%</span>
                    <span className="w-24 text-right font-medium text-slate-900">{brl(p.value)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyRow>Nenhum pagamento registrado ainda.</EmptyRow>
            )}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

function MetricCard({
  label,
  value,
  tint,
  icon,
}: {
  label: string;
  value: string;
  tint: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-slate-500">{label}</div>
          <div className="mt-1.5 text-2xl font-bold text-slate-900">{value}</div>
        </div>
        <div className={`grid h-10 w-10 place-items-center rounded-xl ${tint}`}>{icon}</div>
      </div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="grid h-[240px] place-items-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-400">
      Sem dados no período.
    </div>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 grid h-32 place-items-center rounded-lg border border-dashed border-slate-200 text-xs text-slate-400">
      {children}
    </div>
  );
}
