import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ShoppingBag, AlertTriangle } from "lucide-react";
import { useCart } from "@/store/cart";
import { CartLines, CouponBox, OrderSummary } from "@/components/cart-parts";
import { EmptyState } from "@/components/empty-state";
import { ProductSheet } from "@/components/product-sheet";
import type { Product } from "@/types";
import { useAuth } from "@/store/auth";
import { AuthGate } from "@/components/auth-gate";
import { useCartRestaurant } from "@/lib/use-cart-restaurant";
import { brl } from "@/lib/format";
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

export const Route = createFileRoute("/carrinho")({
  head: () => ({
    meta: [
      { title: "Seu carrinho — MenuAtlas" },
      { name: "description", content: "Revise seu pedido antes de finalizar." },
      { property: "og:title", content: "Seu carrinho — MenuAtlas" },
      { property: "og:description", content: "Revise seu pedido antes de finalizar." },
    ],
  }),
  component: CarrinhoPage,
});

function CarrinhoPage() {
  const items = useCart((s) => s.items);
  const subtotal = useCart((s) => s.subtotal());
  const discount = useCart((s) => s.discount());
  const [editing, setEditing] = React.useState<Product | null>(null);
  const [authOpen, setAuthOpen] = React.useState(false);
  const [minOpen, setMinOpen] = React.useState(false);
  const [closedOpen, setClosedOpen] = React.useState(false);
  const user = useAuth((s) => s.user);
  const navigate = useNavigate();
  const { restaurant } = useCartRestaurant();
  const minimumOrder = restaurant?.minimumOrder ?? 0;
  const isOpen = restaurant?.isOpen ?? true;

  const effectiveSubtotal = Math.max(0, subtotal - discount);
  const missingForMin = Math.max(0, minimumOrder - effectiveSubtotal);

  const goCheckout = () => {
    if (!isOpen) return setClosedOpen(true);
    if (missingForMin > 0) return setMinOpen(true);
    if (!user) return setAuthOpen(true);
    navigate({ to: "/checkout" });
  };



  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
            <Link
            to="/demo"
            aria-label="Voltar"
            className="grid h-10 w-10 place-items-center rounded-full hover:bg-surface"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-bold">Seu carrinho</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4 pb-36 sm:px-6">
        {items.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag className="h-6 w-6" />}
            title="Seu carrinho está vazio"
            description="Volte ao cardápio e adicione seus itens favoritos."
            action={
              <Link
                to="/demo"
                className="inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
              >
                Explorar cardápio
              </Link>
            }
            className="my-12"
          />
        ) : (
          <>
            <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
              <CartLines onEdit={(_it, p) => p && setEditing(p)} />
            </div>

            <div className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
              <h3 className="mb-2 text-sm font-semibold">Cupom</h3>
              <CouponBox />
            </div>

            <div className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
              <OrderSummary showCheckoutCta={false} />
              <button
                onClick={goCheckout}
                className="mt-3 flex h-12 w-full items-center justify-center rounded-full bg-primary text-base font-semibold text-primary-foreground transition-colors hover:opacity-95"
              >
                Ir para o pagamento
              </button>
            </div>
          </>
        )}
      </main>

      <ProductSheet product={editing} onClose={() => setEditing(null)} />
      <AuthGate open={authOpen} onOpenChange={setAuthOpen} />

      <AlertDialog open={minOpen} onOpenChange={setMinOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-warning/15 text-warning">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <AlertDialogTitle className="text-center">
              Pedido mínimo não atingido
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Este restaurante exige um pedido mínimo de{" "}
              <span className="font-semibold text-foreground">
                {brl(minimumOrder)}
              </span>
              . Faltam <span className="font-semibold text-foreground">{brl(missingForMin)}</span>{" "}
              para finalizar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar comprando</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate({ to: "/demo" })}>
              Ver cardápio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={closedOpen} onOpenChange={setClosedOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-warning/15 text-warning">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <AlertDialogTitle className="text-center">
              Restaurante fechado
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              O restaurante não está aceitando pedidos no momento. Seus itens ficam salvos no carrinho e você poderá finalizar assim que reabrir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Entendi</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate({ to: "/demo" })}>
              Ver cardápio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

