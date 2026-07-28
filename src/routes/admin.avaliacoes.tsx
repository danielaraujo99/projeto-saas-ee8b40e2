import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin/admin-shell";
import { Star, MessageSquare } from "lucide-react";
import { useAdminSession } from "@/lib/admin/session";
import { supabase } from "@/lib/custom-supabase";
import { requireAdminRole } from "@/lib/admin/role-guard";

export const Route = createFileRoute("/admin/avaliacoes")({
  head: () => ({ meta: [{ title: "Avaliações — MenuAltas" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: () => requireAdminRole(["admin"]),
  component: AvaliacoesPage,
});

type Review = { id: string; rating: number; comment: string | null; created_at: string };

const PAGE_SIZE = 20;

async function loadReviews(
  restaurantId: string,
  limit: number,
): Promise<{ rows: Review[]; reachedEnd: boolean }> {
  const { data, error } = await supabase
    .from("orders")
    .select("id,rating_food,rating_comment,updated_at")
    .eq("restaurant_id", restaurantId)
    .eq("rated", true)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) return { rows: [], reachedEnd: true };
  const raw = (data ?? []) as Array<{ id: string; rating_food: number | null; rating_comment: string | null; updated_at: string }>;
  return {
    rows: raw.map((r) => ({
      id: r.id,
      rating: r.rating_food ?? 0,
      comment: r.rating_comment,
      created_at: r.updated_at,
    })),
    reachedEnd: raw.length < limit,
  };
}

function AvaliacoesPage() {
  const { data: session } = useAdminSession();
  const [limit, setLimit] = React.useState(PAGE_SIZE);
  const { data, isFetching } = useQuery({
    queryKey: ["admin-reviews", session?.restaurantId, limit],
    queryFn: () => loadReviews(session!.restaurantId, limit),
    enabled: !!session?.restaurantId,
  });
  const rows = data?.rows ?? [];
  const canLoadMore = data ? !data.reachedEnd : false;
  const avg = rows.length ? (rows.reduce((a, r) => a + r.rating, 0) / rows.length).toFixed(1) : "—";

  return (
    <AdminShell title="Avaliações">
      <div className="px-4 py-6 sm:px-8">
        <h2 className="text-2xl font-bold text-slate-900">Avaliações</h2>
        <p className="text-sm text-slate-500">Acompanhe o que os clientes acham do seu restaurante.</p>

        <div className="mt-5 grid gap-4 lg:grid-cols-[280px_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
            <div className="text-5xl font-bold text-slate-900">{avg}</div>
            <div className="mt-1 flex justify-center gap-0.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  className={`h-5 w-5 ${
                    avg !== "—" && i <= Math.round(Number(avg))
                      ? "fill-amber-400 text-amber-400"
                      : "text-slate-300"
                  }`}
                />
              ))}
            </div>
            <div className="mt-1 text-xs text-slate-500">{data.length} avaliações</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            {data.length === 0 ? (
              <div className="grid place-items-center py-16 text-center">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-blue-600">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <div className="mt-3 text-sm font-semibold text-slate-800">Sem avaliações ainda</div>
                <p className="mt-1 max-w-sm text-xs text-slate-500">
                  As avaliações dos clientes aparecerão aqui.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.map((r) => (
                  <li key={r.id} className="py-3">
                    <div className="flex items-center gap-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-3.5 w-3.5 ${
                            i < r.rating ? "fill-amber-400 text-amber-400" : "text-slate-300"
                          }`}
                        />
                      ))}
                      <span className="ml-auto text-xs text-slate-500">
                        {new Date(r.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    {r.comment && (
                      <p className="mt-1.5 text-sm text-slate-700">{r.comment}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
