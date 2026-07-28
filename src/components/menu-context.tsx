import * as React from "react";
import type { Category, Product } from "@/types";
import { categories as staticCategories, products as staticProducts } from "@/data/menu";

type MenuContextValue = {
  categories: Category[];
  products: Product[];
  productById: (id: string) => Product | undefined;
  restaurantId?: string;
  restaurantSlug?: string;
  restaurantName?: string;
};

const MenuContext = React.createContext<MenuContextValue | null>(null);

export function MenuProvider({
  categories,
  products,
  restaurantId,
  restaurantSlug,
  restaurantName,
  children,
}: {
  categories: Category[];
  products: Product[];
  restaurantId?: string;
  restaurantSlug?: string;
  restaurantName?: string;
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
    };
  }, [categories, products, restaurantId, restaurantSlug, restaurantName]);
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

/**
 * Retorna o restaurante ativo (id/slug) resolvido pelo contexto de cardápio da
 * navegação atual. Retorna null quando não há contexto (ex.: rotas estáticas).
 */
export function useActiveRestaurant(): {
  id?: string;
  slug?: string;
  name?: string;
} | null {
  const ctx = React.useContext(MenuContext);
  if (!ctx) return null;
  return { id: ctx.restaurantId, slug: ctx.restaurantSlug, name: ctx.restaurantName };
}
