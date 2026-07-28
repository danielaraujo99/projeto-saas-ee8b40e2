import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin/admin-shell";
import { Input } from "@/components/ui/input";
import { Search, Users } from "lucide-react";
import { useAdminSession } from "@/lib/admin/session";
import { supabase } from "@/lib/custom-supabase";
import { requireAdminRole } from "@/lib/admin/role-guard";

export const Route = createFileRoute("/admin/clientes")({
  head: () => ({ meta: [{ title: "Clientes — MenuAltas" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: () => requireAdminRole(["admin"]),
  component: ClientesPage,
});

type Customer = { device_id: string; orders: number; spent: number; last: string };

const PAGE_SIZE = 200;

async function loadCustomers(
  restaurantId: string,
  limit: number,
): Promise<{ rows: Customer[]; scanned: number; reachedEnd: boolean }> {
  const { data, error } = await supabase
    .from("orders")
    .select("device_id,total,created_at,status")
    .eq("restaurant_id", restaurantId)
    .neq("status", "pending_payment")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return { rows: [], scanned: 0, reachedEnd: true };
  const rows = (data ?? []) as Array<{ device_id: string; total: number; created_at: string }>;
  const map = new Map<string, Customer>();
  for (const r of rows) {
    const cur = map.get(r.device_id) ?? { device_id: r.device_id, orders: 0, spent: 0, last: r.created_at };
    cur.orders += 1;
    cur.spent += Number(r.total || 0);
    if (new Date(r.created_at) > new Date(cur.last)) cur.last = r.created_at;
    map.set(r.device_id, cur);
  }
  return {
    rows: Array.from(map.values()).sort((a, b) => b.spent - a.spent),
    scanned: rows.length,
    reachedEnd: rows.length < limit,
  };
}

function ClientesPage() {
  const [q, setQ] = React.useState("");
  const [limit, setLimit] = React.useState(PAGE_SIZE);
  const { data: session } = useAdminSession();
  const { data, isFetching } = useQuery({
    queryKey: ["admin-customers", session?.restaurantId, limit],
    queryFn: () => loadCustomers(session!.restaurantId, limit),
    enabled: !!session?.restaurantId,
  });
  const customers = data?.rows ?? [];
  const list = customers.filter((c) => c.device_id.toLowerCase().includes(q.toLowerCase()));
  const canLoadMore = data ? !data.reachedEnd : false;

  return (
    <AdminShell title="Clientes">
      <div className="px-4 py-6 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Clientes</h2>
            <p className="text-sm text-slate-500">Base de contatos e histórico de consumo.</p>
          </div>
          <div className="relative max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
        </div>

        {list.length === 0 ? (
          <div className="mt-6 grid place-items-center rounded-2xl border border-dashed border-slate-200 bg-white p-16 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-blue-600">
              <Users className="h-6 w-6" />
            </div>
            <div className="mt-3 text-sm font-semibold text-slate-800">Nenhum cliente ainda</div>
            <p className="mt-1 max-w-sm text-xs text-slate-500">
              Assim que houver pedidos, os clientes aparecerão aqui.
            </p>
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Cliente (device)</th>
                  <th className="px-4 py-3">Pedidos</th>
                  <th className="px-4 py-3">Total gasto</th>
                  <th className="px-4 py-3">Último pedido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((c) => (
                  <tr key={c.device_id}>
                    <td className="px-4 py-3 font-medium text-slate-800">{c.device_id}</td>
                    <td className="px-4 py-3">{c.orders}</td>
                    <td className="px-4 py-3">
                      {c.spent.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(c.last).toLocaleDateString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
