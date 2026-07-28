import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { brl } from "@/lib/format";
import {
  Plus, Pencil, Users as UsersIcon, Printer, ArrowRightLeft, Merge, Trash2, X,
  Clock, RefreshCw, CalendarDays, Receipt, Loader2,
} from "lucide-react";
import { useAdminSession } from "@/lib/admin/session";
import {
  listTables, listTableItems, createTable, deleteTable, updateTable,
  openTable, closeTable, transferTable, mergeTables,
  addTableItem, removeTableItem, type TableRow, type TableItem,
} from "@/lib/admin/tables";
import { listWaiters, type Waiter } from "@/lib/admin/waiters";
import { buildTableCheckHtml, loadPrintSettings, printHtml } from "@/lib/admin/printing";
import { requireAdminRole } from "@/lib/admin/role-guard";

export const Route = createFileRoute("/admin/mesas")({
  head: () => ({
    meta: [
      { title: "Mesas — Painel" },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: () => requireAdminRole(["admin", "caixa"]),
  component: MesasPage,
});

function MesasPage() {
  const { data: session } = useAdminSession();
  const rid = session?.restaurantId;
  const qc = useQueryClient();

  const tablesQ = useQuery({
    queryKey: ["tables", rid],
    queryFn: () => listTables(rid!),
    enabled: !!rid,
    refetchInterval: 15_000,
  });
  const waitersQ = useQuery({
    queryKey: ["waiters", rid],
    queryFn: () => listWaiters(rid!),
    enabled: !!rid,
  });

  const [openNew, setOpenNew] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const tables = tablesQ.data ?? [];
  const waiters = (waitersQ.data ?? []).filter((w) => w.active);
  const selected = selectedId ? tables.find((t) => t.id === selectedId) ?? null : null;

  const itemsQ = useQuery({
    queryKey: ["table-items", selectedId],
    queryFn: () => listTableItems(selectedId!),
    enabled: !!selectedId && selected?.status === "occupied",
  });

  // Totals for occupied tables (single batch fetch)
  const allItemsQ = useQuery({
    queryKey: ["all-table-items", rid],
    queryFn: async () => {
      const ids = tables.filter((t) => t.status === "occupied").map((t) => t.id);
      const map: Record<string, number> = {};
      await Promise.all(
        ids.map(async (id) => {
          const its = await listTableItems(id);
          map[id] = its.reduce((s, i) => s + i.qty * i.price, 0);
        }),
      );
      return map;
    },
    enabled: !!rid && tables.length > 0,
  });
  const totalsMap = allItemsQ.data ?? {};

  const stats = React.useMemo(() => {
    const occ = tables.filter((t) => t.status === "occupied").length;
    const free = tables.filter((t) => t.status === "free").length;
    const res = tables.filter((t) => t.status === "reserved").length;
    const revenue = Object.values(totalsMap).reduce((s, v) => s + v, 0);
    return { total: tables.length, occ, free, res, revenue };
  }, [tables, totalsMap]);
  const pct = (n: number) => (stats.total ? (n / stats.total) * 100 : 0);

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ["tables", rid] });
    qc.invalidateQueries({ queryKey: ["all-table-items", rid] });
    if (selectedId) qc.invalidateQueries({ queryKey: ["table-items", selectedId] });
  }

  const createM = useMutation({
    mutationFn: (v: { number: number; seats: number }) =>
      createTable({ restaurant_id: rid!, number: v.number, seats: v.seats }),
    onSuccess: () => { invalidateAll(); toast.success("Mesa criada"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteM = useMutation({
    mutationFn: (id: string) => deleteTable(id),
    onSuccess: () => { invalidateAll(); toast.success("Mesa removida"); setSelectedId(null); },
    onError: (e: Error) => toast.error(e.message),
  });
  const openM = useMutation({
    mutationFn: (v: { id: string; waiterId: string | null }) => openTable(v.id, v.waiterId),
    onSuccess: () => { invalidateAll(); toast.success("Comanda aberta"); setSelectedId(null); },
    onError: (e: Error) => toast.error(e.message),
  });
  const closeM = useMutation({
    mutationFn: (id: string) => closeTable(id),
    onSuccess: () => { invalidateAll(); toast.success("Conta fechada"); setSelectedId(null); },
    onError: (e: Error) => toast.error(e.message),
  });
  const reserveM = useMutation({
    mutationFn: (v: { id: string; name: string; time: string }) => {
      const iso = v.time ? new Date(new Date().toDateString() + " " + v.time).toISOString() : null;
      return updateTable(v.id, {
        status: "reserved",
        reservation_name: v.name || null,
        reservation_time: iso,
        waiter_id: null,
        opened_at: null,
      });
    },
    onSuccess: () => { invalidateAll(); toast.success("Mesa reservada"); setSelectedId(null); },
    onError: (e: Error) => toast.error(e.message),
  });
  const cancelResM = useMutation({
    mutationFn: (id: string) => updateTable(id, {
      status: "free", reservation_name: null, reservation_time: null,
    }),
    onSuccess: () => { invalidateAll(); toast.info("Reserva cancelada"); setSelectedId(null); },
    onError: (e: Error) => toast.error(e.message),
  });
  const arriveM = useMutation({
    mutationFn: async (v: { id: string; waiterId: string | null }) => {
      await updateTable(v.id, {
        status: "occupied",
        waiter_id: v.waiterId,
        opened_at: new Date().toISOString(),
        reservation_name: null,
        reservation_time: null,
      });
    },
    onSuccess: () => { invalidateAll(); toast.success("Cliente chegou · comanda aberta"); setSelectedId(null); },
    onError: (e: Error) => toast.error(e.message),
  });
  const addItemM = useMutation({
    mutationFn: (v: { name: string; qty: number; price: number }) =>
      addTableItem({ restaurant_id: rid!, table_id: selectedId!, ...v }),
    onSuccess: () => invalidateAll(),
    onError: (e: Error) => toast.error(e.message),
  });
  const removeItemM = useMutation({
    mutationFn: (id: string) => removeTableItem(id),
    onSuccess: () => invalidateAll(),
    onError: (e: Error) => toast.error(e.message),
  });
  const transferM = useMutation({
    mutationFn: (v: { from: string; to: string }) => transferTable(v.from, v.to),
    onSuccess: () => { invalidateAll(); toast.success("Comanda transferida"); setSelectedId(null); },
    onError: (e: Error) => toast.error(e.message),
  });
  const mergeM = useMutation({
    mutationFn: (v: { from: string; to: string }) => mergeTables(v.from, v.to),
    onSuccess: () => { invalidateAll(); toast.success("Mesas unificadas"); setSelectedId(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  async function printCheck(t: TableRow) {
    if (!rid) return;
    const items = await listTableItems(t.id);
    const settings = await loadPrintSettings(rid);
    const total = items.reduce((s, i) => s + i.qty * i.price, 0);
    printHtml(buildTableCheckHtml({
      title: `MESA-${String(t.number).padStart(2, "0")}`,
      items: items.map((i) => ({ name: i.name, qty: i.qty, price: i.price })),
      total,
      settings,
    }));
  }

  return (
    <AdminShell title="Mesas">
      <div className="space-y-5 px-4 py-6 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-2xl font-bold text-slate-900">Mapa do salão</h2>
            <p className="text-sm text-slate-500">Toque em uma mesa para operar comanda ou reserva.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => invalidateAll()}>
              <RefreshCw className="h-4 w-4" /> Atualizar
            </Button>
            <Button onClick={() => setOpenNew(true)}>
              <Plus className="h-4 w-4" /> Nova mesa
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Ocupadas" value={`${stats.occ} / ${stats.total}`} pct={pct(stats.occ)} tone="orange" icon={<UsersIcon className="h-4 w-4" />} />
          <MetricCard label="Livres" value={stats.free} pct={pct(stats.free)} tone="emerald" icon={<ChairGlyph className="h-4 w-4" />} />
          <MetricCard label="Reservadas" value={stats.res} pct={pct(stats.res)} tone="blue" icon={<CalendarDays className="h-4 w-4" />} />
          <MetricCard label="Consumo em aberto" value={brl(stats.revenue)} pct={100} tone="slate" icon={<Receipt className="h-4 w-4" />} />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-4 border-b border-slate-100 px-4 py-3 text-xs">
            <LegendDot cls="bg-emerald-500" label="Livre" />
            <LegendDot cls="bg-orange-500" label="Ocupada" />
            <LegendDot cls="bg-blue-500" label="Reservada" />
            <span className="ml-auto text-slate-400">
              {tablesQ.isFetching ? "Atualizando…" : "Ao vivo"}
            </span>
          </div>
          {tablesQ.isLoading ? (
            <div className="grid place-items-center p-16 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : tables.length === 0 ? (
            <div className="p-14 text-center">
              <div className="text-sm font-semibold text-slate-800">Nenhuma mesa cadastrada</div>
              <p className="mt-1 text-xs text-slate-500">Clique em “Nova mesa” para adicionar.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
              {tables.map((t) => (
                <TableCard key={t.id} t={t} total={totalsMap[t.id] ?? 0} onClick={() => setSelectedId(t.id)} />
              ))}
            </div>
          )}
        </div>
      </div>

      <NewTableSheet
        open={openNew}
        onOpenChange={setOpenNew}
        onCreate={(n, s) => createM.mutate({ number: n, seats: s })}
        nextNumber={Math.max(0, ...tables.map((t) => t.number)) + 1}
      />

      <TableActionSheet
        table={selected}
        allTables={tables}
        waiters={waiters}
        items={itemsQ.data ?? []}
        onClose={() => setSelectedId(null)}
        onOpen={(id, w) => openM.mutate({ id, waiterId: w })}
        onCloseCheck={(id) => closeM.mutate(id)}
        onAddItem={(name, qty, price) => addItemM.mutate({ name, qty, price })}
        onRemoveItem={(id) => removeItemM.mutate(id)}
        onTransfer={(from, to) => transferM.mutate({ from, to })}
        onMerge={(from, to) => mergeM.mutate({ from, to })}
        onDelete={(id) => deleteM.mutate(id)}
        onReserve={(id, name, time) => reserveM.mutate({ id, name, time })}
        onCancelReservation={(id) => cancelResM.mutate(id)}
        onArrive={(id, w) => arriveM.mutate({ id, waiterId: w })}
        onPrint={printCheck}
      />
    </AdminShell>
  );
}

/* ============= UI ============= */

const TONE = {
  orange: { text: "text-orange-600", bar: "bg-orange-500", chip: "bg-orange-50 text-orange-600" },
  emerald: { text: "text-emerald-600", bar: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-600" },
  blue: { text: "text-blue-600", bar: "bg-blue-500", chip: "bg-blue-50 text-blue-600" },
  slate: { text: "text-slate-900", bar: "bg-slate-900", chip: "bg-slate-100 text-slate-700" },
} as const;

function MetricCard({ label, value, pct, tone, icon }: {
  label: string; value: React.ReactNode; pct: number;
  tone: keyof typeof TONE; icon: React.ReactNode;
}) {
  const t = TONE[tone];
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</div>
          <div className={cn("mt-1 text-lg font-black tabular-nums leading-tight", t.text)}>{value}</div>
        </div>
        <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg", t.chip)}>{icon}</span>
      </div>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={cn("h-full rounded-full transition-all", t.bar)} style={{ width: `${Math.max(6, Math.min(100, pct))}%` }} />
      </div>
    </div>
  );
}

function LegendDot({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-slate-600">
      <span className={cn("h-2 w-2 rounded-full", cls)} />
      {label}
    </span>
  );
}

function TableCard({ t, total, onClick }: { t: TableRow; total: number; onClick: () => void }) {
  const config =
    t.status === "occupied"
      ? { border: "border-orange-200", bg: "bg-orange-50/60 hover:bg-orange-50", stroke: "#f97316", dot: "bg-orange-500", label: "Ocupada", labelCls: "text-orange-600" }
      : t.status === "reserved"
        ? { border: "border-blue-200", bg: "bg-blue-50/60 hover:bg-blue-50", stroke: "#3b82f6", dot: "bg-blue-500", label: "Reservada", labelCls: "text-blue-600" }
        : { border: "border-emerald-200", bg: "bg-white hover:bg-emerald-50/40", stroke: "#10b981", dot: "bg-emerald-500", label: "Livre", labelCls: "text-emerald-600" };

  const shape: "round" | "square" = t.seats >= 6 ? "square" : t.number % 2 === 1 ? "round" : "square";
  const resTime = t.reservation_time ? new Date(t.reservation_time) : null;

  return (
    <button
      onClick={onClick}
      className={cn(
        "group flex flex-col items-center gap-2 rounded-xl border p-3 text-center shadow-sm transition-all",
        "hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        config.border, config.bg,
      )}
      aria-label={`Mesa ${t.number}`}
    >
      <TableGlyph shape={shape} seats={t.seats} stroke={config.stroke} />
      <div className="text-xl font-black leading-none tracking-tight text-slate-900">{String(t.number).padStart(2, "0")}</div>
      <div className="flex items-center gap-1.5 text-[12px] font-medium">
        <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
        <span className={config.labelCls}>{config.label}</span>
      </div>
      <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums">
        {t.status === "occupied" ? (
          <span className="text-orange-600">{brl(total)}</span>
        ) : t.status === "reserved" ? (
          <span className="inline-flex items-center gap-1 text-blue-600">
            <Clock className="h-3 w-3" />
            {resTime ? resTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-slate-500">
            <UsersIcon className="h-3 w-3" />
            {t.seats} lugares
          </span>
        )}
      </div>
    </button>
  );
}

function TableGlyph({ shape, seats, stroke }: { shape: "round" | "square"; seats: number; stroke: string }) {
  const chairs = seats >= 6
    ? [{x:18,y:4,w:12,h:6},{x:34,y:4,w:12,h:6},{x:18,y:54,w:12,h:6},{x:34,y:54,w:12,h:6},{x:4,y:26,w:6,h:12},{x:54,y:26,w:6,h:12}]
    : [{x:26,y:4,w:12,h:6},{x:26,y:54,w:12,h:6},{x:4,y:26,w:6,h:12},{x:54,y:26,w:6,h:12}];
  return (
    <svg viewBox="0 0 64 64" className="h-14 w-14" fill="none" stroke={stroke} strokeWidth="1.8">
      {shape === "round" ? <circle cx="32" cy="32" r="14" /> : <rect x="18" y="18" width="28" height="28" rx="3" />}
      {chairs.map((c, i) => <rect key={i} x={c.x} y={c.y} width={c.w} height={c.h} rx="2" />)}
    </svg>
  );
}

function ChairGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 10V6a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v4" />
      <path d="M5 10h14l-1 6H6z" />
      <path d="M8 16v4M16 16v4" />
    </svg>
  );
}

function NewTableSheet({ open, onOpenChange, onCreate, nextNumber }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  onCreate: (n: number, s: number) => void; nextNumber: number;
}) {
  const [num, setNum] = React.useState(nextNumber);
  const [seats, setSeats] = React.useState(4);
  React.useEffect(() => { if (open) { setNum(nextNumber); setSeats(4); } }, [open, nextNumber]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Nova mesa</SheetTitle>
          <SheetDescription>Adicione ao mapa do salão.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="grid gap-1.5 text-xs font-medium text-slate-600">
            <span>Número</span>
            <Input type="number" value={num} onChange={(e) => setNum(Number(e.target.value))} />
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-slate-600">
            <span>Lugares</span>
            <Input type="number" value={seats} onChange={(e) => setSeats(Number(e.target.value))} />
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => { onCreate(num, seats); onOpenChange(false); }}>Criar mesa</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function TableActionSheet({
  table, allTables, waiters, items,
  onClose, onOpen, onCloseCheck, onAddItem, onRemoveItem,
  onTransfer, onMerge, onDelete, onReserve, onCancelReservation, onArrive, onPrint,
}: {
  table: TableRow | null;
  allTables: TableRow[];
  waiters: Waiter[];
  items: TableItem[];
  onClose: () => void;
  onOpen: (id: string, waiterId: string | null) => void;
  onCloseCheck: (id: string) => void;
  onAddItem: (name: string, qty: number, price: number) => void;
  onRemoveItem: (id: string) => void;
  onTransfer: (from: string, to: string) => void;
  onMerge: (from: string, to: string) => void;
  onDelete: (id: string) => void;
  onReserve: (id: string, name: string, time: string) => void;
  onCancelReservation: (id: string) => void;
  onArrive: (id: string, waiterId: string | null) => void;
  onPrint: (t: TableRow) => void;
}) {
  const [waiterId, setWaiterId] = React.useState("");
  const [name, setName] = React.useState("");
  const [qty, setQty] = React.useState(1);
  const [price, setPrice] = React.useState(0);
  const [transferTo, setTransferTo] = React.useState("");
  const [mergeTo, setMergeTo] = React.useState("");
  const [mode, setMode] = React.useState<"open" | "reserve">("open");
  const [reserveName, setReserveName] = React.useState("");
  const [reserveTime, setReserveTime] = React.useState("");

  const isOpen = !!table;
  const occupied = table?.status === "occupied";
  const reserved = table?.status === "reserved";

  React.useEffect(() => {
    if (!table) return;
    setWaiterId(table.waiter_id ?? "");
    setName(""); setQty(1); setPrice(0);
    setTransferTo(""); setMergeTo("");
    setMode("open"); setReserveName(""); setReserveTime("");
  }, [table]);

  if (!table) return null;

  const total = items.reduce((s, i) => s + i.qty * i.price, 0);
  const waiter = waiters.find((w) => w.id === table.waiter_id);
  const elapsed = table.opened_at ? Math.floor((Date.now() - new Date(table.opened_at).getTime()) / 60000) : 0;
  const resTime = table.reservation_time ? new Date(table.reservation_time) : null;

  return (
    <Sheet open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Mesa {table.number}
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              {table.seats} lugares
            </span>
          </SheetTitle>
          <SheetDescription>
            {reserved
              ? `Reservada${table.reservation_name ? " · " + table.reservation_name : ""}`
              : occupied
                ? `Ocupada há ${elapsed} min${waiter ? " · " + waiter.name : ""}`
                : "Mesa livre — abra uma comanda ou registre uma reserva."}
          </SheetDescription>
        </SheetHeader>

        {reserved ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">Reserva confirmada</div>
              <div className="mt-1 text-base font-semibold">{table.reservation_name ?? "Sem nome"}</div>
              {resTime && (
                <div className="mt-0.5 inline-flex items-center gap-1 text-xs text-blue-700">
                  <Clock className="h-3.5 w-3.5" /> Chegada prevista: {resTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </div>
              )}
            </div>
            <label className="grid gap-1.5 text-xs font-medium text-slate-600">
              <span>Garçom responsável</span>
              <Select value={waiterId} onValueChange={setWaiterId}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {waiters.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
            <div className="flex flex-wrap justify-between gap-2 pt-2">
              <Button variant="ghost" onClick={() => onCancelReservation(table.id)}>
                <X className="h-4 w-4 text-red-500" /> Cancelar reserva
              </Button>
              <Button onClick={() => onArrive(table.id, waiterId || null)}>Cliente chegou · abrir comanda</Button>
            </div>
          </div>
        ) : !occupied ? (
          <div className="mt-4 space-y-3">
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
              {(["open","reserve"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={cn(
                    "rounded-md px-3 py-1.5 font-medium transition",
                    mode === m ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900",
                  )}
                >
                  {m === "open" ? "Abrir comanda" : "Reservar"}
                </button>
              ))}
            </div>

            {mode === "open" ? (
              <>
                <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                  <span>Garçom responsável</span>
                  <Select value={waiterId} onValueChange={setWaiterId}>
                    <SelectTrigger><SelectValue placeholder={waiters.length ? "Selecionar" : "Cadastre em /admin/garcons"} /></SelectTrigger>
                    <SelectContent>
                      {waiters.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </label>
                <div className="flex justify-between gap-2 pt-2">
                  <Button variant="ghost" onClick={() => onDelete(table.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" /> Remover mesa
                  </Button>
                  <Button onClick={() => onOpen(table.id, waiterId || null)}>Abrir comanda</Button>
                </div>
              </>
            ) : (
              <>
                <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                  <span>Nome do cliente</span>
                  <Input value={reserveName} onChange={(e) => setReserveName(e.target.value)} placeholder="Ex.: Família Silva" />
                </label>
                <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                  <span>Horário previsto</span>
                  <Input type="time" value={reserveTime} onChange={(e) => setReserveTime(e.target.value)} />
                </label>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setMode("open")}>Cancelar</Button>
                  <Button onClick={() => {
                    if (!reserveName.trim()) { toast.error("Informe o nome"); return; }
                    onReserve(table.id, reserveName.trim(), reserveTime);
                  }}>
                    <CalendarDays className="h-4 w-4" /> Confirmar reserva
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Itens da comanda</div>
              {items.length === 0 ? (
                <div className="py-3 text-center text-sm text-slate-400">Nenhum item adicionado</div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {items.map((it) => (
                    <li key={it.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                      <span className="flex-1 truncate">{it.qty}× {it.name}</span>
                      <span className="tabular-nums text-slate-700">{brl(it.qty * it.price)}</span>
                      <button onClick={() => onRemoveItem(it.id)} className="text-slate-400 hover:text-red-500">
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-2 flex items-end gap-2 border-t border-slate-100 pt-3">
                <label className="flex-1 text-xs font-medium text-slate-600">
                  Item
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </label>
                <label className="w-16 text-xs font-medium text-slate-600">
                  Qtd
                  <Input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} />
                </label>
                <label className="w-24 text-xs font-medium text-slate-600">
                  Preço
                  <Input type="number" step={0.1} value={price} onChange={(e) => setPrice(Number(e.target.value))} />
                </label>
                <Button size="sm" onClick={() => {
                  if (!name.trim() || qty <= 0) return;
                  onAddItem(name, qty, price);
                  setName(""); setQty(1); setPrice(0);
                }}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
                <span className="font-medium text-slate-600">Total parcial</span>
                <span className="text-lg font-bold text-slate-900">{brl(total)}</span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-3">
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Transferir</div>
                <Select value={transferTo} onValueChange={setTransferTo}>
                  <SelectTrigger><SelectValue placeholder="Mesa livre" /></SelectTrigger>
                  <SelectContent>
                    {allTables.filter((x) => x.id !== table.id && x.status === "free").map((x) => (
                      <SelectItem key={x.id} value={x.id}>Mesa {x.number}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button className="mt-2 w-full" variant="outline" size="sm"
                  onClick={() => transferTo && onTransfer(table.id, transferTo)} disabled={!transferTo}>
                  <ArrowRightLeft className="h-4 w-4" /> Transferir
                </Button>
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Juntar com</div>
                <Select value={mergeTo} onValueChange={setMergeTo}>
                  <SelectTrigger><SelectValue placeholder="Mesa ocupada" /></SelectTrigger>
                  <SelectContent>
                    {allTables.filter((x) => x.id !== table.id && x.status === "occupied").map((x) => (
                      <SelectItem key={x.id} value={x.id}>Mesa {x.number}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button className="mt-2 w-full" variant="outline" size="sm"
                  onClick={() => mergeTo && onMerge(table.id, mergeTo)} disabled={!mergeTo}>
                  <Merge className="h-4 w-4" /> Unificar
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-3">
              <Button variant="outline" onClick={() => onPrint(table)}>
                <Printer className="h-4 w-4" /> Imprimir conta
              </Button>
              <Button onClick={() => onCloseCheck(table.id)}>Fechar conta</Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
