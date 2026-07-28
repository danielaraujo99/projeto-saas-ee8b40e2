import * as React from "react";
import { Link } from "@tanstack/react-router";
import { Pencil, Trash2, Copy } from "lucide-react";
import { useCart } from "@/store/cart";
import { QuantityStepper } from "@/components/quantity-stepper";
import { brl } from "@/lib/format";
import type { CartItem, Product } from "@/types";
import { useMenu } from "@/components/menu-context";
import { restaurant } from "@/data/restaurant";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

type LinesProps = {
  onEdit: (item: CartItem, product: Product | undefined) => void;
};

export function CartLines({ onEdit }: LinesProps) {
  const items = useCart((s) => s.items);
  const setQuantity = useCart((s) => s.setQuantity);
  const removeItem = useCart((s) => s.removeItem);
  const duplicateItem = useCart((s) => s.duplicateItem);
  const [confirmRemove, setConfirmRemove] = React.useState<CartItem | null>(null);

  const doRemove = () => {
    if (!confirmRemove) return;
    removeItem(confirmRemove.id);
    toast.success("Item removido do carrinho");
    setConfirmRemove(null);
  };

  return (
    <>
      <ul className="divide-y divide-border">
        {items.map((it) => {
          const product = productById(it.productId);
          return (
            <li key={it.id} className="flex gap-3 py-4">
              {it.image ? (
                <img
                  src={it.image}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="h-16 w-16 shrink-0 rounded-lg bg-muted" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="line-clamp-1 text-sm font-semibold">{it.name}</h4>
                  <span className="shrink-0 text-sm font-bold tabular-nums">
                    {brl(it.unitPrice * it.quantity)}
                  </span>
                </div>
                {it.customizations.length > 0 ? (
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {it.customizations.map((c) => c.optionName).join(" · ")}
                  </p>
                ) : null}
                {it.note ? (
                  <p className="mt-0.5 line-clamp-1 text-xs italic text-muted-foreground">
                    Obs: {it.note}
                  </p>
                ) : null}
                <div className="mt-2 flex items-center justify-between">
                  <QuantityStepper
                    value={it.quantity}
                    onChange={(q) => {
                      if (q <= 0) return setConfirmRemove(it);
                      setQuantity(it.id, q);
                    }}
                    size="sm"
                  />
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <button
                      onClick={() => onEdit(it, product)}
                      className="grid h-8 w-8 place-items-center rounded-full hover:bg-surface hover:text-foreground"
                      aria-label="Editar"
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        duplicateItem(it.id);
                        toast.success("Item duplicado");
                      }}
                      className="grid h-8 w-8 place-items-center rounded-full hover:bg-surface hover:text-foreground"
                      aria-label="Duplicar"
                      title="Duplicar"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setConfirmRemove(it)}
                      className="grid h-8 w-8 place-items-center rounded-full hover:bg-surface hover:text-destructive"
                      aria-label="Remover"
                      title="Remover"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <AlertDialog open={!!confirmRemove} onOpenChange={(o) => !o && setConfirmRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover este item?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmRemove
                ? `“${confirmRemove.name}” será removido do carrinho. Você pode adicioná-lo novamente a qualquer momento.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter</AlertDialogCancel>
            <AlertDialogAction
              onClick={doRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}


export function CouponBox() {
  const coupon = useCart((s) => s.coupon);
  const applyCoupon = useCart((s) => s.applyCoupon);
  const removeCoupon = useCart((s) => s.removeCoupon);
  const [code, setCode] = React.useState("");
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);

  const apply = () => {
    const res = applyCoupon(code);
    setMsg({ ok: res.ok, text: res.message });
    if (res.ok) toast.success("Cupom aplicado com sucesso");
  };

  if (coupon) {
    return (
      <div className="flex items-center justify-between rounded-xl bg-primary-soft px-3 py-2.5 text-sm">
        <div>
          <div className="font-semibold text-primary">{coupon.code}</div>
          <div className="text-xs text-muted-foreground">{coupon.description}</div>
        </div>
        <button
          onClick={() => {
            removeCoupon();
            setMsg(null);
            setCode("");
          }}
          className="rounded-full px-3 py-1 text-xs font-semibold text-primary hover:bg-background"
        >
          Remover
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Cupom de desconto"
          className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
        />
        <button
          onClick={apply}
          disabled={!code.trim()}
          className="h-10 rounded-lg border border-primary px-4 text-sm font-semibold text-primary hover:bg-primary-soft disabled:opacity-40"
        >
          Aplicar
        </button>
      </div>
      {msg ? (
        <p className={`mt-1 text-xs ${msg.ok ? "text-success" : "text-destructive"}`}>
          {msg.text}
        </p>
      ) : null}
    </div>
  );
}

export function OrderSummary({
  showCheckoutCta = true,
}: {
  showCheckoutCta?: boolean;
}) {
  const subtotal = useCart((s) => s.subtotal());
  const discount = useCart((s) => s.discount());
  const fee = restaurant.deliveryFee;
  const total = Math.max(0, subtotal - discount) + fee;

  return (
    <div className="space-y-2 text-sm">
      <Row label="Subtotal" value={brl(subtotal)} />
      {discount > 0 ? (
        <Row label="Desconto" value={`- ${brl(discount)}`} accent="success" />
      ) : null}
      <Row label="Taxa de entrega" value={brl(fee)} />
      <div className="border-t border-border pt-2">
        <Row label="Total" value={brl(total)} bold />
      </div>
      {showCheckoutCta ? (
        <Link
          to="/checkout"
          className="mt-3 flex h-12 items-center justify-center rounded-full bg-primary px-5 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Ir para o pagamento
        </Link>
      ) : null}
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  accent,
}: {
  label: string;
  value: string;
  bold?: boolean;
  accent?: "success";
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? "font-semibold text-foreground" : "text-muted-foreground"}>
        {label}
      </span>
      <span
        className={
          "tabular-nums " +
          (bold ? "text-base font-bold text-foreground " : "") +
          (accent === "success" ? "text-success" : "")
        }
      >
        {value}
      </span>
    </div>
  );
}
