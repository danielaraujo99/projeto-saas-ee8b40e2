import * as React from "react";
import { createFileRoute, Link, useNavigate, useBlocker } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Bike,
  Building2,
  Check,
  Clock,
  CreditCard,
  Home,
  MapPin,
  Package,
  Pencil,
  Plus,
  QrCode,
  Wallet,
} from "lucide-react";
import { useCart } from "@/store/cart";
import { useAddresses } from "@/store/addresses";
import { useAuth } from "@/store/auth";
import { createOrderRecord } from "@/lib/orders.functions";
import { getDeviceId } from "@/lib/device-id";
import { useCartRestaurant } from "@/lib/use-cart-restaurant";
import { brl } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CouponBox } from "@/components/cart-parts";
import type { Address, PaymentMethod } from "@/types";
import { AuthGate } from "@/components/auth-gate";
import { PaymentPickerSheet } from "@/components/payment-picker-sheet";
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

// Chave de idempotência estável derivada do carrinho: mesmo carrinho no mesmo
// dispositivo sempre gera a mesma chave, garantindo que double-click / retry
// não crie pedidos duplicados.
async function buildIdempotencyKey(input: {
  deviceId: string;
  items: unknown;
  total: number;
  payment: unknown;
  pickup: boolean;
}): Promise<string> {
  const payload = JSON.stringify({
    d: input.deviceId,
    i: input.items,
    t: input.total,
    p: input.payment,
    k: input.pickup,
  });
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 40);
  }
  // Fallback simples caso subtle não esteja disponível.
  let h = 0;
  for (let i = 0; i < payload.length; i++) h = (h * 31 + payload.charCodeAt(i)) | 0;
  return `k-${input.deviceId.slice(0, 8)}-${Math.abs(h)}`;
}

import { toast } from "sonner";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Finalizar pedido — MenuAtlas" },
      { name: "description", content: "Escolha entrega, pagamento e revise seu pedido." },
      { property: "og:title", content: "Finalizar pedido — MenuAtlas" },
      { property: "og:description", content: "Escolha entrega, pagamento e revise seu pedido." },
    ],
  }),
  component: CheckoutPage,
});

type Step = "delivery" | "payment" | "review";

function CheckoutPage() {
  const user = useAuth((s) => s.user);
  const items = useCart((s) => s.items);
  const itemCount = useCart((s) => s.itemCount());
  const subtotal = useCart((s) => s.subtotal());
  const discount = useCart((s) => s.discount());
  const coupon = useCart((s) => s.coupon);
  const cartRestaurantId = useCart((s) => s.restaurantId);
  const cartRestaurantSlug = useCart((s) => s.restaurantSlug);
  const clear = useCart((s) => s.clear);
  const addresses = useAddresses((s) => s.addresses);
  const selectedId = useAddresses((s) => s.selectedId);
  const select = useAddresses((s) => s.select);
  
  const nav = useNavigate();
  const createOrderRecordFn = useServerFn(createOrderRecord);

  const [authOpen, setAuthOpen] = React.useState(!user);
  React.useEffect(() => {
    if (!user) setAuthOpen(true);
  }, [user]);

  const [step, setStep] = React.useState<Step>("delivery");
  const [pickup, setPickup] = React.useState(false);
  const [payment, setPayment] = React.useState<PaymentMethod>({ kind: "pix" });
  const [placing, setPlacing] = React.useState(false);
  const [confirmLeave, setConfirmLeave] = React.useState(false);
  const orderCreatedRef = React.useRef(false);

  const { restaurant } = useCartRestaurant();
  const deliveryFee = restaurant?.deliveryFee ?? 0;
  const [minEta, maxEta] = restaurant?.deliveryMinutes ?? [0, 40];
  const isOpen = restaurant?.isOpen ?? true;

  const fee = pickup ? 0 : deliveryFee;
  const total = Math.max(0, subtotal - discount) + fee;
  const selectedAddress =
    addresses.find((a) => a.id === selectedId) ??
    addresses.find((a) => a.isDefault) ??
    addresses[0];
  const etaMax = pickup ? 20 : maxEta;
  const etaMin = pickup ? 15 : minEta;

  React.useEffect(() => {
    if (items.length === 0 && !orderCreatedRef.current) nav({ to: "/demo" });
  }, [items.length]);

  React.useEffect(() => {
    if (!isOpen && items.length > 0 && !orderCreatedRef.current) {
      toast.error("Restaurante fechado no momento", {
        description: "Você pode finalizar assim que reabrir.",
      });
      nav({ to: "/carrinho" });
    }
  }, [items.length, nav, isOpen]);

  // Block navigating away from checkout while the cart still has items (except
  // when we've just placed the order and are heading to /pagamento).
  const { proceed, reset, status } = useBlocker({
    shouldBlockFn: () => items.length > 0 && !orderCreatedRef.current && !placing,
    withResolver: true,
    enableBeforeUnload: () => items.length > 0 && !orderCreatedRef.current,
  });
  React.useEffect(() => {
    if (status === "blocked") setConfirmLeave(true);
  }, [status]);


  const canAdvance =
    step === "delivery" ? pickup || !!selectedAddress : step === "payment" ? true : true;

  const placeOrder = async () => {
    if (!pickup && !selectedAddress) return toast.error("Escolha um endereço de entrega.");
    if (!cartRestaurantId && !cartRestaurantSlug) {
      toast.error("Restaurante não identificado", {
        description: "Reabra o cardápio do restaurante e adicione os itens novamente.",
      });
      return;
    }
    setPlacing(true);
    try {
      // Chave de idempotência: um mesmo carrinho/valor/pagamento no mesmo
      // dispositivo NÃO deve gerar dois pedidos por cliques repetidos.
      const idempotencyKey = await buildIdempotencyKey({
        deviceId: getDeviceId(),
        items,
        total,
        payment,
        pickup,
      });
      const order = await createOrderRecordFn({
        data: {
          deviceId: getDeviceId(),
          items,
          subtotal,
          deliveryFee: fee,
          discount,
          total,
          couponCode: coupon?.code,
          address: pickup ? undefined : selectedAddress,
          pickup,
          payment,
          etaMinutes: etaMax,
          restaurantId: cartRestaurantId,
          restaurantSlug: cartRestaurantSlug,
          idempotencyKey,
        },
      });


      const orderId = typeof order.id === "string" ? order.id : null;
      if (!orderId) throw new Error("Pedido criado sem identificador.");
      orderCreatedRef.current = true;
      clear();
      nav({ to: "/pagamento/$id", params: { id: orderId }, replace: true });
    } catch (e) {
      console.error(e);
      toast.error("Falha de conexão", {
        description: "Não foi possível criar o pedido. Verifique sua internet e tente novamente.",
        action: { label: "Tentar de novo", onClick: () => placeOrder() },
      });
      setPlacing(false);
    }

  };

  const primaryLabel =
    step === "review" ? (placing ? "Confirmando…" : "Confirmar pedido") : "Continuar";
  const primaryAction = step === "review" ? placeOrder : () =>
    setStep(step === "delivery" ? "payment" : "review");
  const primaryDisabled = step === "review" ? placing : !canAdvance;

  return (
    <div
      className="min-h-screen bg-background"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 6.5rem)" }}
    >
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            to="/carrinho"
            aria-label="Voltar"
            className="grid h-10 w-10 place-items-center rounded-full hover:bg-surface"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold">Finalizar pedido</h1>
            <p className="truncate text-[11px] text-foreground/55">
              {itemCount} {itemCount === 1 ? "item" : "itens"} · previsão {etaMin}–{etaMax} min
            </p>
          </div>
        </div>
        <Stepper step={step} />
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section>
          {step === "delivery" ? (
            <DeliveryStep
              pickup={pickup}
              setPickup={setPickup}
              addresses={addresses}
              selectedId={selectedAddress?.id}
              onSelect={select}
            />
          ) : step === "payment" ? (
            <PaymentStep payment={payment} setPayment={setPayment} />
          ) : (
            <ReviewStep
              pickup={pickup}
              address={selectedAddress}
              payment={payment}
              etaMin={etaMin}
              etaMax={etaMax}
              itemCount={itemCount}
              items={items}
            />
          )}
        </section>

        <aside>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] lg:sticky lg:top-[130px]">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold">Resumo</h3>
              <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary tabular-nums">
                {itemCount} {itemCount === 1 ? "item" : "itens"}
              </span>
            </div>
            <ul className="mb-3 max-h-56 space-y-1.5 overflow-y-auto pr-1 text-sm">
              {items.map((it) => (
                <li key={it.id} className="flex justify-between gap-3">
                  <span className="line-clamp-1 text-foreground/80">
                    <span className="tabular-nums text-foreground/55">{it.quantity}×</span>{" "}
                    {it.name}
                  </span>
                  <span className="shrink-0 tabular-nums text-foreground">
                    {brl(it.unitPrice * it.quantity)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mb-3">
              <CouponBox />
            </div>
            <div className="space-y-1.5 border-t border-border pt-3 text-sm">
              <Row label="Subtotal" value={brl(subtotal)} />
              {discount > 0 ? (
                <Row label="Desconto" value={`- ${brl(discount)}`} tone="success" />
              ) : null}
              <Row label={pickup ? "Retirada" : "Entrega"} value={brl(fee)} />
              <div className="border-t border-border pt-2">
                <Row bold label="Total" value={brl(total)} />
              </div>
              <div className="flex items-center gap-1.5 pt-1 text-[11px] text-foreground/55">
                <Clock className="h-3 w-3" /> Previsão de {etaMin}–{etaMax} min
              </div>
            </div>
          </div>
        </aside>
      </main>

      {/* Fixed bottom action bar */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-wide text-foreground/55">Total</div>
            <div className="whitespace-nowrap text-lg font-bold tabular-nums text-foreground">
              {brl(total)}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="lg"
              className="h-12 rounded-full px-6 text-base font-semibold"
              disabled={primaryDisabled}
              onClick={primaryAction}
            >
              {primaryLabel}
            </Button>
          </div>

        </div>
      </div>

      <AuthGate
        open={authOpen}
        onOpenChange={(o) => {
          setAuthOpen(o);
          if (!o && !user) nav({ to: "/carrinho" });
        }}
        onSuccess={() => setAuthOpen(false)}
      />

      <AlertDialog
        open={confirmLeave}
        onOpenChange={(o) => {
          if (!o) {
            setConfirmLeave(false);
            reset?.();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair do checkout?</AlertDialogTitle>
            <AlertDialogDescription>
              Seu carrinho será mantido, mas você perderá o progresso desta finalização.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setConfirmLeave(false);
                reset?.();
              }}
            >
              Continuar aqui
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmLeave(false);
                proceed?.();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sair
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>

  );
}

function Row({
  label,
  value,
  bold,
  tone,
}: {
  label: string;
  value: string;
  bold?: boolean;
  tone?: "success";
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? "font-semibold text-foreground" : "text-foreground/60"}>
        {label}
      </span>
      <span
        className={
          "tabular-nums " +
          (bold ? "text-base font-bold text-foreground " : "text-foreground ") +
          (tone === "success" ? "text-success" : "")
        }
      >
        {value}
      </span>
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: "delivery", label: "Entrega" },
    { id: "payment", label: "Pagamento" },
    { id: "review", label: "Revisão" },
  ];
  const idx = steps.findIndex((s) => s.id === step);
  return (
    <div className="mx-auto max-w-5xl px-4 pb-3 sm:px-6">
      <ol className="flex items-center gap-2 text-xs font-semibold">
        {steps.map((s, i) => {
          const active = i === idx;
          const done = i < idx;
          return (
            <li key={s.id} className="flex flex-1 items-center gap-2">
              <span
                className={cn(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] transition-colors",
                  done
                    ? "bg-primary text-primary-foreground"
                    : active
                      ? "bg-primary text-primary-foreground ring-4 ring-primary-soft"
                      : "bg-surface text-foreground/50",
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span
                className={cn(
                  "hidden sm:inline",
                  active || done ? "text-foreground" : "text-foreground/50",
                )}
              >
                {s.label}
              </span>
              {i < steps.length - 1 ? (
                <span
                  className={cn(
                    "h-px flex-1 transition-colors",
                    done ? "bg-primary" : "bg-border",
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function DeliveryStep({
  pickup,
  setPickup,
  addresses,
  selectedId,
  onSelect,
}: {
  pickup: boolean;
  setPickup: (v: boolean) => void;
  addresses: Address[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const { restaurant: r } = useCartRestaurant();
  const [dMin, dMax] = r?.deliveryMinutes ?? [0, 40];
  const fee = r?.deliveryFee ?? 0;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setPickup(false)}
          className={cn(
            "flex flex-col items-start gap-1 rounded-2xl border p-4 text-left transition-all",
            !pickup
              ? "border-primary bg-primary-soft shadow-[var(--shadow-card)]"
              : "border-border bg-card hover:border-primary/30 hover:bg-surface",
          )}
        >
          <Bike className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold">Entrega</span>
          <span className="text-xs text-foreground/55">
            {dMin}–{dMax} min · {fee > 0 ? brl(fee) : "Grátis"}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setPickup(true)}
          className={cn(
            "flex flex-col items-start gap-1 rounded-2xl border p-4 text-left transition-all",
            pickup
              ? "border-primary bg-primary-soft shadow-[var(--shadow-card)]"
              : "border-border bg-card hover:border-primary/30 hover:bg-surface",
          )}
        >
          <Building2 className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold">Retirar no local</span>
          <span className="text-xs text-foreground/55">Pronto em ~20 min · sem taxa</span>
        </button>
      </div>

      {!pickup ? (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Endereço de entrega</h3>
            <Link
              to="/enderecos/novo"
              className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary-soft"
            >
              <Plus className="h-3.5 w-3.5" /> Novo
            </Link>
          </div>
          {addresses.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-foreground/60">
              Nenhum endereço cadastrado.
              <div className="mt-3">
                <Link
                  to="/enderecos/novo"
                  className="inline-flex h-10 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground"
                >
                  Cadastrar endereço
                </Link>
              </div>
            </div>
          ) : (
            <ul className="space-y-2">
              {addresses.map((a) => {
                const active = a.id === selectedId;
                const Icon = a.kind === "home" ? Home : a.kind === "work" ? Building2 : MapPin;
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(a.id)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all",
                        active
                          ? "border-primary bg-primary-soft"
                          : "border-border bg-background hover:border-primary/30 hover:bg-surface",
                      )}
                    >
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-background text-primary ring-1 ring-border">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1 text-sm">
                        <div className="font-semibold">
                          {a.label ||
                            (a.kind === "home"
                              ? "Casa"
                              : a.kind === "work"
                                ? "Trabalho"
                                : "Outro")}
                        </div>
                        <div className="text-foreground/60">
                          {a.street}, {a.number} — {a.neighborhood}
                        </div>
                      </div>
                      {active ? <Check className="h-5 w-5 text-primary" /> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <Link
            to="/enderecos"
            className="mt-3 block text-center text-xs font-semibold text-primary hover:underline"
          >
            Gerenciar endereços
          </Link>
        </div>
      ) : (
        <PickupInfo />
      )}
    </div>
  );
}

function PickupInfo() {
  const { restaurant } = useCartRestaurant();
  const p = restaurant?.pickupAddress;
  const [name, setName] = React.useState("");
  const eta = React.useMemo(() => {
    const d = new Date(Date.now() + 20 * 60 * 1000);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }, []);
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Retirada no restaurante</h3>
        <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-semibold text-primary">
          Sem taxa
        </span>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-border bg-background p-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary ring-1 ring-border">
          <MapPin className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 text-sm">
          <div className="font-semibold">{restaurant?.name ?? "Restaurante"}</div>
          {p ? (
            <>
              <div className="text-foreground/70">
                {p.street}, {p.number} — {p.neighborhood}
              </div>
              <div className="text-foreground/55">
                {p.city} · {p.state}
              </div>
              {p.reference ? (
                <div className="mt-1 text-xs text-foreground/55">Ref.: {p.reference}</div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex items-start gap-3 rounded-xl border border-border bg-background p-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary ring-1 ring-border">
          <Clock className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 text-sm">
          <div className="font-semibold">Pronto por volta das {eta}</div>
          <div className="text-foreground/60">
            Tempo estimado de preparo: 15–20 min após a confirmação
          </div>
        </div>
      </div>

      <div className="mt-3">
        <label htmlFor="pickup-name" className="mb-1.5 block text-xs font-semibold text-foreground/70">
          Nome para retirada <span className="font-normal text-foreground/50">(opcional)</span>
        </label>
        <Input
          id="pickup-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Ana Souza"
          maxLength={60}
        />
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-xl bg-primary-soft/60 px-3 py-2.5 text-xs text-foreground/70">
        <Package className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p>
          Ao chegar, apresente o <strong className="font-semibold text-foreground">número do pedido</strong> no
          balcão para receber sua sacola.
        </p>
      </div>
    </div>
  );
}

function PaymentStep({
  payment,
  setPayment,
}: {
  payment: PaymentMethod;
  setPayment: (p: PaymentMethod) => void;
}) {
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [changeFor, setChangeFor] = React.useState("");

  const summary = paymentSummary(payment);

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Forma de pagamento</h3>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="flex w-full items-center gap-3 rounded-2xl border-2 border-primary bg-primary-soft px-4 py-3.5 text-left ring-2 ring-primary/20 transition-all hover:brightness-[0.98]"
        >
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-background text-primary shadow-[var(--shadow-card)]">
            {summary.icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-foreground">{summary.title}</div>
            <div className="truncate text-xs text-foreground/60">{summary.subtitle}</div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-background px-3 py-1.5 text-xs font-semibold text-primary shadow-[var(--shadow-card)]">
            <Pencil className="h-3.5 w-3.5" /> Alterar
          </span>
        </button>

        {payment.kind === "cash" ? (
          <div className="mt-4 space-y-2">
            <label className="text-xs font-semibold text-foreground/70">
              Troco para (opcional)
            </label>
            <Input
              inputMode="decimal"
              placeholder="Ex: R$ 50,00"
              value={changeFor}
              onChange={(e) => {
                setChangeFor(e.target.value);
                const n = Number(e.target.value.replace(",", "."));
                setPayment({ kind: "cash", change: isNaN(n) ? undefined : n });
              }}
            />
            <p className="text-[11px] text-foreground/55">
              Deixe em branco se não precisar de troco.
            </p>
          </div>
        ) : null}

        <p className="mt-3 text-[11px] leading-relaxed text-foreground/55">
          {payment.kind === "pix"
            ? "O QR Code e a chave Pix serão exibidos após a confirmação do pedido."
            : payment.kind === "cash"
              ? "O pagamento é realizado ao entregador no momento da entrega."
              : "O valor será cobrado no cartão selecionado após a confirmação."}
        </p>
      </div>

      <PaymentPickerSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        value={payment}
        onChange={setPayment}
      />
    </div>
  );
}

function paymentSummary(p: PaymentMethod): {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
} {
  if (p.kind === "pix")
    return { icon: <QrCode className="h-5 w-5" />, title: "Pix", subtitle: "Aprovação instantânea" };
  if (p.kind === "cash")
    return {
      icon: <Wallet className="h-5 w-5" />,
      title: "Dinheiro na entrega",
      subtitle: p.change ? `Troco para ${brl(p.change)}` : "Sem troco",
    };
  return {
    icon: <CreditCard className="h-5 w-5" />,
    title: p.kind === "credit" ? "Cartão de crédito" : "Cartão de débito",
    subtitle: `${p.brand} •••• ${p.last4}`,
  };
}

function ReviewStep({
  pickup,
  address,
  payment,
  etaMin,
  etaMax,
  itemCount,
  items,
}: {
  pickup: boolean;
  address?: Address;
  payment: PaymentMethod;
  etaMin: number;
  etaMax: number;
  itemCount: number;
  items: ReturnType<typeof useCart.getState>["items"];
}) {
  const payLabel =
    payment.kind === "pix"
      ? "Pix"
      : payment.kind === "cash"
        ? `Dinheiro${payment.change ? ` (troco para ${brl(payment.change)})` : ""}`
        : `${payment.kind === "credit" ? "Crédito" : "Débito"} · ${payment.brand} •••• ${payment.last4}`;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-primary-soft text-primary">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-foreground/55">
              {pickup ? "Retirada em" : "Chega em"}
            </div>
            <div className="text-lg font-bold tabular-nums text-foreground">
              {etaMin}–{etaMax} min
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-foreground/70">
            <Package className="h-3.5 w-3.5" />
            {itemCount} {itemCount === 1 ? "item" : "itens"}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
        <h3 className="mb-2 text-sm font-semibold">
          {pickup ? "Retirada no local" : "Endereço de entrega"}
        </h3>
        {pickup ? (
          <p className="text-sm text-foreground/70">
            Retire seu pedido no balcão do restaurante em ~20 min.
          </p>
        ) : address ? (
          <p className="text-sm text-foreground/80">
            <span className="font-medium text-foreground">
              {address.street}, {address.number}
            </span>
            {address.complement ? ` — ${address.complement}` : ""}
            <br />
            <span className="text-foreground/55">
              {address.neighborhood} · {address.city}/{address.state}
            </span>
          </p>
        ) : (
          <p className="text-sm text-destructive">Nenhum endereço selecionado.</p>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
        <h3 className="mb-2 text-sm font-semibold">Forma de pagamento</h3>
        <p className="text-sm text-foreground/80">{payLabel}</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
        <h3 className="mb-3 text-sm font-semibold">Seus itens</h3>
        <ul className="space-y-2 text-sm">
          {items.map((it) => (
            <li key={it.id} className="flex justify-between gap-3">
              <span className="line-clamp-1 text-foreground/80">
                <span className="tabular-nums text-foreground/55">{it.quantity}×</span> {it.name}
              </span>
              <span className="shrink-0 tabular-nums text-foreground">
                {brl(it.unitPrice * it.quantity)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-foreground/55">
        Ao confirmar, o pedido é enviado ao restaurante e você pode acompanhar em tempo real.
      </p>
    </div>
  );
}
