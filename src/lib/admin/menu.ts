import { supabase } from "@/lib/custom-supabase";

/* eslint-disable @typescript-eslint/no-explicit-any */
const sb = supabase as any;

export type Category = {
  id: string;
  restaurant_id: string;
  name: string;
  sort_order: number;
  active: boolean;
};

export type Product = {
  id: string;
  restaurant_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  active: boolean;
  featured: boolean;
  sort_order: number;
};

export type OptionRow = {
  id: string;
  group_id: string;
  restaurant_id: string;
  name: string;
  price_delta: number;
  sort_order: number;
};

export type OptionGroup = {
  id: string;
  restaurant_id: string;
  product_id: string;
  name: string;
  min_select: number;
  max_select: number;
  required: boolean;
  sort_order: number;
  options: OptionRow[];
};

export async function listCategories(restaurantId: string): Promise<Category[]> {
  const { data, error } = await sb
    .from("categories")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Category[];
}

export async function createCategory(input: {
  restaurant_id: string;
  name: string;
  sort_order?: number;
}) {
  const { error } = await sb.from("categories").insert(input);
  if (error) throw error;
}

export async function updateCategory(id: string, patch: Partial<Category>) {
  const { error } = await sb.from("categories").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteCategory(id: string) {
  const { error } = await sb.from("categories").delete().eq("id", id);
  if (error) throw error;
}

export async function listProducts(restaurantId: string): Promise<Product[]> {
  const { data, error } = await sb
    .from("products")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as any[]).map((p) => ({ ...p, price: Number(p.price) })) as Product[];
}

export async function createProduct(input: {
  restaurant_id: string;
  category_id: string | null;
  name: string;
  description?: string | null;
  price: number;
  image_url?: string | null;
  active?: boolean;
  featured?: boolean;
}): Promise<string> {
  const { data, error } = await sb.from("products").insert(input).select("id").single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function updateProduct(id: string, patch: Partial<Product>) {
  const { error } = await sb.from("products").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteProduct(id: string) {
  const { error } = await sb.from("products").delete().eq("id", id);
  if (error) throw error;
}

/* -------------------- Option Groups + Options -------------------- */

export async function listOptionGroupsForProduct(
  productId: string,
): Promise<OptionGroup[]> {
  const [gRes, oRes] = await Promise.all([
    sb.from("product_option_groups").select("*").eq("product_id", productId).order("sort_order"),
    sb
      .from("product_options")
      .select("*")
      .in(
        "group_id",
        (
          await sb
            .from("product_option_groups")
            .select("id")
            .eq("product_id", productId)
        ).data?.map((r: any) => r.id) ?? [],
      )
      .order("sort_order"),
  ]);
  if (gRes.error) throw gRes.error;
  if (oRes.error) throw oRes.error;
  const opts = ((oRes.data ?? []) as any[]).map((o) => ({
    ...o,
    price_delta: Number(o.price_delta),
  })) as OptionRow[];
  return ((gRes.data ?? []) as any[]).map((g) => ({
    ...g,
    options: opts.filter((o) => o.group_id === g.id),
  })) as OptionGroup[];
}

export async function listAllOptionsForRestaurant(restaurantId: string): Promise<{
  groups: OptionGroup[];
}> {
  const [gRes, oRes] = await Promise.all([
    sb
      .from("product_option_groups")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("sort_order"),
    sb
      .from("product_options")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("sort_order"),
  ]);
  if (gRes.error) throw gRes.error;
  if (oRes.error) throw oRes.error;
  const opts = ((oRes.data ?? []) as any[]).map((o) => ({
    ...o,
    price_delta: Number(o.price_delta),
  })) as OptionRow[];
  const groups = ((gRes.data ?? []) as any[]).map((g) => ({
    ...g,
    options: opts.filter((o) => o.group_id === g.id),
  })) as OptionGroup[];
  return { groups };
}

export type OptionGroupDraft = {
  id?: string; // uuid existente ou undefined (novo)
  name: string;
  min_select: number;
  max_select: number;
  required: boolean;
  sort_order: number;
  options: {
    id?: string;
    name: string;
    price_delta: number;
    sort_order: number;
  }[];
};

/**
 * Persiste TODOS os grupos+opções de um produto de uma vez, tratando criação,
 * atualização e remoção de forma idempotente.
 */
export async function saveProductOptionGroups(
  restaurantId: string,
  productId: string,
  drafts: OptionGroupDraft[],
) {
  const existing = await listOptionGroupsForProduct(productId);
  const keepGroupIds = drafts.map((d) => d.id).filter(Boolean) as string[];

  // 1) Remover grupos que sumiram (cascade remove options).
  const toRemoveGroups = existing.filter((g) => !keepGroupIds.includes(g.id));
  if (toRemoveGroups.length) {
    const { error } = await sb
      .from("product_option_groups")
      .delete()
      .in(
        "id",
        toRemoveGroups.map((g) => g.id),
      );
    if (error) throw error;
  }

  for (const d of drafts) {
    let groupId = d.id;
    const payload = {
      restaurant_id: restaurantId,
      product_id: productId,
      name: d.name.trim(),
      min_select: d.min_select,
      max_select: d.max_select,
      required: d.required,
      sort_order: d.sort_order,
    };
    if (groupId) {
      const { error } = await sb
        .from("product_option_groups")
        .update(payload)
        .eq("id", groupId);
      if (error) throw error;
    } else {
      const { data, error } = await sb
        .from("product_option_groups")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      groupId = (data as { id: string }).id;
    }

    const currentOpts = existing.find((g) => g.id === d.id)?.options ?? [];
    const keepOptIds = d.options.map((o) => o.id).filter(Boolean) as string[];
    const toRemoveOpts = currentOpts.filter((o) => !keepOptIds.includes(o.id));
    if (toRemoveOpts.length) {
      const { error } = await sb
        .from("product_options")
        .delete()
        .in(
          "id",
          toRemoveOpts.map((o) => o.id),
        );
      if (error) throw error;
    }

    for (const opt of d.options) {
      const optPayload = {
        restaurant_id: restaurantId,
        group_id: groupId!,
        name: opt.name.trim(),
        price_delta: opt.price_delta,
        sort_order: opt.sort_order,
      };
      if (opt.id) {
        const { error } = await sb
          .from("product_options")
          .update(optPayload)
          .eq("id", opt.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("product_options").insert(optPayload);
        if (error) throw error;
      }
    }
  }
}

/* -------------------- Upload de imagem -------------------- */

export async function uploadProductImage(
  restaurantId: string,
  file: File,
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Selecione um arquivo de imagem (JPG, PNG, WEBP).");
  }
  const MAX = 5 * 1024 * 1024;
  if (file.size > MAX) {
    throw new Error("Imagem muito grande (máx. 5 MB).");
  }
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${restaurantId}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await sb.storage
    .from("product-images")
    .upload(path, file, {
      cacheControl: "31536000",
      upsert: false,
      contentType: file.type,
    });
  if (upErr) throw upErr;
  const { data } = sb.storage.from("product-images").getPublicUrl(path);
  return data.publicUrl as string;
}
