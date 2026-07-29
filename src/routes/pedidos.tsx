import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Check,
  CheckCircle2,
  Copy,
  Receipt,
  RefreshCw,
  ShoppingBag,
  Star,
  TimerOff,
  WifiOff,
} from "lucide-react";
import {
  getPixSession,
  isPixExpired,
  pixRemainingMs,
  pixTotalMs,
  formatCountdown,
  type PixSession,
} from "@/lib/pix-session";

import { listMyOrders, type OrderRow } from "@/lib/orders-api";
import { statusLabel, type OrderStatus, ACTIVE_STATUSES } from "@/lib/order-status";
import { brl } from "@/lib/format";
import { fetchRestaurantsBrief } from "@/lib/storefront";
import { useCart } from "@/store/cart";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pedidos")({
  head: () => ({
    meta: [
      { title: "Meus pedidos — MenuAtlas" },
      { name: "description", content: "Veja seus pedidos em andamento e o histórico completo." },
      { property: "og:title", content: "Meus pedidos — MenuAtlas" },
      { property: "og:description", content: "Veja seus pedidos em andamento e o histórico completo." },
    ],
  }),
  component: Page,
});

/* ------------------------------------------------------------------ */
/* Date grouping                                                       */
/* ------------------------------------------------------------------ */

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(today) - startOf(d)) / 86_400_000);
  const date = d.toLocaleDateString("pt-BR");
  if (diffDays === 0) return `Hoje · ${date}`;
  if (diffDays === 1) return `Ontem · ${date}`;
  return `${WEEKDAYS[d.getDay()]}, ${date}`;
}

function groupByDay(orders: OrderRow[]) {
  const groups: Array<{ key: string; label: string; orders: OrderRow[] }> = [];
  for (const o of orders) {
    const key = dayKey(o.created_at);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.orders.push(o);
    else groups.push({ key, label: dayLabel(o.created_at), orders: [o] });
  }
  return groups;
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const PAGE_SIZE = 15;

function Page() {
  const [tab, setTab] = React.useState<"active" | "past">("active");
  const [limit, setLimit] = React.useState(PAGE_SIZE);
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["orders", limit],
    queryFn: () => listMyOrders(limit),
    refetchInterval: 8000,
    retry: 1,
  });

  const orders = data ?? [];
  const canLoadMore = orders.length >= limit;
  const active = orders.filter(
    (o) => ACTIVE_STATUSES.includes(o.status as OrderStatus) || o.status === "pending_payment",
  );
  const past = orders.filter((o) => o.status === "delivered");
  const list = tab === "active" ? active : past;
  const groups = React.useMemo(() => groupByDay(list), [list]);

  const restaurantIds = React.useMemo(
    () => Array.from(new Set(orders.map((o) => o.restaurant_id).filter(Boolean))),
    [orders],
  );
  const { data: brands } = useQuery({
    queryKey: ["orders-brands", restaurantIds.join(",")],
    queryFn: () => fetchRestaurantsBrief(restaurantIds),
    enabled: restaurantIds.length > 0,
    staleTime: 60_000,
  });

  return (
    <div className="min-h-screen bg-background pb-24 md:pt-20">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur md:static md:border-0">
        <div className="mx-auto max-w-3xl px-4 py-3 sm:px-6">
          <h1 className="text-lg font-bold">Meus pedidos</h1>
          <div className="mt-3 inline-flex rounded-full bg-surface p-1 text-sm font-semibold">
            <TabButton active={tab === "active"} onClick={() => setTab("active")}>
              Em andamento{active.length ? ` · ${active.length}` : ""}
            </TabButton>
            <TabButton active={tab === "past"} onClick={() => setTab("past")}>
              Finalizados
            </TabButton>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
        {isLoading ? (
          <OrdersSkeleton />
        ) : isError ? (
          <EmptyState
            icon={<WifiOff className="h-6 w-6" />}
            title="Falha de conexão"
            description="Não conseguimos carregar seus pedidos. Verifique sua internet e tente novamente."
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
        ) : list.length === 0 ? (
          <EmptyState
            icon={<Receipt className="h-6 w-6" />}
            title={tab === "active" ? "Nenhum pedido em andamento" : "Você ainda não tem histórico"}
            description={
              tab === "active"
                ? "Quando você fizer um pedido, ele aparece aqui em tempo real."
                : "Pedidos entregues ficam guardados aqui para consulta."
            }
            action={
              <Link
                to="/demo"
                className="inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
              >
                Ver cardápio
              </Link>
            }
          />
        ) : (
          <div className="space-y-6">
            {groups.map((g) => (
              <section key={g.key}>
                <h2 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.16em] text-foreground/40">
                  {g.label}
                </h2>
                <ul className="space-y-3">
                  {g.orders.map((o) => (
                    <OrderCard key={o.id} order={o} brand={brands?.[o.restaurant_id]} />
                  ))}
                </ul>
              </section>
            ))}
            {canLoadMore ? (
              <div className="pt-2 text-center">
                <button
                  onClick={() => setLimit((n) => n + PAGE_SIZE)}
                  disabled={isFetching}
                  className="text-xs font-semibold text-primary hover:underline disabled:opacity-50"
                >
                  {isFetching ? "Carregando…" : "Carregar mais pedidos"}
                </button>
              </div>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full px-4 py-1.5 transition-colors",
        active ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground/60",
      )}
    >
      {children}
    </button>
  );
}

function usePixTick(active: boolean) {
  const [, force] = React.useReducer((x: number) => x + 1, 0);
  React.useEffect(() => {
    if (!active) return;
    const t = window.setInterval(force, 1000);
    return () => window.clearInterval(t);
  }, [active]);
}

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

function OrderCard({ order, brand }: { order: OrderRow; brand?: { name: string; logo: string; slug: string } }) {
  const nav = useNavigate();
  const addItem = useCart((s) => s.addItem);
  const [session, setSession] = React.useState<PixSession | null>(null);
  const isPending = order.status === "pending_payment";

  React.useEffect(() => {
    if (!isPending) return;
    setSession(getPixSession(order.id));
  }, [isPending, order.id]);

  usePixTick(isPending && !!session);

  const expired = isPixExpired(session);
  const livePix = session && !expired ? session : null;
  const delivered = order.status === "delivered";

  const target = isPending && !expired ? "/pagamento/$id" : "/pedido/$id";

  const remaining = livePix ? pixRemainingMs(livePix) : 0;
  const progress = livePix ? remaining / pixTotalMs(livePix) : 0;
  const urgent = remaining <= 60_000;

  const visible = order.items.slice(0, 3);
  const extra = order.items.length - visible.length;
  const thumbs = order.items.filter((i) => i.image).slice(0, 3);

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
    <li>
      <article
        className={cn(
          "overflow-hidden rounded-2xl border bg-card shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-elevated)]",
          expired ? "border-destructive/25" : "border-border",
        )}
      >
        {/* header */}
        <button
          onClick={() => nav({ to: target, params: { id: order.id } })}
          className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 pt-4 text-left"
        >
          <img
            src={brand?.logo ?? "/placeholder.svg"}
            alt=""
            loading="lazy"
            className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-border"
          />
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-foreground">{brand?.name ?? "Restaurante"}</div>
            <div className="mt-0.5 flex items-center gap-1.5">
              <StatusDot expired={expired} delivered={delivered} />
              <span
                className={cn(
                  "truncate text-xs font-medium",
                  expired
                    ? "text-destructive"
                    : delivered
                      ? "text-foreground/55"
                      : "text-primary",
                )}
              >
                {expired
                  ? "Pagamento não confirmado · cancelado"
                  : statusLabel[order.status as OrderStatus]}
              </span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div
              className={cn(
                "text-sm font-bold tabular-nums",
                expired ? "text-foreground/45 line-through" : "text-foreground",
              )}
            >
              {brl(order.total)}
            </div>
            <div className="text-[11px] text-foreground/45">{order.short_id}</div>
          </div>
        </button>

        {/* items */}
        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-4">
          <ul className="min-w-0 space-y-1.5">
            {visible.map((it, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <span className="grid h-6 min-w-[1.5rem] shrink-0 place-items-center rounded-md bg-surface px-1 text-[11px] font-bold tabular-nums text-foreground/70">
                  {it.quantity}
                </span>
                <span className="min-w-0 truncate text-sm text-foreground/80">{it.name}</span>
              </li>
            ))}
            {extra > 0 ? (
              <li className="pl-[2.1rem] text-xs font-medium text-foreground/45">
                + {extra} {extra === 1 ? "item" : "itens"}
              </li>
            ) : null}
          </ul>
          {thumbs.length ? (
            <div className="flex shrink-0 -space-x-3">
              {thumbs.map((it, idx) => (
                <img
                  key={idx}
                  src={it.image}
                  alt=""
                  loading="lazy"
                  className="h-11 w-11 rounded-full object-cover ring-2 ring-card"
                />
              ))}
            </div>
          ) : null}
        </div>

        {/* pix live block */}
        {livePix ? (
          <div className="mx-4 mt-3 rounded-xl border border-border/70 bg-surface/50 p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/50">
                Pix aguardando pagamento
              </span>
              <span
                className={cn(
                  "text-sm font-bold tabular-nums",
                  urgent ? "text-destructive" : "text-foreground",
                )}
              >
                {formatCountdown(remaining)}
              </span>
            </div>
            <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-border/60">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-1000 ease-linear",
                  urgent ? "bg-destructive" : "bg-primary",
                )}
                style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%` }}
              />
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => nav({ to: "/pagamento/$id", params: { id: order.id } })}
                className="inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-primary px-4 text-[12px] font-bold uppercase tracking-[0.12em] text-primary-foreground transition-transform active:scale-[0.98]"
              >
                Efetuar pagamento
              </button>
              <CopyPixButton code={livePix.code} />
            </div>
          </div>
        ) : null}

        {/* rating row */}
        {delivered && !order.rated ? (
          <button
            onClick={() => nav({ to: "/pedido/$id/avaliar", params: { id: order.id } })}
            className="mt-3 flex w-full items-center justify-between gap-3 border-t border-border/60 px-4 py-3 text-left transition-colors hover:bg-surface/40"
          >
            <span className="flex items-center gap-1 text-foreground/35">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-4 w-4" />
              ))}
            </span>
            <span className="text-xs font-semibold text-primary">Avaliar seu pedido</span>
          </button>
        ) : null}

        {/* actions */}
        <div className="mt-3 grid grid-cols-2 divide-x divide-border/60 border-t border-border/60">
          <Link
            to={target}
            params={{ id: order.id }}
            className="py-3 text-center text-[13px] font-bold text-primary transition-colors hover:bg-primary-soft/40"
          >
            Ver detalhes
          </Link>
          <button
            onClick={repeat}
            className="inline-flex items-center justify-center gap-1.5 py-3 text-[13px] font-bold text-primary transition-colors hover:bg-primary-soft/40"
          >
            <ShoppingBag className="h-4 w-4" />
            Pedir de novo
          </button>
        </div>
      </article>
    </li>
  );
}

function StatusDot({ expired, delivered }: { expired: boolean; delivered: boolean }) {
  if (expired) return <TimerOff className="h-3.5 w-3.5 shrink-0 text-destructive" />;
  if (delivered) return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />;
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
    </span>
  );
}

function CopyPixButton({ code }: { code: string }) {
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };
  return (
    <button
      onClick={copy}
      aria-label="Copiar código Pix"
      className="inline-flex h-10 w-11 items-center justify-center rounded-xl border border-border text-primary transition-colors hover:bg-primary-soft/50"
    >
      {copied ? <Check className="h-4 w-4" strokeWidth={2.5} /> : <Copy className="h-4 w-4" />}
    </button>
  );
}

function OrdersSkeleton() {
  return (
    <ul className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <li
          key={i}
          className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]"
        >
          <div className="flex items-start gap-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-full max-w-[240px]" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
