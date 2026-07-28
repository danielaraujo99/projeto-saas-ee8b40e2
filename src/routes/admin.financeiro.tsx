import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin/admin-shell";
import { SmoothArea } from "@/components/admin/charts";
import { useAdminSession } from "@/lib/admin/session";
import { getDashboardStats } from "@/lib/admin/dashboard";
import { DollarSign, ShoppingBag, Receipt } from "lucide-react";
import { requireAdminRole } from "@/lib/admin/role-guard";

export const Route = createFileRoute("/admin/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — MenuAltas" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: () => requireAdminRole(["admin"]),
  component: FinanceiroPage,
});

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function FinanceiroPage() {
  const { data: session } = useAdminSession();
  const { data: s } = useQuery({
    queryKey: ["admin-dashboard", session?.restaurantId],
    queryFn: () => getDashboardStats(session!.restaurantId),
    enabled: !!session?.restaurantId,
  });

  return (
    <AdminShell title="Financeiro">
      <div className="px-4 py-6 sm:px-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Financeiro</h2>
          <p className="text-sm text-slate-500">Visão geral do faturamento (últimos 7 dias).</p>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <Kpi label="Faturamento" value={s ? brl(s.revenue) : "—"} icon={<DollarSign className="h-5 w-5" />} tint="bg-emerald-50 text-emerald-600" />
          <Kpi label="Pedidos" value={s ? String(s.orders) : "—"} icon={<ShoppingBag className="h-5 w-5" />} tint="bg-blue-50 text-blue-600" />
          <Kpi label="Ticket médio" value={s ? brl(s.ticket) : "—"} icon={<Receipt className="h-5 w-5" />} tint="bg-violet-50 text-violet-600" />
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-slate-900">Faturamento diário</div>
          <div className="mt-4">
            {s && s.revenue7d.some((r) => r.value > 0) ? (
              <SmoothArea
                data={s.revenue7d.map((r) => ({ x: r.date, y: r.value }))}
                color="#2563eb"
                height={260}
                yFormatter={(v) => brl(v)}
              />
            ) : (
              <div className="grid h-[260px] place-items-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-400">
                Sem dados no período.
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-slate-900">Formas de pagamento</div>
          {s && s.paymentMethods.length > 0 ? (
            <ul className="mt-3 space-y-2.5">
              {s.paymentMethods.map((p) => (
                <li key={p.name} className="flex items-center gap-3 text-sm">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  <span className="flex-1 text-slate-800">{p.name}</span>
                  <span className="w-10 text-right text-slate-600">{p.pct}%</span>
                  <span className="w-28 text-right font-medium text-slate-900">{brl(p.value)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-3 grid h-24 place-items-center rounded-lg border border-dashed border-slate-200 text-xs text-slate-400">
              Nenhum pagamento registrado.
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}

function Kpi({
  label,
  value,
  icon,
  tint,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tint: string;
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
