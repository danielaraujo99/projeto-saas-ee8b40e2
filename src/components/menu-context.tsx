import * as React from "react";
import type { Category, Product, Restaurant } from "@/types";
import { categories as staticCategories, products as staticProducts } from "@/data/menu";

type MenuContextValue = {
  categories: Category[];
  products: Product[];
  productById: (id: string) => Product | undefined;
  restaurantId?: string;
  restaurantSlug?: string;
  restaurantName?: string;
  restaurant?: Restaurant;
};

const MenuContext = React.createContext<MenuContextValue | null>(null);

export function MenuProvider({
  categories,
  products,
  restaurantId,
  restaurantSlug,
  restaurantName,
  restaurant,
  children,
}: {
  categories: Category[];
  products: Product[];
  restaurantId?: string;
  restaurantSlug?: string;
  restaurantName?: string;
  restaurant?: Restaurant;
  children: React.ReactNode;
}) {
  const value = React.useMemo<MenuContextValue>(() => {
    const map = new Map(products.map((p) => [p.id, p]));
    return {
      categories,
      products,
      productById: (id: string) => map.get(id),
      restaurantId,
      restaurantSlug,
      restaurantName,
      restaurant,
    };
  }, [categories, products, restaurantId, restaurantSlug, restaurantName, restaurant]);
  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>;
}

/** Retorna o contexto ou os dados estáticos padrão (compatibilidade). */
export function useMenu(): MenuContextValue {
  const ctx = React.useContext(MenuContext);
  if (ctx) return ctx;
  const map = new Map(staticProducts.map((p) => [p.id, p]));
  return {
    categories: staticCategories,
    products: staticProducts,
    productById: (id: string) => map.get(id),
  };
}

export function useActiveRestaurant(): {
  id?: string;
  slug?: string;
  name?: string;
} | null {
  const ctx = React.useContext(MenuContext);
  if (!ctx) return null;
  return { id: ctx.restaurantId, slug: ctx.restaurantSlug, name: ctx.restaurantName };
}

/** Restaurante real do tenant atual (via MenuProvider). Undefined fora dele. */
export function useRestaurant(): Restaurant | undefined {
  const ctx = React.useContext(MenuContext);
  return ctx?.restaurant;
}
