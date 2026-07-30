import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/lib/custom-supabase";
import type { User } from "@supabase/supabase-js";

export type AdminRole = "admin" | "caixa" | "cozinha";

export type MembershipSummary = {
  restaurantId: string;
  restaurantName: string;
  restaurantSlug: string;
  role: AdminRole;
};

export type AdminSession = {
  user: User;
  restaurantId: string;
  restaurantName: string;
  restaurantSlug: string;
  role: AdminRole;
  profileName: string;
  /** All restaurants this user is member of (may include the active one). */
  memberships: MembershipSummary[];
  /** True when user is member of >1 restaurant but hasn't picked an active one yet. */
  needsSelection: boolean;
};

const VALID_ROLES: readonly AdminRole[] = ["admin", "caixa", "cozinha"];
const ADMIN_QUERY_TIMEOUT_MS = 12_000;

async function withAdminTimeout<T>(promise: PromiseLike<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} demorou para responder.`)),
          ADMIN_QUERY_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function parseRole(value: unknown): AdminRole | null {
  return typeof value === "string" && (VALID_ROLES as readonly string[]).includes(value)
    ? (value as AdminRole)
    : null;
}

type MembershipRow = {
  role: unknown;
  restaurant_id: string;
  restaurants: { id: string; name: string; slug: string } | null;
};

async function fetchAdminSession(): Promise<AdminSession | null> {
  const { data: userRes, error: userError } = await withAdminTimeout(
    supabase.auth.getUser(),
    "Autenticação",
  );
  if (userError) {
    // Sem sessão salva não é erro: é usuário deslogado — o shell redireciona
    // para /admin/login. Só erros reais (rede/backend) devem virar exceção.
    const msg = (userError.message || "").toLowerCase();
    if (
      msg.includes("auth session missing") ||
      msg.includes("session missing") ||
      msg.includes("session_not_found") ||
      userError.status === 400 ||
      userError.status === 401 ||
      userError.status === 403
    ) {
      return null;
    }
    throw new Error(userError.message || "Sessão inválida.");
  }
  const user = userRes.user;
  if (!user) return null;


  const { data: memberRows, error: memberError } = await withAdminTimeout(
    supabase
      .from("restaurant_members")
      .select("role, restaurant_id, restaurants!inner(id, name, slug)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    "Permissões do painel",
  );
  if (memberError) throw new Error(memberError.message || "Não foi possível carregar permissões.");

  const memberships: MembershipSummary[] = ((memberRows ?? []) as unknown as MembershipRow[])
    .map((r) => {
      const role = parseRole(r.role);
      const rest = r.restaurants;
      if (!role || !rest) return null;
      return {
        restaurantId: rest.id,
        restaurantName: rest.name,
        restaurantSlug: rest.slug,
        role,
      } satisfies MembershipSummary;
    })
    .filter((m): m is MembershipSummary => m !== null);

  if (memberships.length === 0) return null;

  // Active tenant vem do app_metadata (validado pelo backend via updateUserById).
  // O JWT hook injeta esses mesmos valores como claim para RLS futura.
  const meta = (user.app_metadata ?? {}) as Record<string, unknown>;
  const activeRestaurantId =
    typeof meta.active_restaurant_id === "string" ? meta.active_restaurant_id : null;

  let active: MembershipSummary | undefined;
  if (activeRestaurantId) {
    active = memberships.find((m) => m.restaurantId === activeRestaurantId);
  }
  if (!active && memberships.length === 1) {
    // Membro de um único restaurante: fluxo direto, sem tela de seleção.
    active = memberships[0];
  }

  const { data: profile } = await withAdminTimeout(
    supabase.from("profiles").select("name").eq("id", user.id).maybeSingle(),
    "Perfil do usuário",
  ).catch(() => ({ data: null }));
  const profileName = profile?.name || user.email || "";

  if (!active) {
    // Precisa escolher explicitamente — devolve sessão marcada como tal.
    // Usamos o primeiro membership só como placeholder para o shape; guards
    // devem verificar `needsSelection` e redirecionar antes de renderizar.
    const first = memberships[0];
    return {
      user,
      restaurantId: first.restaurantId,
      restaurantName: first.restaurantName,
      restaurantSlug: first.restaurantSlug,
      role: first.role,
      profileName,
      memberships,
      needsSelection: true,
    };
  }

  return {
    user,
    restaurantId: active.restaurantId,
    restaurantName: active.restaurantName,
    restaurantSlug: active.restaurantSlug,
    role: active.role,
    profileName,
    memberships,
    needsSelection: false,
  };
}

export function useAdminSession() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["admin-session"],
    queryFn: fetchAdminSession,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    retry: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT" ||
        event === "USER_UPDATED"
      ) {
        qc.invalidateQueries({ queryKey: ["admin-session"] });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [qc]);

  return query;
}
