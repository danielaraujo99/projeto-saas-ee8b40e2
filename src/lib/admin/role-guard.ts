import { redirect } from "@tanstack/react-router";
import { supabase } from "@/lib/custom-supabase";
import type { AdminRole } from "./session";

const ADMIN_GUARD_TIMEOUT_MS = 12_000;

async function withGuardTimeout<T>(promise: PromiseLike<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} demorou para responder.`)),
          ADMIN_GUARD_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Guarda de rota para o painel administrativo.
 *
 * Roda em `beforeLoad` — no cliente (as rotas admin são client-only) — ANTES
 * de qualquer componente montar ou `useQuery` disparar.
 *
 * A verdade sobre tenant/papel ativo vem do `app_metadata` do usuário
 * (`active_restaurant_id`/`active_role`), que só é gravado via server function
 * (tenant.functions.ts) após validação server-side de que o usuário é
 * membro daquele restaurante com aquele papel. O JWT hook `custom_access_token_hook`
 * também injeta esses valores como claim no token para uso em RLS.
 *
 * Nunca lê "primeira associação" silenciosamente:
 *  - Se o usuário é membro de exatamente 1 restaurante e ainda não tem claim
 *    ativo, o hook do banco injeta automaticamente e este guard também aceita.
 *  - Se é membro de vários e ainda não escolheu, redireciona para
 *    /admin/selecionar-restaurante.
 *  - Se não é membro de nenhum, redireciona para /admin/cadastro.
 */
export async function requireAdminRole(allowed: AdminRole[]) {
  if (typeof window === "undefined") return;

  const {
    data: { user },
    error: userError,
  } = await withGuardTimeout(supabase.auth.getUser(), "Autenticação").catch(() => ({
    data: { user: null },
    error: new Error("Sessão indisponível."),
  }));
  if (userError) {
    throw redirect({ to: "/admin/login", search: {} });
  }
  if (!user) {
    throw redirect({ to: "/admin/login", search: {} });
  }

  const { data: memberRows, error: memberError } = await withGuardTimeout(
    supabase
      .from("restaurant_members")
      .select("role, restaurant_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    "Permissões do painel",
  ).catch(() => ({ data: null, error: new Error("Permissões indisponíveis.") }));
  if (memberError) {
    throw redirect({ to: "/admin/login", search: {} });
  }

  const memberships = (memberRows ?? []) as Array<{ role: string; restaurant_id: string }>;

  if (memberships.length === 0) {
    throw redirect({ to: "/admin/cadastro" });
  }

  const meta = (user.app_metadata ?? {}) as Record<string, unknown>;
  const activeRestaurantId =
    typeof meta.active_restaurant_id === "string" ? meta.active_restaurant_id : null;

  // Tenant ativo tem que ser um dos que o usuário É membro. Se o app_metadata
  // aponta pra um restaurante que ele NÃO é mais membro (ex: removido depois),
  // ignora e força reseleção.
  let active = activeRestaurantId
    ? memberships.find((m) => m.restaurant_id === activeRestaurantId) ?? null
    : null;

  if (!active) {
    if (memberships.length === 1) {
      // Único restaurante: o custom_access_token_hook já injeta o claim
      // automaticamente. Aqui aceitamos direto pra não travar o fluxo.
      active = memberships[0];
    } else {
      throw redirect({ to: "/admin/selecionar-restaurante" });
    }
  }

  const role = active.role as AdminRole;
  if (!allowed.includes(role)) {
    if (role === "cozinha") throw redirect({ to: "/admin/cozinha" });
    throw redirect({ to: "/admin/pedidos" });
  }
}
