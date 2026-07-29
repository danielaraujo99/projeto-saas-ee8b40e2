import * as React from "react";
import { createFileRoute, Link, Outlet, useParams, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShoppingBag } from "lucide-react";
import { fetchRestaurantDisplay } from "@/lib/storefront";
import { useCart } from "@/store/cart";

import {
  ArrowLeft,
  Bike,
  ChefHat,
  Check,
  CheckCircle2,
  ChevronDown,
  MapPin,
  MessageCircle,
  PackageCheck,
  Phone,
  RefreshCw,
  TimerOff,
  Star,
  WifiOff,
} from "lucide-react";
import { getOrderById } from "@/lib/orders-api";
import { statusLabel, TIMELINE, type OrderStatus } from "@/lib/order-status";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { brl } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getPixSession, isPixExpired } from "@/lib/pix-session";
import type { OrderRow } from "@/lib/orders-api";

export const Route = createFileRoute("/pedido/$id")({
  head: () => ({
    meta: [
      { title: "Acompanhamento do pedido — MenuAtlas" },
      { name: "description", content: "Acompanhe o status do seu pedido em tempo real." },
      { property: "og:title", content: "Acompanhamento do pedido — MenuAtlas" },
      { property: "og:description", content: "Acompanhe o status do seu pedido em tempo real." },
    ],
  }),
  component: Page,
});

const icons: Record<OrderStatus, React.ComponentType<{ className?: string }>> = {
  pending_payment: CheckCircle2,
  received: CheckCircle2,
  preparing: ChefHat,
  delivering: Bike,
  delivered: PackageCheck,
};

// Elapsed thresholds mirror lib/order-status THRESHOLDS to derive per-step timestamps.
const STEP_OFFSETS_MS: Record<OrderStatus, number> = {
  pending_payment: 0,
  received: 0,
  preparing: 20_000,
  delivering: 60_000,
  delivered: 150_000,
};

function formatTime(d: Date) {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function Page() {
  const { id } = useParams({ from: "/pedido/$id" });
  const nav = useNavigate();

  const { data: order, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["order", id],
    queryFn: () => getOrderById(id),
    refetchInterval: 5000,
    retry: 1,
  });

  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => {
    const t = setInterval(force, 1000);
    return () => clearInterval(t);
  }, []);

  if (isLoading) {
    return <OrderTrackingSkeleton />;
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
          <EmptyState
            icon={<WifiOff className="h-6 w-6" />}
            title="Falha de conexão"
            description="Não conseguimos carregar seu pedido. Verifique sua internet e tente de novo."
            action={
              <Button
                onClick={() => refetch()}
                disabled={isFetching}
                className="h-11 rounded-full px-5 text-sm font-semibold"
              >
                <RefreshCw className={cn("mr-2 h-4 w-4", isFetching && "animate-spin")} />
                Tentar novamente
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
          <EmptyState
            icon={<PackageCheck className="h-6 w-6" />}
            title="Pedido não encontrado"
            description="Pode ter sido removido ou o link está incorreto."
            action={
              <Link
                to="/demo"
                className="inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
              >
                Voltar ao cardápio
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  if (order.status === "pending_payment" && isPixExpired(getPixSession(order.id))) {
    return <FinishedOrderView order={order} canceled />;
  }

  if (order.status === "delivered") {
    return <FinishedOrderView order={order} />;
  }




  const currentIdx = TIMELINE.indexOf(order.status as OrderStatus);
  const paymentAt = order.payment_confirmed_at ? new Date(order.payment_confirmed_at) : null;
  const startAt = paymentAt?.getTime() ?? new Date(order.created_at).getTime();
  const elapsedMin = Math.floor((Date.now() - startAt) / 60000);
  const etaLeft = Math.max(0, order.eta_minutes - elapsedMin);

  // Progress ratio (0..1) inside current segment for animated fill between prev and current step.
  const currentOffset = STEP_OFFSETS_MS[order.status as OrderStatus] ?? 0;
  const nextStep = TIMELINE[currentIdx + 1];
  const nextOffset = nextStep ? STEP_OFFSETS_MS[nextStep] : currentOffset;
  const segmentSpan = Math.max(1, nextOffset - currentOffset);
  const segmentElapsed = paymentAt ? Date.now() - paymentAt.getTime() - currentOffset : 0;
  const segmentRatio = Math.max(0, Math.min(1, segmentElapsed / segmentSpan));


  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            to="/pedidos"
            aria-label="Voltar"
            className="grid h-10 w-10 place-items-center rounded-full hover:bg-surface"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-bold">Pedido {order.short_id}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6 sm:px-6">
        {/* HERO STATUS + TIMELINE */}
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
          <div className="border-b border-border/60 bg-gradient-to-b from-primary-soft/60 to-transparent px-5 py-6 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary/80">
              Chegada estimada
            </p>
            <p className="mt-1 text-4xl font-bold tabular-nums text-foreground">
              {etaLeft > 0 ? `${etaLeft} min` : "a qualquer momento"}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              <p className="text-sm font-medium text-primary">
                {statusLabel[order.status as OrderStatus]}
              </p>
            </div>

          </div>

          <ol className="relative px-5 py-6 sm:px-6">
            {TIMELINE.map((s, i) => {
              const Icon = icons[s];
              const active = i === currentIdx && order.status !== "delivered";
              const done = i < currentIdx || order.status === "delivered";
              const isLast = i === TIMELINE.length - 1;
              const stepAt = paymentAt
                ? new Date(paymentAt.getTime() + STEP_OFFSETS_MS[s])
                : null;
              return (
                <li key={s} className="relative flex gap-4 pb-6 last:pb-0">
                  {/* Connector line */}
                  {!isLast && (
                    <span
                      aria-hidden
                      className="absolute left-5 top-10 h-[calc(100%-1.5rem)] w-0.5 rounded-full bg-border"
                    >
                      <span
                        className="block w-full rounded-full bg-primary transition-[height] duration-1000 ease-out"
                        style={{
                          height:
                            done && i < currentIdx
                              ? "100%"
                              : active
                                ? `${segmentRatio * 100}%`
                                : "0%",
                        }}
                      />
                    </span>
                  )}

                  <div
                    className={cn(
                      "relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 transition-colors",
                      done
                        ? "border-primary bg-primary text-primary-foreground"
                        : active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-muted-foreground",
                    )}
                  >
                    {active && (
                      <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-primary/40" />
                    )}
                    {done && !active ? (
                      <Check className="h-5 w-5" strokeWidth={3} />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>

                  <div className="flex-1 pt-1.5">
                    <div
                      className={cn(
                        "text-sm font-semibold leading-tight",
                        done || active ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {statusLabel[s]}
                    </div>
                    {done && stepAt ? (
                      <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                        {formatTime(stepAt)}
                      </div>
                    ) : active ? (
                      <div className="mt-0.5 text-xs font-medium text-primary">Em andamento…</div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* CONTEXTUAL AREA */}
        <ContextualPhase status={order.status as OrderStatus} />

        {/* COURIER CARD (during delivery) */}
        {order.status === "delivering" ? <CourierCard /> : null}

        {/* COLLAPSIBLE ORDER DETAILS */}
        <Collapsible className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
          <CollapsibleTrigger className="group flex w-full items-center justify-between px-5 py-4 text-left hover:bg-surface/40">
            <div>
              <div className="text-sm font-semibold text-foreground">Detalhes do pedido</div>
              <div className="text-xs text-muted-foreground">
                {order.items.reduce((n, i) => n + i.quantity, 0)} itens · {brl(order.total)}
              </div>
            </div>
            <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
            <ul className="divide-y divide-border/60 border-t border-border">
              {order.items.map((it) => (
                <li key={it.id} className="flex items-start gap-3 px-5 py-3">
                  <span className="mt-0.5 grid h-6 min-w-[1.75rem] shrink-0 place-items-center rounded-md bg-primary-soft px-1.5 text-xs font-bold tabular-nums text-primary">
                    {it.quantity}
                  </span>
                  <span className="min-w-0 flex-1 text-sm text-foreground">
                    <span className="line-clamp-2">{it.name}</span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                    {brl(it.unitPrice * it.quantity)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="space-y-1.5 border-t border-border bg-surface/40 px-5 py-4 text-sm">
              <Row label="Subtotal" value={brl(order.subtotal)} />
              {order.discount > 0 ? (
                <Row label="Desconto" value={`- ${brl(order.discount)}`} tone="success" />
              ) : null}
              <Row
                label={order.pickup ? "Retirada" : "Taxa de entrega"}
                value={brl(order.delivery_fee)}
              />
              <div className="mt-2 border-t border-border pt-2">
                <Row bold label="Total" value={brl(order.total)} />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* DELIVERY / PICKUP DATA */}
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
          <h3 className="border-b border-border/60 px-5 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-foreground/45">
            {order.pickup ? "Retirada" : "Entrega"}
          </h3>
          <div className="flex items-start gap-3 px-5 py-4">
            <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
              <MapPin className="h-4 w-4" />
            </div>
            <div className="min-w-0 text-sm">
              {order.pickup ? (
                <>
                  <div className="font-semibold text-foreground">Retirada no balcão</div>
                  <div className="mt-0.5 text-xs text-foreground/60">
                    Apresente o número {order.short_id} no caixa.
                  </div>
                </>
              ) : order.address ? (
                <>
                  <div className="font-semibold text-foreground">
                    {order.address.street}, {order.address.number}
                    {order.address.complement ? ` — ${order.address.complement}` : ""}
                  </div>
                  <div className="mt-0.5 text-xs text-foreground/60">
                    {order.address.neighborhood} · {order.address.city}
                    {order.address.state ? ` - ${order.address.state}` : ""}
                  </div>
                  {order.address.reference ? (
                    <div className="mt-1 text-xs text-foreground/50">
                      Referência: {order.address.reference}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="text-foreground/60">Endereço não informado.</div>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border/60 px-5 py-3">
            <span className="text-xs font-medium text-foreground/55">Forma de pagamento</span>
            <span className="text-sm font-semibold text-foreground">
              {PAYMENT_LABEL[order.payment?.kind as string] ?? "Pagamento"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border/60 bg-surface/40 px-5 py-3">
            <span className="text-xs font-medium text-foreground/55">Total</span>
            <span className="text-sm font-bold tabular-nums text-foreground">
              {brl(order.total)}
            </span>
          </div>
        </section>


        {/* SUPPORT — reduced */}
        <div className="flex items-center justify-center pt-2">
          <a
            href="tel:+551140028922"
            className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <Phone className="h-3.5 w-3.5" />
            Precisa de ajuda? Falar com o suporte
          </a>
        </div>
      </main>
      <Outlet />
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
      <span className={bold ? "font-semibold" : "text-muted-foreground"}>{label}</span>
      <span
        className={
          "tabular-nums " +
          (bold ? "font-bold " : "") +
          (tone === "success" ? "text-success" : "")
        }
      >
        {value}
      </span>
    </div>
  );
}


function ContextualPhase({ status }: { status: OrderStatus }) {
  if (status === "received") {
    return (
      <section className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Pedido confirmado</h3>
          <p className="text-xs text-muted-foreground">
            O restaurante recebeu seu pedido e vai começar o preparo em instantes.
          </p>
        </div>
      </section>
    );
  }
  if (status === "preparing") {
    return (
      <section className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
          <ChefHat className="h-6 w-6 animate-[pulse_2s_ease-in-out_infinite]" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Preparando seu pedido</h3>
          <p className="text-xs text-muted-foreground">
            A cozinha está caprichando nos detalhes. Não vai demorar.
          </p>
        </div>
      </section>
    );
  }
  if (status === "delivering") {
    return <DeliveryProgress />;
  }
  return null;
}

function CourierCard() {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
          <span className="text-sm font-bold">MR</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground">Marcos R.</div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Bike className="h-3.5 w-3.5" /> Moto · Entregador parceiro
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="tel:+551140028922"
            aria-label="Ligar para o entregador"
            className="grid h-10 w-10 place-items-center rounded-full border border-border text-foreground hover:bg-surface"
          >
            <Phone className="h-4 w-4" />
          </a>
          <a
            href="sms:+551140028922"
            aria-label="Mensagem para o entregador"
            className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground hover:opacity-95"
          >
            <MessageCircle className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}

function DeliveryProgress() {
  const [pct, setPct] = React.useState(15);
  React.useEffect(() => {
    const t = setInterval(() => setPct((p) => Math.min(95, p + 4)), 2000);
    return () => clearInterval(t);
  }, []);
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Entregador a caminho</h3>
        <span className="text-xs font-medium text-primary">Ao vivo</span>
      </div>
      <div
        className="relative h-28 overflow-hidden rounded-xl border border-border"
        style={{
          backgroundImage:
            "linear-gradient(180deg, oklch(0.98 0.01 240) 0%, oklch(0.96 0.015 240) 100%)",
        }}
      >
        {/* subtle map grid */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "linear-gradient(to right, oklch(0.9 0.01 240) 1px, transparent 1px), linear-gradient(to bottom, oklch(0.9 0.01 240) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        {/* route line */}
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 300 112" preserveAspectRatio="none">
          <path
            d="M 12 90 Q 90 30, 160 60 T 288 40"
            fill="none"
            stroke="oklch(0.85 0.03 240)"
            strokeWidth="2"
            strokeDasharray="4 4"
          />
          <path
            d="M 12 90 Q 90 30, 160 60 T 288 40"
            fill="none"
            stroke="var(--primary, oklch(0.55 0.2 250))"
            strokeWidth="2.5"
            strokeDasharray="500"
            strokeDashoffset={500 - (pct / 100) * 500}
            className="transition-all duration-1000 ease-linear"
          />
        </svg>
        {/* courier marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 transition-all duration-1000 ease-linear"
          style={{ left: `calc(${pct}% - 20px)` }}
        >
          <div className="relative grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-elevated)]">
            <span className="absolute inset-0 -z-0 animate-ping rounded-full bg-primary/40" />
            <Bike className="relative h-5 w-5" />
          </div>
        </div>
        {/* destination */}
        <div className="absolute right-3 top-2 grid h-8 w-8 place-items-center rounded-full bg-background text-primary shadow-[var(--shadow-card)]">
          <MapPin className="h-4 w-4" />
        </div>
      </div>
    </section>
  );
}

function OrderTrackingSkeleton() {
  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-5 w-40" />
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6 sm:px-6">
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
          <div className="border-b border-border/60 bg-gradient-to-b from-primary-soft/60 to-transparent px-5 py-6 sm:px-6">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="mt-2 h-10 w-40" />
            <Skeleton className="mt-3 h-4 w-48" />
          </div>
          <ol className="space-y-6 px-5 py-6 sm:px-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="flex gap-4">
                <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2 pt-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-64" />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

const PAYMENT_LABEL: Record<string, string> = {
  pix: "Pix",
  credit: "Cartão de crédito",
  debit: "Cartão de débito",
  cash: "Dinheiro",
};

function FinishedOrderView({ order, canceled }: { order: OrderRow; canceled?: boolean }) {
  const nav = useNavigate();
  const addItem = useCart((s) => s.addItem);

  const placedAt = new Date(order.created_at);
  const dateLine = `${placedAt.toLocaleDateString("pt-BR")} · ${formatTime(placedAt)}`;

  const repeat = () => {
    for (const it of order.items) {
      addItem(
        {
          productId: it.productId,
          name: it.name,
          image: it.image,
          basePrice: it.basePrice,
          quantity: it.quantity,
          note: it.note,
          customizations: it.customizations ?? [],
        },
        { id: order.restaurant_id },
      );
    }
    toast.success("Itens adicionados à sacola");
    nav({ to: "/carrinho" });
  };

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-16 md:pt-20">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-6 md:static md:border-0">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link
            to="/pedidos"
            className="-ml-2 grid h-10 w-10 place-items-center rounded-full text-foreground/70 transition-colors hover:bg-surface"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-base font-bold">Pedido {order.short_id}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-5 sm:px-6">
        {/* STATUS */}
        <section
          className={cn(
            "overflow-hidden rounded-2xl border bg-card shadow-[var(--shadow-card)]",
            canceled ? "border-destructive/25" : "border-border",
          )}
        >
          <div className="flex items-start gap-3 p-5">
            <div
              className={cn(
                "grid h-11 w-11 shrink-0 place-items-center rounded-full",
                canceled
                  ? "bg-destructive/10 text-destructive"
                  : "bg-success/12 text-success",
              )}
            >
              {canceled ? <TimerOff className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <h2
                className={cn(
                  "text-sm font-bold",
                  canceled ? "text-destructive" : "text-foreground",
                )}
              >
                {canceled ? "Pedido cancelado" : "Pedido concluído"}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-foreground/60">
                {canceled
                  ? "O código Pix expirou antes do pagamento. Nenhum valor foi cobrado e este pedido não será preparado."
                  : "Pedido entregue. Obrigado por pedir com a gente!"}
              </p>
              <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.14em] text-foreground/35">
                {dateLine}
              </p>
            </div>
          </div>

          {!canceled && !order.rated ? (
            <button
              onClick={() => nav({ to: "/pedido/$id/avaliar", params: { id: order.id } })}
              className="flex w-full items-center justify-between gap-3 border-t border-border/60 px-5 py-3 text-left transition-colors hover:bg-surface/40"
            >
              <span className="flex items-center gap-1 text-foreground/35">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4" />
                ))}
              </span>
              <span className="text-xs font-semibold text-primary">Avaliar seu pedido</span>
            </button>
          ) : null}
        </section>

        {/* RESTAURANT + ITEMS */}
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-3 border-b border-border/60 px-5 py-4">
            <img
              src={brand?.logo ?? "/placeholder.svg"}
              alt=""
              loading="lazy"
              className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-border"
            />
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-foreground">{brand?.name ?? "Restaurante"}</div>
              <div className="text-xs text-foreground/50">
                {order.items.reduce((n, i) => n + i.quantity, 0)}{" "}
                {order.items.reduce((n, i) => n + i.quantity, 0) === 1 ? "item" : "itens"}
              </div>
            </div>
          </div>

          <ul className="divide-y divide-border/50">
            {order.items.map((it, idx) => (
              <li key={it.id ?? idx} className="flex items-start gap-3 px-5 py-3">
                {it.image ? (
                  <img
                    src={it.image}
                    alt=""
                    loading="lazy"
                    className="h-11 w-11 shrink-0 rounded-xl object-cover ring-1 ring-border/70"
                  />
                ) : (
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-surface text-xs font-bold text-foreground/50">
                    {it.quantity}×
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground">
                    <span className="text-foreground/50">{it.quantity}× </span>
                    {it.name}
                  </div>
                  {it.customizations?.length ? (
                    <div className="mt-0.5 line-clamp-2 text-xs text-foreground/45">
                      {it.customizations.map((c) => c.optionName).join(", ")}
                    </div>
                  ) : null}
                  {it.note ? (
                    <div className="mt-0.5 text-xs italic text-foreground/40">“{it.note}”</div>
                  ) : null}
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground/80">
                  {brl(it.unitPrice * it.quantity)}
                </span>
              </li>
            ))}
          </ul>

          <div className="space-y-1.5 border-t border-border bg-surface/40 px-5 py-4 text-sm">
            <Row label="Subtotal" value={brl(order.subtotal)} />
            {order.discount > 0 ? (
              <Row label="Desconto" value={`- ${brl(order.discount)}`} tone="success" />
            ) : null}
            <Row
              label={order.pickup ? "Retirada" : "Taxa de entrega"}
              value={brl(order.delivery_fee)}
            />
            <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
              <span className="font-semibold">Total</span>
              <span
                className={cn(
                  "font-bold tabular-nums",
                  canceled ? "text-foreground/45 line-through" : "text-foreground",
                )}
              >
                {brl(order.total)}
              </span>
            </div>
          </div>
        </section>

        {/* DELIVERY / PICKUP */}
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
          <h3 className="border-b border-border/60 px-5 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-foreground/45">
            {order.pickup ? "Retirada" : "Entrega"}
          </h3>
          <div className="flex items-start gap-3 px-5 py-4">
            <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
              <MapPin className="h-4 w-4" />
            </div>
            <div className="min-w-0 text-sm">
              {order.pickup ? (
                <>
                  <div className="font-semibold text-foreground">Retirada no balcão</div>
                  <div className="mt-0.5 text-xs text-foreground/60">
                    Pedido {order.short_id}
                  </div>
                </>
              ) : order.address ? (
                <>
                  <div className="font-semibold text-foreground">
                    {order.address.street}, {order.address.number}
                    {order.address.complement ? ` — ${order.address.complement}` : ""}
                  </div>
                  <div className="mt-0.5 text-xs text-foreground/60">
                    {order.address.neighborhood} · {order.address.city}
                    {order.address.state ? ` - ${order.address.state}` : ""}
                  </div>
                  {order.address.reference ? (
                    <div className="mt-1 text-xs text-foreground/50">
                      Referência: {order.address.reference}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="text-foreground/60">Endereço não informado.</div>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border/60 px-5 py-3">
            <span className="text-xs font-medium text-foreground/55">Forma de pagamento</span>
            <span className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                {PAYMENT_LABEL[order.payment?.kind as string] ?? "Pagamento"}
              </span>
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                  canceled
                    ? "bg-destructive/10 text-destructive"
                    : "bg-success/12 text-success",
                )}
              >
                {canceled ? "Não pago" : "Pago"}
              </span>
            </span>
          </div>
        </section>

        {/* ACTIONS */}
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            onClick={repeat}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary text-[13px] font-bold uppercase tracking-[0.12em] text-primary-foreground shadow-[var(--shadow-elevated)] transition-transform active:scale-[0.98]"
          >
            <ShoppingBag className="h-4 w-4" />
            Pedir de novo
          </button>
          <Link
            to="/pedidos"
            className="inline-flex h-12 items-center justify-center rounded-2xl border border-border text-[13px] font-bold uppercase tracking-[0.12em] text-primary transition-colors hover:bg-primary-soft/40"
          >
            Meus pedidos
          </Link>
        </div>

        <div className="flex items-center justify-center pt-1">
          <a
            href="tel:+551140028922"
            className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <Phone className="h-3.5 w-3.5" />
            Precisa de ajuda? Falar com o suporte
          </a>
        </div>
      </main>
      <Outlet />
    </div>
  );
}

