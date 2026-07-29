import { supabase } from "@/lib/custom-supabase";
import type { Category, Product, CustomizationGroup, Restaurant } from "@/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
const sb = supabase as any;

const FALLBACK_LOGO =
  "https://images.unsplash.com/photo-1550547660-d9450f859349?w=200&h=200&fit=crop";
const FALLBACK_COVER =
  "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=1600&h=600&fit=crop";

export type Storefront = {
  restaurantId: string;
  restaurantName: string;
  slug: string;
  restaurant: Restaurant;
  categories: Category[];
  products: Product[];
};

type Settings = {
  hours?: Array<{ day: string; open: boolean; from: string; to: string }>;
  auto_close?: boolean;
  prep_time_min?: number;
  delivery_time_min?: number;
  delivery_radius_km?: number;
  delivery_fee?: number;
  min_order?: number;
  accept_pickup?: boolean;
};

/** Parse "Rua Foo, 245 — Centro · São Paulo/SP" (flexível) para pickupAddress. */
function parseAddress(raw: string | null | undefined): Restaurant["pickupAddress"] {
  if (!raw) return undefined;
  const clean = raw.trim();
  if (!clean) return undefined;
  return {
    street: clean,
    number: "",
    neighborhood: "",
    city: "",
    state: "",
  };
}

async function fetchRating(rid: string): Promise<{ rating: number; count: number }> {
  const { data, error } = await sb
    .from("orders")
    .select("rating_food,rating_delivery")
    .eq("restaurant_id", rid)
    .eq("rated", true)
    .not("rating_food", "is", null);
  if (error || !data || data.length === 0) return { rating: 0, count: 0 };
  let sum = 0;
  let n = 0;
  for (const r of data as any[]) {
    const f = Number(r.rating_food);
    const d = r.rating_delivery == null ? null : Number(r.rating_delivery);
    if (Number.isFinite(f)) {
      const v = d != null && Number.isFinite(d) ? (f + d) / 2 : f;
      sum += v;
      n += 1;
    }
  }
  return { rating: n > 0 ? sum / n : 0, count: n };
}

function buildRestaurant(row: any, rating: { rating: number; count: number }): Restaurant {
  const settings = (row.settings ?? {}) as Settings;
  const prep = Math.max(0, Number(settings.prep_time_min ?? 0) | 0);
  const delivery = Math.max(0, Number(settings.delivery_time_min ?? 40) | 0);
  const min = Math.max(prep, delivery - 10) || Math.max(0, delivery - 10);
  const isOpen = row.active !== false && settings.auto_close !== true;
  return {
    id: row.id,
    name: row.name,
    tagline: row.description ?? "",
    logo: row.logo_url || FALLBACK_LOGO,
    cover: row.cover_url || FALLBACK_COVER,
    rating: rating.rating,
    reviewsCount: rating.count,
    deliveryMinutes: [min || Math.max(0, delivery - 10), delivery],
    deliveryFee: Number(settings.delivery_fee ?? 0),
    minimumOrder: Number(settings.min_order ?? 0),
    isOpen,
    categoriesLabel: row.category ?? "",
    distanceKm: 0,
    pickupAddress: parseAddress(row.address),
  };
}

async function fetchByRestaurant(row: any): Promise<Storefront> {
  const rid = row.id as string;
  const [catsRes, prodsRes, groupsRes, optsRes, rating] = await Promise.all([
    sb
      .from("categories")
      .select("id,name,sort_order,active")
      .eq("restaurant_id", rid)
      .eq("active", true)
      .order("sort_order")
      .order("name"),
    sb
      .from("products")
      .select("id,category_id,name,description,price,image_url,active,featured,sort_order")
      .eq("restaurant_id", rid)
      .eq("active", true)
      .order("sort_order")
      .order("name"),
    sb
      .from("product_option_groups")
      .select("id,product_id,name,min_select,max_select,required,sort_order")
      .eq("restaurant_id", rid)
      .order("sort_order"),
    sb
      .from("product_options")
      .select("id,group_id,name,price_delta,sort_order")
      .eq("restaurant_id", rid)
      .order("sort_order"),
    fetchRating(rid),
  ]);
  if (catsRes.error) throw catsRes.error;
  if (prodsRes.error) throw prodsRes.error;

  const categories: Category[] = (catsRes.data ?? []).map((c: any) => ({
    id: c.id,
    name: c.name,
  }));

  const groups = (groupsRes.data ?? []) as any[];
  const opts = (optsRes.data ?? []) as any[];

  const groupsByProduct = new Map<string, CustomizationGroup[]>();
  for (const g of groups) {
    const options = opts
      .filter((o) => o.group_id === g.id)
      .map((o) => ({
        id: o.id,
        name: o.name,
        priceDelta: Number(o.price_delta) || 0,
      }));
    const cg: CustomizationGroup = {
      id: g.id,
      name: g.name,
      min: g.min_select ?? 0,
      max: g.max_select ?? 1,
      required: !!g.required,
      options,
    };
    const arr = groupsByProduct.get(g.product_id) ?? [];
    arr.push(cg);
    groupsByProduct.set(g.product_id, arr);
  }

  const products: Product[] = (prodsRes.data ?? []).map((p: any) => ({
    id: p.id,
    categoryId: p.category_id ?? "",
    name: p.name,
    description: p.description ?? "",
    price: Number(p.price) || 0,
    image: p.image_url ?? undefined,
    badges: p.featured ? ["popular"] : undefined,
    customizations: groupsByProduct.get(p.id),
  }));

  return {
    restaurantId: rid,
    restaurantName: row.name,
    slug: row.slug,
    restaurant: buildRestaurant(row, rating),
    categories,
    products,
  };
}

const REST_COLS =
  "id,name,slug,phone,description,address,category,logo_url,cover_url,settings,active";

export async function fetchMenuBySlug(slug: string): Promise<Storefront | null> {
  const { data, error } = await sb
    .from("restaurants")
    .select(REST_COLS)
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return fetchByRestaurant(data);
}

/** Usado por /demo: pega o primeiro restaurante ativo (prefere slug 'demo'). */
export async function fetchDemoMenu(): Promise<Storefront | null> {
  const preferred = await sb
    .from("restaurants")
    .select(REST_COLS)
    .eq("slug", "demo")
    .eq("active", true)
    .maybeSingle();
  if (preferred.data) return fetchByRestaurant(preferred.data);

  const { data, error } = await sb
    .from("restaurants")
    .select(REST_COLS)
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return fetchByRestaurant(data);
}

/** Busca dados de exibição do restaurante por id ou slug (sem itens de cardápio). */
export async function fetchRestaurantDisplay(input: {
  id?: string | null;
  slug?: string | null;
}): Promise<Restaurant | null> {
  const q = sb.from("restaurants").select(REST_COLS).eq("active", true).limit(1);
  const { data, error } = await (input.id
    ? q.eq("id", input.id).maybeSingle()
    : input.slug
      ? q.eq("slug", input.slug).maybeSingle()
      : Promise.resolve({ data: null, error: null } as any));
  if (error) throw error;
  if (!data) return null;
  const rating = await fetchRating(data.id);
  return buildRestaurant(data, rating);
}

/** Lista compacta usada na página /buscar. */
export type RestaurantCard = {
  id: string;
  slug: string;
  name: string;
  category: string;
  cover: string;
  logo: string;
  rating: number;
  minutes: [number, number];
};

export async function listActiveRestaurants(): Promise<RestaurantCard[]> {
  const { data, error } = await sb
    .from("restaurants")
    .select("id,slug,name,category,cover_url,logo_url,settings")
    .eq("active", true)
    .order("name");
  if (error) throw error;
  const rows = (data ?? []) as any[];
  const ratings = await Promise.all(rows.map((r) => fetchRating(r.id)));
  return rows.map((r, i) => {
    const settings = (r.settings ?? {}) as Settings;
    const delivery = Math.max(0, Number(settings.delivery_time_min ?? 40) | 0);
    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      category: r.category ?? "",
      cover: r.cover_url || FALLBACK_COVER,
      logo: r.logo_url || FALLBACK_LOGO,
      rating: ratings[i].rating,
      minutes: [Math.max(0, delivery - 10), delivery],
    };
  });
}

/** Mapa id→{name,logo} para as telas /pedidos e /pedido/$id. */
export async function fetchRestaurantsBrief(
  ids: string[],
): Promise<Record<string, { name: string; logo: string; slug: string }>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return {};
  const { data, error } = await sb
    .from("restaurants")
    .select("id,name,slug,logo_url")
    .in("id", unique);
  if (error) throw error;
  const out: Record<string, { name: string; logo: string; slug: string }> = {};
  for (const r of (data ?? []) as any[]) {
    out[r.id] = { name: r.name, slug: r.slug, logo: r.logo_url || FALLBACK_LOGO };
  }
  return out;
}
