import { ImageIcon } from "lucide-react";
import type { Product } from "@/types";
import { brl } from "@/lib/format";
import { ProductBadgePill } from "@/components/product-badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRestaurant } from "@/components/menu-context";

type Props = {
  product: Product;
  onClick: () => void;
};


export function ProductCard({ product, onClick }: Props) {
  const disabled = product.available === false;
  const restaurant = useRestaurant();
  const closed = restaurant ? !restaurant.isOpen : false;
  return (
    <button
      type="button"
      onClick={() => {
        if (disabled) {
          toast.error("Item indisponível no momento", {
            description: "Este item voltará em breve. Escolha outra opção enquanto isso.",
          });
          return;
        }
        if (closed) {
          toast.error("Restaurante fechado no momento", {
            description: "Você pode explorar o cardápio, mas o pedido só pode ser feito quando reabrir.",
          });
          return;
        }
        onClick();
      }}
      aria-disabled={disabled}
      className={cn(
        "group relative flex w-full items-stretch gap-4 rounded-2xl border border-border bg-card p-3 text-left",
        "shadow-[var(--shadow-card)] transition-all duration-200",
        "hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[var(--shadow-elevated)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        disabled && "opacity-60 hover:-translate-y-0 hover:border-border hover:shadow-[var(--shadow-card)]",
      )}
    >

      <div className="flex min-w-0 flex-1 flex-col">
        {product.badges?.length || disabled ? (
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            {product.badges?.map((b) => <ProductBadgePill key={b} kind={b} />)}
            {disabled ? <ProductBadgePill kind="out" /> : null}
          </div>
        ) : null}
        <h3 className="line-clamp-1 text-[15px] font-semibold text-foreground sm:text-base">
          {product.name}
        </h3>
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-foreground/55 sm:text-sm">
          {product.description}
        </p>
        <div className="mt-auto flex items-baseline gap-2 pt-2">
          <span className="text-base font-bold tabular-nums text-foreground">
            {brl(product.price)}
          </span>
          {product.originalPrice ? (
            <span className="text-xs tabular-nums text-muted-foreground line-through">
              {brl(product.originalPrice)}
            </span>
          ) : null}
        </div>
      </div>
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-muted sm:h-28 sm:w-28">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.06]"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-muted-foreground">
            <ImageIcon className="h-6 w-6" />
          </div>
        )}
      </div>
    </button>
  );
}
