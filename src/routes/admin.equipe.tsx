import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useAdminSession } from "@/lib/admin/session";
import { supabase } from "@/lib/custom-supabase";
import { requireAdminRole } from "@/lib/admin/role-guard";

export const Route = createFileRoute("/admin/equipe")({
  head: () => ({ meta: [{ title: "Equipe — MenuAltas" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: () => requireAdminRole(["admin"]),
  component: EquipePage,
});

type Member = { user_id: string; role: string; name: string | null; email: string | null };

async function loadMembers(restaurantId: string): Promise<Member[]> {
  const { data, error } = await supabase
    .from("restaurant_members")
    .select("user_id, role, profiles!inner(name,email)")
    .eq("restaurant_id", restaurantId);
  if (error) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    user_id: r.user_id,
    role: r.role,
    name: r.profiles?.name ?? null,
    email: r.profiles?.email ?? null,
  }));
}

function EquipePage() {
  const { data: session } = useAdminSession();
  const { data = [] } = useQuery({
    queryKey: ["admin-team", session?.restaurantId],
    queryFn: () => loadMembers(session!.restaurantId),
    enabled: !!session?.restaurantId,
  });

  return (
    <AdminShell title="Equipe e Permissões">
      <div className="px-4 py-6 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Equipe e Permissões</h2>
            <p className="text-sm text-slate-500">Membros que acessam o painel.</p>
          </div>
          <Button onClick={() => toast.info("Convite por e-mail em breve.")}>
            <UserPlus className="h-4 w-4" /> Convidar membro
          </Button>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">Papel</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-12 text-center text-sm text-slate-400">
                    Nenhum membro cadastrado.
                  </td>
                </tr>
              )}
              {data.map((m) => (
                <tr key={m.user_id}>
                  <td className="px-4 py-3 font-medium text-slate-800">{m.name ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{m.email ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {m.role}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
