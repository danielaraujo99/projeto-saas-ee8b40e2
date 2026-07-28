import * as React from "react";
import type { Category, Product } from "@/types";
import { categories as staticCategories, products as staticProducts } from "@/data/menu";

type MenuContextValue = {
  categories: Category[];
  products: Product[];
  productById: (id: string) => Product | undefined;
};

const MenuContext = React.createContext<MenuContextValue | null>(null);

export function MenuProvider({
  categories,
  products,
  children,
}: {
  categories: Category[];
  products: Product[];
  children: React.ReactNode;
}) {
  const value = React.useMemo<MenuContextValue>(() => {
    const map = new Map(products.map((p) => [p.id, p]));
    return {
      categories,
      products,
      productById: (id: string) => map.get(id),
    };
  }, [categories, products]);
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
