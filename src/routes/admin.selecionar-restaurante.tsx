import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/lib/custom-supabase";
import { setActiveTenant } from "@/lib/admin/tenant.functions";
import { Button } from "@/components/ui/button";
import { Loader2, Store, LogOut, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/selecionar-restaurante")({
  head: () => ({
    meta: [
      { title: "Escolher restaurante — MenuAltas" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SelectorPage,
});

type Row = { restaurant_id: string; role: string; restaurants: { id: string; name: string; slug: string } | null };

async function loadMemberships() {
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  if (!user) return { user: null, memberships: [] as Row[] };
  const { data } = await supabase
    .from("restaurant_members")
    .select("restaurant_id, role, restaurants!inner(id, name, slug)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  return { user, memberships: (data ?? []) as unknown as Row[] };
}

function SelectorPage() {
  const nav = useNavigate();
  const setActive = useServerFn(setActiveTenant);
  const [choosingId, setChoosingId] = React.useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-memberships"],
    queryFn: loadMemberships,
    staleTime: 30_000,
  });

  React.useEffect(() => {
    if (!data) return;
    if (!data.user) {
      nav({ to: "/admin/login", replace: true });
      return;
    }
    if (data.memberships.length === 0) {
      nav({ to: "/admin/cadastro", replace: true });
      return;
    }
  }, [data, nav]);

  async function choose(restaurantId: string) {
    setChoosingId(restaurantId);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        toast.error("Sessão expirada. Entre novamente.");
        nav({ to: "/admin/login", replace: true });
        return;
      }
      await setActive({ data: { accessToken: token, restaurantId } });
      // Força novo JWT com o claim atualizado + atualiza user.app_metadata em memória.
      await supabase.auth.refreshSession();
      const target = data?.memberships.find((m) => m.restaurant_id === restaurantId);
      const role = target?.role;
      if (role === "cozinha") nav({ to: "/admin/cozinha", replace: true });
      else if (role === "caixa") nav({ to: "/admin/pedidos", replace: true });
      else nav({ to: "/admin", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível selecionar.");
    } finally {
      setChoosingId(null);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    nav({ to: "/admin/login", replace: true });
  }

  if (isLoading || !data) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-white">
            <Store className="h-4 w-4" />
          </div>
          <span className="text-base font-bold text-slate-900">MenuAltas</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900">Qual restaurante você quer acessar?</h1>
        <p className="mt-1 text-sm text-slate-500">
          Você é membro de mais de um restaurante. Escolha em qual deseja entrar agora — você pode
          trocar depois pelo menu da conta.
        </p>

        <ul className="mt-6 space-y-2">
          {data.memberships.map((m) => {
            const rest = m.restaurants;
            if (!rest) return null;
            const isBusy = choosingId === m.restaurant_id;
            return (
              <li key={m.restaurant_id}>
                <button
                  type="button"
                  disabled={choosingId !== null}
                  onClick={() => choose(m.restaurant_id)}
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-primary/40 hover:bg-primary/[0.02] disabled:opacity-60"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Store className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">
                      {rest.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      Papel: <span className="font-medium text-slate-700">{roleLabel(m.role)}</span>
                    </span>
                  </span>
                  {isBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-6 flex justify-center">
          <Button variant="ghost" size="sm" onClick={signOut} className="text-slate-500">
            <LogOut className="h-4 w-4" />
            Sair da conta
          </Button>
        </div>
      </div>
    </div>
  );
}

function roleLabel(r: string) {
  if (r === "admin") return "Administrador";
  if (r === "caixa") return "Caixa";
  if (r === "cozinha") return "Cozinha";
  return r;
}
