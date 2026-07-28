import { supabase } from "@/lib/custom-supabase";
import type { Category, Product, CustomizationGroup } from "@/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
const sb = supabase as any;

export type Storefront = {
  restaurantId: string;
  restaurantName: string;
  slug: string;
  categories: Category[];
  products: Product[];
};

async function fetchByRestaurant(row: {
  id: string;
  name: string;
  slug: string;
}): Promise<Storefront> {
  const rid = row.id;
  const [catsRes, prodsRes, groupsRes, optsRes] = await Promise.all([
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
    categories,
    products,
  };
}

export async function fetchMenuBySlug(slug: string): Promise<Storefront | null> {
  const { data, error } = await sb
    .from("restaurants")
    .select("id,name,slug,active")
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
    .select("id,name,slug,active")
    .eq("slug", "demo")
    .eq("active", true)
    .maybeSingle();
  if (preferred.data) return fetchByRestaurant(preferred.data);

  const { data, error } = await sb
    .from("restaurants")
    .select("id,name,slug,active")
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return fetchByRestaurant(data);
}
