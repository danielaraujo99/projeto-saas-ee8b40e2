import { redirect } from "@tanstack/react-router";
import { supabase } from "@/lib/custom-supabase";
import type { AdminRole } from "./session";

/**
 * Guarda de rota para o painel administrativo.
 *
 * Roda no `beforeLoad` de cada rota administrativa, ANTES de qualquer
 * componente montar ou `useQuery` disparar. Se o usuário não estiver logado
 * ou não tiver o papel permitido para a rota, redireciona antes que qualquer
 * dado seja carregado — bloqueia acesso por URL direta, não apenas esconde
 * o item do menu.
 *
 * Observação: durante SSR não há sessão (localStorage é do browser). Nesse
 * caso apenas deixamos passar; o gate real acontece no client, antes das
 * queries serem habilitadas.
 */
export async function requireAdminRole(allowed: AdminRole[]) {
  if (typeof window === "undefined") return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw redirect({ to: "/admin/login" });
  }

  const { data: member } = await supabase
    .from("restaurant_members")
    .select("role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role = (member as any)?.role as AdminRole | undefined;

  if (!role) {
    throw redirect({ to: "/admin/login" });
  }

  if (!allowed.includes(role)) {
    // Manda o usuário para a área que ele PODE acessar.
    if (role === "cozinha") throw redirect({ to: "/admin/cozinha" });
    // caixa e admin caem no Pedidos como landing seguro.
    throw redirect({ to: "/admin/pedidos" });
  }
}
