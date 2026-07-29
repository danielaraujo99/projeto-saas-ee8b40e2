import { useQuery } from "@tanstack/react-query";
import { useCart } from "@/store/cart";
import { fetchRestaurantDisplay } from "@/lib/storefront";
import type { Restaurant } from "@/types";

/**
 * Resolve os dados reais do restaurante associado ao carrinho atual.
 * Usado por /carrinho e /checkout, que estão fora do <MenuProvider>.
 */
export function useCartRestaurant(): {
  restaurant: Restaurant | undefined;
  isLoading: boolean;
} {
  const id = useCart((s) => s.restaurantId);
  const slug = useCart((s) => s.restaurantSlug);
  const q = useQuery({
    queryKey: ["cart-restaurant", id ?? "", slug ?? ""],
    queryFn: () => fetchRestaurantDisplay({ id, slug }),
    enabled: !!(id || slug),
    staleTime: 60_000,
  });
  return { restaurant: q.data ?? undefined, isLoading: q.isLoading };
}
