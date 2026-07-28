import * as React from "react";
import { createFileRoute, useNavigate, useParams, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Copy,
  TimerOff,
  AlertCircle,
  ChevronLeft,
  Check,
  ShieldCheck,
} from "lucide-react";
import { getOrderById, confirmPayment, type OrderRow } from "@/lib/orders-api";
import { createPixCharge, getPixStatus } from "@/lib/mercadopago.functions";
import { useAuth } from "@/store/auth";
import { brl } from "@/lib/format";
import { toast } from "sonner";
import pixLogo from "@/assets/pix-logo.png.asset.json";
import { getPixSession, savePixSession, isPixExpired } from "@/lib/pix-session";






export const Route = createFileRoute("/pagamento/$id")({
  head: () => ({
    meta: [
      { title: "Confirmando pagamento — MenuAtlas" },
      { name: "description", content: "Confirmação do pagamento do seu pedido." },
      { property: "og:title", content: "Confirmando pagamento — MenuAtlas" },
      { property: "og:description", content: "Confirmação do pagamento do seu pedido." },
    ],
  }),
  component: Page,
});

type Phase = "loading" | "awaiting_pix" | "processing" | "success" | "pix_expired";

const CARD_CONFIRM_MS = 1200;
const POLL_INTERVAL_MS = 1500;

function Page() {
  const { id } = useParams({ from: "/pagamento/$id" });
  const nav = useNavigate();
  const { data: order, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: () => getOrderById(id),
  });
  const [phase, setPhase] = React.useState<Phase>("loading");
  const confirmedRef = React.useRef(false);

  React.useEffect(() => {
    if (!order) return;
    if (order.status !== "pending_payment") {
      nav({ to: "/pedido/$id", params: { id: order.id }, replace: true });
      return;
    }
    setPhase(order.payment.kind === "pix" ? "awaiting_pix" : "processing");
  }, [order, nav]);

  React.useEffect(() => {
    if (!order) return;
    if (confirmedRef.current) return;
    if (phase !== "processing") return;
    const t = window.setTimeout(async () => {
      confirmedRef.current = true;
      try {
        await confirmPayment(order.id);
        setPhase("success");
        window.setTimeout(() => {
          nav({ to: "/pedido/$id", params: { id: order.id }, replace: true });
        }, 800);
      } catch (e) {
        console.error(e);
        toast.error("Falha ao confirmar pagamento. Tente novamente.");
      }
    }, CARD_CONFIRM_MS);
    return () => window.clearTimeout(t);
  }, [order, phase, nav]);

  const onPixApproved = React.useCallback(async () => {
    if (!order || confirmedRef.current) return;
    confirmedRef.current = true;
    try {
      // Passa o pixPaymentId salvo na sessão local — o servidor consulta o
      // Mercado Pago e só marca como pago se status === "approved" e o
      // external_reference bater com este pedido.
      const session = getPixSession(order.id);
      await confirmPayment(order.id, session?.paymentId);
      setPhase("success");
      window.setTimeout(() => {
        nav({ to: "/pedido/$id", params: { id: order.id }, replace: true });
      }, 800);
    } catch (e) {
      console.error(e);
      toast.error("Falha ao confirmar pagamento.");
    }
  }, [order, nav]);


  if (isLoading || !order) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <PulseLoader label="Carregando pedido…" />
      </div>
    );
  }

  const isPix = order.payment.kind === "pix";

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <TopBar orderId={order.id} />
      <main className="mx-auto flex w-full max-w-[480px] flex-1 flex-col px-5 pb-8 pt-6 sm:px-6">

        {phase === "success" ? (
          <SuccessCard total={order.total} />
        ) : phase === "pix_expired" ? (
          <PixExpiredCard orderId={order.id} total={order.total} />
        ) : isPix ? (
          <PixView
            order={order}
            onApproved={onPixApproved}
            onExpired={() => setPhase("pix_expired")}
          />
        ) : (
          <ProcessingCard method={order.payment.kind as "credit" | "debit" | "cash"} total={order.total} />
        )}

      </main>
    </div>
  );
}

function TopBar({ orderId }: { orderId: string }) {
  return (
    <header className="sticky top-0 z-10 border-b border-border/60 bg-background/90 backdrop-blur">
      <div className="mx-auto grid h-14 w-full max-w-[520px] grid-cols-[auto_1fr_auto] items-center px-4">
        <Link
          to="/pedido/$id"
          params={{ id: orderId }}
          className="grid h-10 w-10 -ml-2 place-items-center rounded-full text-primary transition-colors hover:bg-primary-soft"
          aria-label="Voltar"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
        </Link>
        <h1 className="text-center text-[13px] font-bold uppercase tracking-[0.22em] text-foreground/70">
          Pagamento
        </h1>
        <button
          type="button"
          className="text-right text-[13px] font-semibold text-primary hover:underline"
        >
          Ajuda
        </button>
      </div>
    </header>
  );
}

function PulseLoader({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-14 w-14">
        <span className="absolute inset-0 animate-ping rounded-full bg-primary/25" />
        <span className="absolute inset-2 rounded-full bg-primary" />
      </div>
      <p className="text-sm font-medium text-foreground/70">{label}</p>
    </div>
  );
}

function PixView({
  order,
  onApproved,
  onExpired,
}: {
  order: OrderRow;
  onApproved: () => void;
  onExpired: () => void;
}) {
  const createFn = useServerFn(createPixCharge);
  const statusFn = useServerFn(getPixStatus);
  const email = useAuth((s) => s.user?.email);

  const [state, setState] = React.useState<
    | { phase: "creating" }
    | { phase: "error"; message: string }
    | { phase: "ready"; paymentId: number; code: string; deadline: number }
  >({ phase: "creating" });
  const [remaining, setRemaining] = React.useState(5 * 60_000);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      // Uma única cobrança Pix por pedido: reaproveita a sessão salva.
      const existing = getPixSession(order.id);
      if (existing) {
        if (isPixExpired(existing)) {
          onExpired();
          return;
        }
        setState({
          phase: "ready",
          paymentId: existing.paymentId,
          code: existing.code,
          deadline: existing.expiresAt,
        });
        return;
      }
      try {
        const res = await createFn({
          data: {
            amount: order.total,
            description: `Pedido ${order.short_id}`,
            externalReference: order.id,
            payerEmail: email,
            expirationMinutes: 5,
          },
        });
        if (cancelled) return;
        if (!res.qrCode) {
          setState({ phase: "error", message: "Mercado Pago não retornou o código Pix." });
          return;
        }
        const deadline = new Date(res.expiresAt).getTime();
        savePixSession({
          orderId: order.id,
          paymentId: res.id,
          code: res.qrCode,
          createdAt: Date.now(),
          expiresAt: deadline,
        });
        setState({
          phase: "ready",
          paymentId: res.id,
          code: res.qrCode,
          deadline,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Falha ao gerar Pix.";
        setState({ phase: "error", message: msg });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  React.useEffect(() => {
    if (state.phase !== "ready") return;
    const tick = () => {
      const left = Math.max(0, state.deadline - Date.now());
      setRemaining(left);
      if (left === 0) onExpired();
    };
    tick();
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, [state, onExpired]);

  React.useEffect(() => {
    if (state.phase !== "ready") return;
    let stopped = false;
    const poll = async () => {
      if (stopped) return;
      try {
        const s = await statusFn({ data: { paymentId: state.paymentId } });
        if (s.status === "approved") {
          stopped = true;
          onApproved();
          return;
        }
        if (["cancelled", "rejected", "refunded", "charged_back"].includes(s.status)) {
          stopped = true;
          onExpired();
          return;
        }
      } catch (e) {
        console.warn("[pix poll]", e);
      }
    };
    void poll();
    const t = window.setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      stopped = true;
      window.clearInterval(t);
    };
  }, [state, statusFn, onApproved, onExpired]);

  if (state.phase === "creating") {
    return (
      <div className="grid min-h-[70vh] place-items-center">
        <PulseLoader label="Gerando código Pix…" />
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div className="mt-10 rounded-3xl border border-border bg-card p-8 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-destructive/15 text-destructive">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-lg font-bold">Não foi possível gerar o Pix</h1>
        <p className="mt-2 break-words text-sm text-foreground/60">{state.message}</p>
      </div>
    );
  }

  const totalMs = 5 * 60_000;
  const mm = String(Math.floor(remaining / 60000)).padStart(2, "0");
  const ss = String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0");
  const progress = Math.max(0, Math.min(1, remaining / totalMs));
  const urgent = remaining <= 60_000;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(state.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar. Selecione e copie manualmente.");
    }
  };

  const preview = state.code;

  return (
    <div className="flex flex-1 flex-col animate-fade-in pb-24 sm:pb-8">
      <PixHeroIllustration />

      <div className="mt-6 text-center">
        <h1 className="text-[20px] font-bold leading-snug tracking-tight text-foreground/85">
          Pedido aguardando pagamento
        </h1>
        <p className="mx-auto mt-2 max-w-[36ch] text-[13.5px] leading-relaxed text-foreground/60">
          Copie o código e use o <span className="font-semibold text-foreground/80">Pix Copia e Cola</span> no app do seu banco.
        </p>
      </div>

      <button
        onClick={copy}
        className="mx-auto mt-5 flex w-full max-w-[340px] items-center justify-between gap-3 rounded-2xl border border-dashed border-border bg-transparent px-4 py-3 text-left transition-colors hover:border-primary/60 hover:bg-primary-soft/30"
        aria-label="Copiar código Pix"
      >
        <span className="min-w-0 flex-1 truncate font-mono text-[14px] tracking-tight text-foreground/85">
          {preview}
        </span>
        <span className="grid h-7 w-7 shrink-0 place-items-center text-primary transition-transform active:scale-90">
          {copied ? <Check className="h-4.5 w-4.5" strokeWidth={2.5} /> : <Copy className="h-4.5 w-4.5" strokeWidth={2} />}
        </span>
      </button>

      <div className="mt-6 text-center">
        <p className="text-[13px] text-foreground/60">O tempo para pagar acaba em</p>
        <p
          className={`mt-1 text-[28px] font-bold tabular-nums leading-none tracking-tight transition-colors ${
            urgent ? "text-destructive" : "text-foreground"
          }`}
        >
          {mm}:{ss}
        </p>
        <div className="mx-auto mt-3 h-[3px] w-full max-w-[220px] overflow-hidden rounded-full bg-border/60">
          <div
            className={`h-full rounded-full transition-[width,background-color] duration-1000 ease-linear ${
              urgent ? "bg-destructive" : "bg-primary"
            }`}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>

      <div className="mt-auto pt-8">
        <button
          onClick={copy}
          className="inline-flex h-13 w-full items-center justify-center gap-2.5 rounded-2xl bg-primary py-4 text-[13px] font-bold uppercase tracking-[0.14em] text-primary-foreground shadow-[var(--shadow-elevated)] transition-transform active:scale-[0.98]"
        >
          {copied ? (
            <>
              <Check className="h-4.5 w-4.5" strokeWidth={2.5} /> Código copiado
            </>
          ) : (
            <>
              <Copy className="h-4.5 w-4.5" strokeWidth={2} /> Copiar código
            </>
          )}
        </button>
        <p className="mt-3 inline-flex w-full items-center justify-center gap-1.5 text-[11px] text-foreground/45">
          <ShieldCheck className="h-3.5 w-3.5" />
          Pagamento processado com segurança · Mercado Pago
        </p>
      </div>
    </div>
  );
}




function PixHeroIllustration() {
  return (
    <div className="relative mt-2 grid h-44 w-full place-items-center sm:h-48">
      {/* halo suave, sem borda dura */}
      <div className="pointer-events-none absolute h-52 w-52 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--primary)_14%,transparent)_0%,transparent_68%)] blur-[2px] sm:h-56 sm:w-56" />

      {/* anel único, discreto */}
      <span className="pointer-events-none absolute h-28 w-28 rounded-full border border-primary/12 animate-[pixring_4s_ease-out_infinite]" />

      <div
        className="relative grid h-32 w-32 place-items-center sm:h-36 sm:w-36"
        style={{ perspective: "800px" }}
      >
        <span className="pix3d-shadow" aria-hidden />
        <div className="pix3d-float">
          <img
            src={pixLogo.url}
            alt="Pix"
            className="pix3d-tilt h-20 w-20 select-none sm:h-24 sm:w-24"
            draggable={false}
          />
        </div>
      </div>

      <style>{`
        @keyframes pixring { 0% { transform: scale(0.85); opacity: 0.45; } 100% { transform: scale(1.6); opacity: 0; } }
        @keyframes pix3dFloat { 0%,100% { transform: translateY(-4px); } 50% { transform: translateY(4px); } }
        @keyframes pix3dTilt {
          0%   { transform: rotateY(-14deg) rotateX(7deg); }
          50%  { transform: rotateY(14deg) rotateX(-5deg); }
          100% { transform: rotateY(-14deg) rotateX(7deg); }
        }
        @keyframes pix3dPop { 0% { transform: scale(0.7); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes pix3dShadow { 0%,100% { transform: scale(0.8); opacity: 0.16; } 50% { transform: scale(1); opacity: 0.09; } }

        .pix3d-float {
          transform-style: preserve-3d;
          animation: pix3dPop 550ms cubic-bezier(.2,.9,.3,1.15) both, pix3dFloat 5s ease-in-out infinite 550ms;
        }
        .pix3d-tilt {
          display: block;
          transform-style: preserve-3d;
          animation: pix3dTilt 7s ease-in-out infinite;
          filter: drop-shadow(0 10px 16px color-mix(in oklab, #00b39b 28%, transparent));
        }
        .pix3d-shadow {
          position: absolute;
          bottom: 6%;
          height: 10px;
          width: 52%;
          border-radius: 9999px;
          background: radial-gradient(ellipse at center, color-mix(in oklab, var(--foreground) 40%, transparent), transparent 70%);
          filter: blur(7px);
          animation: pix3dShadow 5s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .pix3d-float, .pix3d-tilt, .pix3d-shadow { animation: none; }
        }
      `}</style>
    </div>
  );
}


function PixExpiredCard({ orderId, total }: { orderId: string; total: number }) {
  return (
    <div className="mt-10 flex flex-col items-center text-center animate-fade-in">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-destructive/12 text-destructive">
        <TimerOff className="h-7 w-7" />
      </div>
      <h1 className="mt-5 text-xl font-bold">Pix expirado</h1>
      <p className="mt-2 max-w-[36ch] text-sm text-foreground/60">
        O tempo para pagar acabou e este pedido foi cancelado. Nenhum valor foi cobrado — faça um
        novo pedido para tentar de novo.
      </p>
      <p className="mt-5 text-2xl font-bold tabular-nums text-foreground/70 line-through">
        {brl(total)}
      </p>
      <Link
        to="/pedido/$id"
        params={{ id: orderId }}
        replace
        className="mt-6 inline-flex h-12 items-center gap-2 rounded-2xl bg-primary px-6 text-[13px] font-bold uppercase tracking-[0.14em] text-primary-foreground shadow-[var(--shadow-elevated)] transition-transform active:scale-[0.98]"
      >
        Ver detalhes do pedido
      </Link>
      <Link
        to="/pedidos"
        className="mt-3 text-sm font-semibold text-primary hover:underline"
      >
        Meus pedidos
      </Link>
    </div>
  );
}


function ProcessingCard({ method, total }: { method: "credit" | "debit" | "cash"; total: number }) {
  const label =
    method === "cash" ? "Registrando pagamento em dinheiro" : "Processando pagamento no cartão";
  return (
    <div className="mt-12 flex flex-col items-center text-center animate-fade-in">
      <div className="relative h-20 w-20">
        <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
        <span className="absolute inset-2 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
      </div>
      <h1 className="mt-6 text-xl font-bold">{label}</h1>
      <p className="mt-1 text-sm text-foreground/60">Isso leva apenas alguns segundos.</p>
      <p className="mt-4 text-2xl font-bold tabular-nums text-primary">{brl(total)}</p>
    </div>
  );
}

function SuccessCard({ total }: { total: number }) {
  return (
    <div className="mt-12 flex flex-col items-center text-center animate-scale-in">
      <div className="grid h-20 w-20 place-items-center rounded-full bg-success/15 text-success">
        <CheckDraw />
      </div>
      <h1 className="mt-6 text-2xl font-bold">Pagamento confirmado</h1>
      <p className="mt-1 text-sm text-foreground/60">
        Seu pedido foi enviado ao restaurante. Redirecionando…
      </p>
      <p className="mt-4 text-2xl font-bold tabular-nums text-success">{brl(total)}</p>
    </div>
  );
}

function CheckDraw() {
  return (
    <svg viewBox="0 0 24 24" className="h-10 w-10">
      <path
        d="M4 12l5 5L20 7"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          strokeDasharray: 30,
          strokeDashoffset: 30,
          animation: "checkDraw 0.55s ease-out forwards",
        }}
      />
      <style>{`@keyframes checkDraw { to { stroke-dashoffset: 0; } }`}</style>
    </svg>
  );
}
