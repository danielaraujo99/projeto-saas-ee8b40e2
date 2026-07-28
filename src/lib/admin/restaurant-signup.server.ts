import { createClient } from "@supabase/supabase-js";

type CreateRestaurantInput = {
  accessToken: string;
  ownerName: string;
  name: string;
  slug: string;
  category: string;
  phone: string;
};

type CreateRestaurantResult = {
  restaurant_id: string;
  slug: string;
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

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function cleanPhone(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 ? value.trim() : null;
}

function isUniqueViolation(message: string): boolean {
  return /duplicate key|unique constraint|restaurants_slug_key/i.test(message);
}

export async function createRestaurantForCustomUser(
  input: CreateRestaurantInput,
): Promise<CreateRestaurantResult> {
  const admin = getCustomAdmin();
  const token = input.accessToken.trim();
  if (!token) throw new Error("Sua sessão expirou. Faça login e tente novamente.");

  const { data: authData, error: authError } = await admin.auth.getUser(token);
  const user = authData.user;
  if (authError || !user) throw new Error("Sua sessão expirou. Faça login e tente novamente.");

  const { data: existingMember, error: memberReadError } = await admin
    .from("restaurant_members")
    .select("restaurant_id, restaurants(id, slug)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (memberReadError) throw new Error("Não foi possível validar sua conta agora.");
  if (existingMember) {
    const member = existingMember as {
      restaurant_id?: unknown;
      restaurants?: { id?: unknown; slug?: unknown } | null;
    };
    const restaurantId =
      typeof member.restaurant_id === "string"
        ? member.restaurant_id
        : typeof member.restaurants?.id === "string"
          ? member.restaurants.id
          : null;
    const restaurantSlug = typeof member.restaurants?.slug === "string" ? member.restaurants.slug : input.slug;
    if (restaurantId) return { restaurant_id: restaurantId, slug: restaurantSlug };
  }

  const restaurantName = input.name.trim();
  const cleanSlug = slugify(input.slug);
  if (!restaurantName) throw new Error("Informe o nome do restaurante.");
  if (!cleanSlug) throw new Error("Escolha um link público válido.");

  const { data: slugOwner, error: slugError } = await admin
    .from("restaurants")
    .select("id")
    .eq("slug", cleanSlug)
    .maybeSingle();
  if (slugError) throw new Error("Não foi possível validar o link agora.");
  if (slugOwner) throw new Error("slug_taken");

  const profileName = input.ownerName.trim() || user.email?.split("@")[0] || "Administrador";
  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: user.id,
      name: profileName,
      email: user.email ?? null,
    },
    { onConflict: "id" },
  );
  if (profileError) throw new Error("Não foi possível preparar seu perfil.");

  const { data: restaurant, error: restaurantError } = await admin
    .from("restaurants")
    .insert({
      name: restaurantName,
      slug: cleanSlug,
      category: input.category.trim() || null,
      phone: cleanPhone(input.phone),
      active: true,
      settings: {},
    })
    .select("id, slug")
    .single();

  if (restaurantError) {
    if (isUniqueViolation(restaurantError.message)) throw new Error("slug_taken");
    throw new Error("Não foi possível criar o restaurante agora.");
  }

  const created = restaurant as { id?: unknown; slug?: unknown } | null;
  const restaurantId = typeof created?.id === "string" ? created.id : null;
  const restaurantSlug = typeof created?.slug === "string" ? created.slug : cleanSlug;
  if (!restaurantId) throw new Error("Restaurante criado sem identificador.");

  const { error: linkError } = await admin.from("restaurant_members").insert({
    user_id: user.id,
    restaurant_id: restaurantId,
    role: "admin",
  });
  if (linkError) {
    await admin.from("restaurants").delete().eq("id", restaurantId);
    throw new Error("Não foi possível vincular sua conta ao restaurante.");
  }

  return { restaurant_id: restaurantId, slug: restaurantSlug };
}