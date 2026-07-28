import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartCustomization, CartItem, Coupon } from "@/types";
import { coupons as allCoupons } from "@/data/coupons";

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
  applyCoupon: (code: string) => { ok: boolean; message: string };
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
        // Se a sacola pertence a outro restaurante, reinicia antes de adicionar.
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
      applyCoupon: (code) => {
        const found = allCoupons.find((c) => c.code.toLowerCase() === code.trim().toLowerCase());
        if (!found) return { ok: false, message: "Cupom inválido." };
        const sub = get().subtotal();
        if (found.minOrder && sub < found.minOrder)
          return {
            ok: false,
            message: `Pedido mínimo de R$ ${found.minOrder.toFixed(2)} para este cupom.`,
          };
        set({ coupon: found });
        return { ok: true, message: `Cupom aplicado: ${found.description}` };
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
