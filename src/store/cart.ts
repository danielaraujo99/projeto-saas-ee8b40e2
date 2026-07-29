import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartCustomization, CartItem, Coupon } from "@/types";
import { supabase } from "@/lib/custom-supabase";

/* eslint-disable @typescript-eslint/no-explicit-any */
const sb = supabase as any;

const unit = (base: number, cs: CartCustomization[]) =>
  base + cs.reduce((s, c) => s + c.priceDelta, 0);

type RestaurantRef = { id?: string; slug?: string; name?: string };

type CartState = {
  items: CartItem[];
  coupon?: Coupon;
  restaurantId?: string;
  restaurantSlug?: string;
  restaurantName?: string;
  addItem: (item: Omit<CartItem, "id" | "unitPrice">, restaurant?: RestaurantRef) => void;
  updateItem: (id: string, patch: Partial<CartItem>) => void;
  setQuantity: (id: string, qty: number) => void;
  removeItem: (id: string) => void;
  duplicateItem: (id: string) => void;
  clear: () => void;
  applyCoupon: (code: string) => Promise<{ ok: boolean; message: string }>;
  removeCoupon: () => void;
  subtotal: () => number;
  discount: () => number;
  itemCount: () => number;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      coupon: undefined,
      restaurantId: undefined,
      restaurantSlug: undefined,
      restaurantName: undefined,
      addItem: (item, restaurant) => {
        const id = crypto.randomUUID();
        const unitPrice = unit(item.basePrice, item.customizations);
        const state = get();
        const differentRestaurant =
          !!(restaurant?.id && state.restaurantId && restaurant.id !== state.restaurantId);
        const baseItems = differentRestaurant ? [] : state.items;
        const patch: Partial<CartState> = {
          items: [...baseItems, { ...item, id, unitPrice }],
        };
        if (differentRestaurant) patch.coupon = undefined;
        if (restaurant?.id) patch.restaurantId = restaurant.id;
        if (restaurant?.slug) patch.restaurantSlug = restaurant.slug;
        if (restaurant?.name) patch.restaurantName = restaurant.name;
        set(patch);
      },
      updateItem: (id, patch) =>
        set({
          items: get().items.map((it) => {
            if (it.id !== id) return it;
            const merged = { ...it, ...patch } as CartItem;
            merged.unitPrice = unit(merged.basePrice, merged.customizations);
            return merged;
          }),
        }),
      setQuantity: (id, qty) => {
        if (qty <= 0) return get().removeItem(id);
        set({ items: get().items.map((it) => (it.id === id ? { ...it, quantity: qty } : it)) });
      },
      removeItem: (id) => {
        const next = get().items.filter((it) => it.id !== id);
        if (next.length === 0) {
          set({
            items: [],
            coupon: undefined,
            restaurantId: undefined,
            restaurantSlug: undefined,
            restaurantName: undefined,
          });
        } else {
          set({ items: next });
        }
      },
      duplicateItem: (id) => {
        const it = get().items.find((i) => i.id === id);
        if (!it) return;
        set({ items: [...get().items, { ...it, id: crypto.randomUUID() }] });
      },
      clear: () =>
        set({
          items: [],
          coupon: undefined,
          restaurantId: undefined,
          restaurantSlug: undefined,
          restaurantName: undefined,
        }),
      applyCoupon: async (code) => {
        const rid = get().restaurantId;
        if (!rid) {
          return { ok: false, message: "Adicione itens ao carrinho antes de aplicar um cupom." };
        }
        const upper = code.trim().toUpperCase();
        if (!upper) return { ok: false, message: "Informe um cupom." };
        const { data, error } = await sb
          .from("coupons")
          .select(
            "code,kind,amount,min_order_value,description,active,valid_from,valid_to,usage_limit,used_count",
          )
          .eq("restaurant_id", rid)
          .eq("active", true)
          .ilike("code", upper)
          .maybeSingle();
        if (error) return { ok: false, message: "Não foi possível validar o cupom." };
        if (!data) return { ok: false, message: "Cupom inválido para este restaurante." };
        const now = Date.now();
        if (data.valid_from && new Date(data.valid_from).getTime() > now) {
          return { ok: false, message: "Cupom ainda não está válido." };
        }
        if (data.valid_to && new Date(data.valid_to).getTime() < now) {
          return { ok: false, message: "Cupom expirado." };
        }
        if (data.usage_limit != null && Number(data.used_count ?? 0) >= Number(data.usage_limit)) {
          return { ok: false, message: "Cupom esgotado." };
        }
        const min = Number(data.min_order_value ?? 0);
        const sub = get().subtotal();
        if (min && sub < min) {
          return {
            ok: false,
            message: `Pedido mínimo de R$ ${min.toFixed(2)} para este cupom.`,
          };
        }
        const kind = (data.kind === "fixed" ? "fixed" : "percent") as Coupon["kind"];
        const coupon: Coupon = {
          code: String(data.code).toUpperCase(),
          kind,
          value: Number(data.amount ?? 0),
          minOrder: min || undefined,
          description: data.description ?? `Cupom ${data.code}`,
        };
        set({ coupon });
        return { ok: true, message: `Cupom aplicado: ${coupon.description}` };
      },
      removeCoupon: () => set({ coupon: undefined }),
      subtotal: () => get().items.reduce((s, it) => s + it.unitPrice * it.quantity, 0),
      discount: () => {
        const c = get().coupon;
        if (!c) return 0;
        const sub = get().subtotal();
        if (c.minOrder && sub < c.minOrder) return 0;
        return c.kind === "percent" ? (sub * c.value) / 100 : c.value;
      },
      itemCount: () => get().items.reduce((s, it) => s + it.quantity, 0),
    }),
    { name: "bistro-cart" },
  ),
);
