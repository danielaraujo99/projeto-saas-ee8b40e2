import * as React from "react";
import { Check, MessageSquareText } from "lucide-react";
import type { CartCustomization, CartItem, Product } from "@/types";
import { brl } from "@/lib/format";
import { QuantityStepper } from "@/components/quantity-stepper";
import { AdaptiveSheet } from "@/components/adaptive-sheet";
import { useCart } from "@/store/cart";
import { useActiveRestaurant } from "@/components/menu-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ProductBadgePill } from "@/components/product-badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Props = {
  product: Product | null;
  editingItem?: CartItem | null;
  onClose: () => void;
};

export function ProductSheet({ product, editingItem, onClose }: Props) {
  const addItem = useCart((s) => s.addItem);
  const updateItem = useCart((s) => s.updateItem);
  const activeRestaurant = useActiveRestaurant();
  const open = !!product;

  const [selections, setSelections] = React.useState<Record<string, CartCustomization[]>>({});
  const [quantity, setQuantity] = React.useState(1);
  const [note, setNote] = React.useState("");
  const [triedSubmit, setTriedSubmit] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!product) return;
    if (editingItem) {
      const grouped: Record<string, CartCustomization[]> = {};
      editingItem.customizations.forEach((c) => {
        grouped[c.groupId] = [...(grouped[c.groupId] ?? []), c];
      });
      setSelections(grouped);
      setQuantity(editingItem.quantity);
      setNote(editingItem.note ?? "");
    } else {
      setSelections({});
      setQuantity(1);
      setNote("");
    }
    setTriedSubmit(false);
    setScrolled(false);
  }, [product, editingItem]);

  if (!product) return null;

  const groups = product.customizations ?? [];
  const flat = Object.values(selections).flat();
  const extras = flat.reduce((s, c) => s + c.priceDelta, 0);
  const total = (product.price + extras) * quantity;

  const isGroupValid = (g: (typeof groups)[number]) => {
    const n = (selections[g.id] ?? []).length;
    return n >= g.min && n <= g.max;
  };
  const allValid = groups.every(isGroupValid);

  const toggleOption = (groupId: string, opt: CartCustomization, max: number) => {
    setSelections((prev) => {
      const cur = prev[groupId] ?? [];
      const exists = cur.find((c) => c.optionId === opt.optionId);
      if (max === 1) return { ...prev, [groupId]: exists ? [] : [opt] };
      if (exists) return { ...prev, [groupId]: cur.filter((c) => c.optionId !== opt.optionId) };
      if (cur.length >= max) return prev;
      return { ...prev, [groupId]: [...cur, opt] };
    });
  };

  const submit = () => {
    setTriedSubmit(true);
    if (!allValid) {
      const firstInvalid = groups.find((g) => !isGroupValid(g));
      toast.error("Selecione as opções obrigatórias", {
        description: firstInvalid ? `Confira: ${firstInvalid.name}` : undefined,
      });
      if (firstInvalid && scrollRef.current) {
        const el = scrollRef.current.querySelector<HTMLElement>(`[data-group="${firstInvalid.id}"]`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }
    const cs = flat;
    if (editingItem) {
      updateItem(editingItem.id, { customizations: cs, quantity, note });
      toast.success("Item atualizado");
    } else {
      addItem(
        {
          productId: product.id,
          name: product.name,
          image: product.image,
          basePrice: product.price,
          quantity,
          note,
          customizations: cs,
        },
        activeRestaurant
          ? {
              id: activeRestaurant.id,
              slug: activeRestaurant.slug,
              name: activeRestaurant.name,
            }
          : undefined,
      );
      toast.success("Adicionado ao carrinho");
    }
    onClose();
  };

  return (
    <AdaptiveSheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={product.name}
      size="lg"
    >
      <div className="relative shrink-0 overflow-hidden rounded-t-2xl bg-muted">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="block aspect-[16/10] w-full object-cover"
          />
        ) : (
          <div className="aspect-[16/10] w-full bg-muted" />
        )}
      </div>

      <div
        ref={scrollRef}
        onScroll={(e) => setScrolled((e.currentTarget as HTMLDivElement).scrollTop > 4)}
        className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pt-6 pb-28 sm:px-7 sm:pb-24"
      >
        <div className="space-y-2.5">
          <h2 className="text-2xl font-bold leading-tight text-foreground">{product.name}</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            {product.description}
          </p>
          <div className="text-xl font-bold tabular-nums text-foreground">
            {brl(product.price)}
          </div>
        </div>

        {groups.map((g, gi) => {
          const selected = selections[g.id] ?? [];
          const showError = triedSubmit && !isGroupValid(g);
          const current = selected.length;
          return (
            <section key={g.id} data-group={g.id} className={cn("pt-6", gi > 0 && "mt-6 border-t border-border")}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-base font-bold leading-tight text-foreground">{g.name}</h3>
                  <p className="mt-1 text-xs font-medium text-muted-foreground">
                    {g.min === g.max
                      ? g.min === 1
                        ? "Escolha 1 opção"
                        : `Escolha ${g.min}`
                      : g.min === 0
                        ? `Até ${g.max}`
                        : `De ${g.min} a ${g.max}`}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <ProductBadgePill kind={g.required ? "required" : "optional"} />
                  <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
                    {current}/{g.max}
                  </span>
                </div>
              </div>
              <div className="mt-4 space-y-2.5">
                {g.options.map((opt) => {
                  const active = selected.some((c) => c.optionId === opt.id);
                  const isRadio = g.max === 1;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        toggleOption(
                          g.id,
                          {
                            groupId: g.id,
                            groupName: g.name,
                            optionId: opt.id,
                            optionName: opt.name,
                            priceDelta: opt.priceDelta,
                          },
                          g.max,
                        )
                      }
                      className={cn(
                        "flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3 text-left transition-all",
                        active
                          ? "border-primary bg-primary-soft shadow-[var(--shadow-card)] ring-2 ring-primary/20"
                          : "border-border bg-card hover:border-primary/40 hover:bg-surface",
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className={cn(
                            "grid h-5 w-5 shrink-0 place-items-center border-2 transition-colors",
                            isRadio ? "rounded-full" : "rounded-md",
                            active
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-background",
                          )}
                        >
                          {active ? (
                            isRadio ? (
                              <span className="h-2.5 w-2.5 rounded-full bg-primary-foreground" />
                            ) : (
                              <Check className="h-3 w-3" strokeWidth={3} />
                            )
                          ) : null}
                        </span>
                        <span
                          className={cn(
                            "truncate text-[15px] leading-5",
                            active ? "font-semibold text-foreground" : "text-foreground",
                          )}
                        >
                          {opt.name}
                        </span>
                      </div>
                      {opt.priceDelta > 0 ? (
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-primary">
                          + {brl(opt.priceDelta)}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              {showError ? (
                <p className="mt-2 text-xs font-medium text-destructive">
                  {g.min === g.max
                    ? `Selecione ${g.min} opção${g.min > 1 ? "es" : ""}.`
                    : `Selecione entre ${g.min} e ${g.max} opções.`}
                </p>
              ) : null}
            </section>
          );
        })}

        <section className={cn("pt-6", groups.length > 0 && "mt-6 border-t border-border")}>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
              <MessageSquareText className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <label className="text-base font-bold leading-tight text-foreground">Detalhes do pedido</label>
                <ProductBadgePill kind="optional" />
              </div>
              <p className="mt-1 text-xs font-medium text-muted-foreground">
                Informe preferências para a cozinha.
              </p>
            </div>
          </div>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            placeholder="Ex: sem cebola, molho à parte, ponto da carne..."
            className="mt-4 min-h-24 resize-none rounded-2xl border-border bg-card text-sm leading-6 shadow-none focus-visible:ring-2 focus-visible:ring-primary/20"
            rows={4}
          />
          <div className="mt-2 flex justify-end text-[11px] font-medium tabular-nums text-muted-foreground">
            {note.length}/200
          </div>
        </section>
      </div>

      <div
        className={cn(
          "shrink-0 border-t border-border bg-background px-5 py-4 transition-shadow sm:px-7",
          scrolled ? "shadow-[0_-8px_24px_-12px_rgba(15,23,42,0.18)]" : "",
        )}
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
      >
        <div className="flex items-center justify-between gap-3">
          <QuantityStepper value={quantity} onChange={setQuantity} min={1} />
          <Button
            onClick={submit}
            size="lg"
            className="h-12 min-w-0 flex-1 rounded-full px-5 text-base font-semibold shadow-[var(--shadow-elevated)]"
          >
            <span>{editingItem ? "Atualizar" : "Adicionar"}</span>
            <span className="ml-auto tabular-nums">{brl(total)}</span>
          </Button>
        </div>
      </div>
    </AdaptiveSheet>
  );
}
