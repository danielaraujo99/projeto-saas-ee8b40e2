import { createClient } from "@supabase/supabase-js";

type SetActiveTenantInput = {
  accessToken: string;
  restaurantId: string;
};

type SetActiveTenantResult = {
  restaurant_id: string;
  role: "admin" | "caixa" | "cozinha";
};

function createBackendFetch(apiKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(init?.headers);
    if (apiKey.startsWith("sb_") && headers.get("Authorization") === `Bearer ${apiKey}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", apiKey);
    return fetch(input, { ...init, headers });
  };
}

function getCustomAdmin() {
  const url = process.env.CUSTOM_SUPABASE_URL;
  const serviceKey = process.env.CUSTOM_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Backend custom não configurado.");
  return createClient(url, serviceKey, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
    global: { fetch: createBackendFetch(serviceKey) },
  });
}

/**
 * Define o tenant/papel ativo do usuário autenticado.
 *
 * Fluxo:
 * 1. Valida o access_token contra o projeto custom (auth.getUser).
 * 2. Confirma que o usuário É membro daquele restaurant_id e lê o papel real
 *    direto da tabela restaurant_members — nunca aceita `role` do cliente.
 * 3. Grava `active_restaurant_id`/`active_role` em `app_metadata` do usuário
 *    via service role. O custom_access_token_hook do Supabase Auth vai ler
 *    esses campos e injetar como claim no próximo JWT emitido.
 *
 * Nenhum valor de tenant/role enviado pelo cliente é confiado — a verdade
 * vem da tabela restaurant_members validada aqui no servidor.
 */
export async function setActiveTenantForUser(
  input: SetActiveTenantInput,
): Promise<SetActiveTenantResult> {
  const admin = getCustomAdmin();
  const token = input.accessToken.trim();
  if (!token) throw new Error("Sua sessão expirou.");

  const { data: authData, error: authError } = await admin.auth.getUser(token);
  const user = authData.user;
  if (authError || !user) throw new Error("Sua sessão expirou.");

  const restaurantId = input.restaurantId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(restaurantId)) throw new Error("Restaurante inválido.");

  const { data: member, error: memberError } = await admin
    .from("restaurant_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (memberError) throw new Error("Não foi possível validar sua permissão.");
  if (!member) throw new Error("Você não é membro deste restaurante.");

  const role = String((member as { role: unknown }).role) as SetActiveTenantResult["role"];
  if (role !== "admin" && role !== "caixa" && role !== "cozinha") {
    throw new Error("Papel inválido para este restaurante.");
  }

  const prev = (user.app_metadata ?? {}) as Record<string, unknown>;
  const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: {
      ...prev,
      active_restaurant_id: restaurantId,
      active_role: role,
    },
  });
  if (updateError) throw new Error("Não foi possível atualizar sua sessão.");

  return { restaurant_id: restaurantId, role };
}
