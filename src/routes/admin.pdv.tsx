import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  Plus,
  Minus,
  Trash2,
  DollarSign,
  ArrowDownCircle,
  ArrowUpCircle,
  Lock,
  Percent,
  Loader2,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PdvPaymentModal } from "@/components/admin/pdv-payment-modal";
import { toast } from "sonner";
import { requireAdminRole } from "@/lib/admin/role-guard";
import { useAdminSession } from "@/lib/admin/session";
import { supabase } from "@/lib/custom-supabase";
import { brl } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  listCategories,
  listProducts,
  listOptionGroupsForProduct,
  type OptionGroup,
  type Product,
} from "@/lib/admin/menu";
import {
  addMovement,
  closeCashSession,
  getOpenSession,
  getSessionSummary,
  listMovements,
  openCashSession,
} from "@/lib/admin/cash";
import { createPdvOrder } from "@/lib/admin/pdv.functions";

export const Route = createFileRoute("/admin/pdv")({
  head: () => ({ meta: [{ title: "PDV — MenuAltas" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: () => requireAdminRole(["admin", "caixa"]),
  component: PdvPage,
});

type Line = {
  id: string;
  productId: string;
  name: string;
  unitPrice: number;
  qty: number;
  optionIds: string[];
  optionsLabel: string;
};

function PdvPage() {
  const qc = useQueryClient();
  const { data: session } = useAdminSession();
  const restaurantId = session?.restaurantId;
  const submitSale = useServerFn(createPdvOrder);

  const [cart, setCart] = React.useState<Line[]>([]);
  const [openDialog, setOpenDialog] = React.useState<null | "open" | "close" | "sangria" | "supri">(
    null,
  );
  const [dialogAmount, setDialogAmount] = React.useState("");
  const [dialogReason, setDialogReason] = React.useState("");
  const [dialogBusy, setDialogBusy] = React.useState(false);
  const [payOpen, setPayOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [discount, setDiscount] = React.useState(0);
  const [search, setSearch] = React.useState("");
  const [activeCat, setActiveCat] = React.useState<string>("all");
  const [optionsFor, setOptionsFor] = React.useState<Product | null>(null);

  const sessionQ = useQuery({
    queryKey: ["cash-session", restaurantId],
    queryFn: () => getOpenSession(restaurantId!),
    enabled: !!restaurantId,
    refetchInterval: 30_000,
  });
  const cashSession = sessionQ.data ?? null;
  const cashOpen = !!cashSession;

  const summaryQ = useQuery({
    queryKey: ["cash-summary", cashSession?.id],
    queryFn: () => getSessionSummary(cashSession!),
    enabled: !!cashSession,
  });
  const movementsQ = useQuery({
    queryKey: ["cash-movements", cashSession?.id],
    queryFn: () => listMovements(cashSession!.id),
    enabled: !!cashSession,
  });

  const catsQ = useQuery({
    queryKey: ["pdv-cats", restaurantId],
    queryFn: () => listCategories(restaurantId!),
    enabled: !!restaurantId,
  });
  const prodsQ = useQuery({
    queryKey: ["pdv-prods", restaurantId],
    queryFn: () => listProducts(restaurantId!),
    enabled: !!restaurantId,
  });

  const products = (prodsQ.data ?? []).filter((p) => p.active !== false);
  const filtered = products.filter(
    (p) =>
      (activeCat === "all" || p.category_id === activeCat) &&
      (!search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase())),
  );

  const subtotal = cart.reduce((a, b) => a + b.unitPrice * b.qty, 0);
  const total = Math.max(0, subtotal - discount);
  const count = cart.reduce((a, b) => a + b.qty, 0);

  function pushLine(p: Product, optionIds: string[], optionsLabel: string, delta: number) {
    const key = `${p.id}|${[...optionIds].sort().join(",")}`;
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.id === key);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
        return copy;
      }
      return [
        ...prev,
        {
          id: key,
          productId: p.id,
          name: p.name,
          unitPrice: Number(p.price) + delta,
          qty: 1,
          optionIds,
          optionsLabel,
        },
      ];
    });
  }

  async function handleProductClick(p: Product) {
    const groups = await listOptionGroupsForProduct(p.id);
    if (groups.length === 0) {
      pushLine(p, [], "", 0);
      return;
    }
    setOptionsFor(p);
  }

  /* ------------------------- Caixa ------------------------- */
  async function runDialog() {
    if (!restaurantId || !session) return;
    const amount = Number(dialogAmount.replace(",", "."));
    setDialogBusy(true);
    try {
      if (openDialog === "open") {
        if (!(amount >= 0)) throw new Error("Informe o valor de abertura.");
        await openCashSession({ restaurantId, userId: session.user.id, openingAmount: amount });
        toast.success("Caixa aberto.");
      } else if (openDialog === "close") {
        if (!cashSession) throw new Error("Nenhum caixa aberto.");
        if (!(amount >= 0)) throw new Error("Informe o valor contado em gaveta.");
        const res = await closeCashSession({
          session: cashSession,
          userId: session.user.id,
          closingAmount: amount,
          notes: dialogReason,
        });
        const diff = res.difference;
        toast.success(
          `Caixa fechado. Esperado ${brl(res.expected)} · ${
            diff === 0 ? "sem diferença" : `${diff > 0 ? "sobra" : "falta"} de ${brl(Math.abs(diff))}`
          }`,
        );
      } else if (openDialog === "sangria" || openDialog === "supri") {
        if (!cashSession) throw new Error("Abra o caixa primeiro.");
        await addMovement({
          sessionId: cashSession.id,
          restaurantId,
          userId: session.user.id,
          kind: openDialog === "sangria" ? "sangria" : "suprimento",
          amount,
          reason: dialogReason,
        });
        toast.success("Movimentação registrada.");
      }
      setOpenDialog(null);
      setDialogAmount("");
      setDialogReason("");
      qc.invalidateQueries({ queryKey: ["cash-session", restaurantId] });
      qc.invalidateQueries({ queryKey: ["cash-summary"] });
      qc.invalidateQueries({ queryKey: ["cash-movements"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível concluir.");
    } finally {
      setDialogBusy(false);
    }
  }

  /* ------------------------- Venda ------------------------- */
  async function finalize(method: string, change?: number) {
    if (!restaurantId || cart.length === 0) return;
    setSaving(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const accessToken = sess.session?.access_token;
      if (!accessToken) throw new Error("Sessão expirada. Entre novamente.");
      const res = await submitSale({
        data: {
          accessToken,
          restaurantId,
          cashSessionId: cashSession?.id ?? null,
          discount,
          payment: { kind: method, ...(change ? { change } : {}) },
          items: cart.map((l) => ({
            productId: l.productId,
            quantity: l.qty,
            optionIds: l.optionIds,
          })),
        },
      });
      toast.success(`Venda ${res.shortId} registrada — ${brl(res.total)}`);
      setCart([]);
      setDiscount(0);
      qc.invalidateQueries({ queryKey: ["cash-summary"] });
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível registrar a venda.");
    } finally {
      setSaving(false);
    }
  }

  const summary = summaryQ.data;

  return (
    <AdminShell title="PDV (Caixa)">
      <div className="grid gap-4 px-4 py-6 sm:px-8 lg:grid-cols-[minmax(0,1fr)_400px]">
        <section className="min-w-0 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Frente de caixa</h2>
                <p className="text-xs text-slate-500">
                  {sessionQ.isLoading
                    ? "Verificando caixa…"
                    : cashOpen
                      ? `Caixa aberto desde ${new Date(cashSession!.opened_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · abertura ${brl(cashSession!.opening_amount)}`
                      : "Caixa fechado"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {!cashOpen ? (
                  <Button size="sm" onClick={() => setOpenDialog("open")}>
                    <Lock className="h-4 w-4" /> Abrir caixa
                  </Button>
                ) : (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setOpenDialog("sangria")}>
                      <ArrowUpCircle className="h-4 w-4" /> Sangria
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setOpenDialog("supri")}>
                      <ArrowDownCircle className="h-4 w-4" /> Suprimento
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setOpenDialog("close")}>
                      Fechar caixa
                    </Button>
                  </>
                )}
              </div>
            </div>

            {cashOpen && summary && (
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-5">
                <Stat label="Abertura" value={brl(summary.opening)} />
                <Stat label={`Vendas (${summary.ordersCount})`} value={brl(summary.sales)} />
                <Stat label="Suprimentos" value={brl(summary.supplies)} />
                <Stat label="Sangrias" value={brl(summary.withdrawals)} />
                <Stat label="Esperado em gaveta" value={brl(summary.expected)} strong />
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-semibold text-slate-900">Cardápio</div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar produto"
                  className="h-9 pl-8"
                />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <CatChip active={activeCat === "all"} onClick={() => setActiveCat("all")}>
                Todos
              </CatChip>
              {(catsQ.data ?? []).map((c) => (
                <CatChip
                  key={c.id}
                  active={activeCat === c.id}
                  onClick={() => setActiveCat(c.id)}
                >
                  {c.name}
                </CatChip>
              ))}
            </div>

            {prodsQ.isLoading ? (
              <div className="grid h-32 place-items-center text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="mt-4 rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                Nenhum produto ativo no cardápio.
              </p>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                {filtered.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleProductClick(p)}
                    className="flex flex-col items-start rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-primary/40 hover:shadow-sm"
                  >
                    <span className="line-clamp-2 text-sm font-semibold text-slate-900">
                      {p.name}
                    </span>
                    <span className="mt-1 text-xs font-medium text-primary">{brl(p.price)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {cashOpen && (movementsQ.data ?? []).length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-semibold text-slate-900">Movimentações do turno</div>
              <ul className="mt-2 divide-y divide-slate-100 text-sm">
                {movementsQ.data!.map((m) => (
                  <li key={m.id} className="flex items-center justify-between py-2">
                    <span className="text-slate-600">
                      {m.kind === "sangria" ? "Sangria" : "Suprimento"}
                      {m.reason ? ` · ${m.reason}` : ""}
                    </span>
                    <span
                      className={cn(
                        "font-semibold tabular-nums",
                        m.kind === "sangria" ? "text-rose-600" : "text-emerald-600",
                      )}
                    >
                      {m.kind === "sangria" ? "−" : "+"}
                      {brl(m.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <aside className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-6rem)]">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Comanda</h3>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              {count} {count === 1 ? "item" : "itens"}
            </span>
          </div>
          {cart.length === 0 ? (
            <p className="mt-4 rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              Toque nos produtos do cardápio para começar.
            </p>
          ) : (
            <ul className="mt-3 flex-1 space-y-2 overflow-y-auto">
              {cart.map((l) => (
                <li key={l.id} className="rounded-lg border border-slate-100 bg-slate-50/50 p-2.5">
                  <div className="flex items-start justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-800">{l.name}</div>
                      {l.optionsLabel && (
                        <div className="truncate text-[11px] text-slate-500">{l.optionsLabel}</div>
                      )}
                    </div>
                    <button
                      onClick={() => setCart((c) => c.filter((x) => x.id !== l.id))}
                      className="text-slate-400 hover:text-rose-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <div className="inline-flex items-center rounded-md border border-slate-200 bg-white">
                      <button
                        onClick={() =>
                          setCart((c) =>
                            c
                              .map((x) => (x.id === l.id ? { ...x, qty: x.qty - 1 } : x))
                              .filter((x) => x.qty > 0),
                          )
                        }
                        className="px-2 py-1 text-slate-500 hover:bg-slate-50"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="min-w-[28px] px-2 text-center text-xs font-semibold">
                        {l.qty}
                      </span>
                      <button
                        onClick={() =>
                          setCart((c) =>
                            c.map((x) => (x.id === l.id ? { ...x, qty: x.qty + 1 } : x)),
                          )
                        }
                        className="px-2 py-1 text-slate-500 hover:bg-slate-50"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <span className="text-sm font-semibold text-slate-900 tabular-nums">
                      {brl(l.unitPrice * l.qty)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-sm">
            <Row label="Subtotal" value={subtotal} />
            <div className="flex items-center justify-between text-slate-600">
              <span className="inline-flex items-center gap-1">
                <Percent className="h-3.5 w-3.5" /> Desconto
              </span>
              <Input
                type="number"
                value={discount || ""}
                onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))}
                placeholder="0,00"
                className="h-7 w-20 text-right text-xs"
              />
            </div>
            <Row label="Total" value={total} bold />
          </div>
          <Button
            className="mt-4 h-11 w-full text-sm font-semibold"
            disabled={cart.length === 0 || saving || !cashOpen}
            onClick={() => setPayOpen(true)}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <DollarSign className="h-4 w-4" />
            )}
            Finalizar venda
          </Button>
          {!cashOpen && (
            <p className="mt-2 text-center text-xs text-slate-500">
              Abra o caixa para registrar vendas.
            </p>
          )}
        </aside>
      </div>

      {optionsFor && (
        <OptionsDialog
          product={optionsFor}
          onClose={() => setOptionsFor(null)}
          onConfirm={(ids, label, delta) => {
            pushLine(optionsFor, ids, label, delta);
            setOptionsFor(null);
          }}
        />
      )}

      <PdvPaymentModal
        open={payOpen}
        onOpenChange={setPayOpen}
        total={total}
        onConfirmed={(method) => {
          finalize(method);
        }}
      />

      <Dialog open={!!openDialog} onOpenChange={(v) => !v && setOpenDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {openDialog === "open" && "Abrir caixa"}
              {openDialog === "close" && "Fechar caixa"}
              {openDialog === "sangria" && "Registrar sangria"}
              {openDialog === "supri" && "Registrar suprimento"}
            </DialogTitle>
            <DialogDescription>
              {openDialog === "close"
                ? `Esperado em gaveta: ${summary ? brl(summary.expected) : "—"}. Informe o valor contado.`
                : "Informe o valor da operação."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Valor (R$)</label>
              <Input
                type="number"
                step="0.01"
                placeholder="0,00"
                value={dialogAmount}
                onChange={(e) => setDialogAmount(e.target.value)}
              />
            </div>
            {openDialog !== "open" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">
                  {openDialog === "close" ? "Observações" : "Motivo"}
                </label>
                <Input
                  value={dialogReason}
                  onChange={(e) => setDialogReason(e.target.value)}
                  placeholder="Opcional"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={runDialog} disabled={dialogBusy}>
              {dialogBusy && <Loader2 className="h-4 w-4 animate-spin" />} Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}

function OptionsDialog({
  product,
  onClose,
  onConfirm,
}: {
  product: Product;
  onClose: () => void;
  onConfirm: (ids: string[], label: string, delta: number) => void;
}) {
  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["pdv-options", product.id],
    queryFn: () => listOptionGroupsForProduct(product.id),
  });
  const [selected, setSelected] = React.useState<Record<string, string[]>>({});

  function toggle(g: OptionGroup, optionId: string) {
    setSelected((prev) => {
      const cur = prev[g.id] ?? [];
      const max = g.max_select || 1;
      if (cur.includes(optionId)) return { ...prev, [g.id]: cur.filter((x) => x !== optionId) };
      if (max === 1) return { ...prev, [g.id]: [optionId] };
      if (cur.length >= max) return prev;
      return { ...prev, [g.id]: [...cur, optionId] };
    });
  }

  function confirm() {
    const ids: string[] = [];
    const labels: string[] = [];
    let delta = 0;
    for (const g of groups) {
      const cur = selected[g.id] ?? [];
      if (g.required && cur.length < Math.max(1, g.min_select || 1)) {
        toast.error(`Selecione uma opção em "${g.name}".`);
        return;
      }
      for (const id of cur) {
        const o = g.options.find((x) => x.id === id);
        if (!o) continue;
        ids.push(o.id);
        labels.push(o.name);
        delta += Number(o.price_delta ?? 0);
      }
    }
    onConfirm(ids, labels.join(", "), delta);
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{product.name}</DialogTitle>
          <DialogDescription>Escolha as personalizações.</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="grid h-24 place-items-center">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((g) => (
              <div key={g.id}>
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  {g.name}
                  {g.required && <span className="ml-1 text-rose-500">*</span>}
                </div>
                <div className="mt-2 space-y-1.5">
                  {g.options.map((o) => {
                    const on = (selected[g.id] ?? []).includes(o.id);
                    return (
                      <button
                        key={o.id}
                        onClick={() => toggle(g, o.id)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-lg border p-2.5 text-sm transition",
                          on
                            ? "border-primary bg-primary/5 font-semibold text-primary"
                            : "border-slate-200 text-slate-700 hover:border-slate-300",
                        )}
                      >
                        <span>{o.name}</span>
                        {Number(o.price_delta) !== 0 && (
                          <span className="text-xs tabular-nums">
                            + {brl(Number(o.price_delta))}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={confirm}>Adicionar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CatChip({
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
        "rounded-full border px-3 py-1 text-xs font-semibold transition",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
      )}
    >
      {children}
    </button>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
      <div
        className={cn(
          "tabular-nums",
          strong ? "text-base font-bold text-slate-900" : "text-sm font-semibold text-slate-700",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between ${
        bold ? "text-base font-bold text-slate-900" : "text-slate-600"
      }`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{brl(value)}</span>
    </div>
  );
}
