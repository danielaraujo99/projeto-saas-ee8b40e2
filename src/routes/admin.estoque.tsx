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
import {
  Plus, ArrowDownCircle, Boxes, Pencil, Trash2, AlertTriangle, TrendingDown, TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { useAdminSession } from "@/lib/admin/session";
import {
  listStockItems, createStockItem, updateStockItem, deleteStockItem,
  registerMovement, listMovements, type StockItem,
} from "@/lib/admin/stock";
import { brl } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireAdminRole } from "@/lib/admin/role-guard";

export const Route = createFileRoute("/admin/estoque")({
  head: () => ({ meta: [{ title: "Estoque — MenuAltas" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: () => requireAdminRole(["admin"]),
  component: EstoquePage,
});

function EstoquePage() {
  const { data: session } = useAdminSession();
  const rid = session?.restaurantId;
  const qc = useQueryClient();

  const itemsQ = useQuery({
    queryKey: ["stock-items", rid],
    queryFn: () => listStockItems(rid!),
    enabled: !!rid,
  });
  const movsQ = useQuery({
    queryKey: ["stock-movs", rid],
    queryFn: () => listMovements(rid!, 20),
    enabled: !!rid,
  });

  const [openItem, setOpenItem] = React.useState<StockItem | "new" | null>(null);
  const [openMove, setOpenMove] = React.useState(false);

  const items = itemsQ.data ?? [];
  const low = items.filter((i) => i.qty <= i.min_qty && i.min_qty > 0);
  const totalValue = items.reduce((s, i) => s + i.qty * i.cost, 0);

  return (
    <AdminShell title="Estoque">
      <div className="px-4 py-6 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Estoque</h2>
            <p className="text-sm text-slate-500">Controle de insumos e movimentações.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpenMove(true)}>
              <ArrowDownCircle className="h-4 w-4" /> Registrar entrada
            </Button>
            <Button onClick={() => setOpenItem("new")}>
              <Plus className="h-4 w-4" /> Novo item
            </Button>
          </div>
        </div>

        {/* Métricas */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Metric label="Itens cadastrados" value={String(items.length)} tone="blue" icon={<Boxes className="h-4 w-4" />} />
          <Metric label="Valor em estoque" value={brl(totalValue)} tone="emerald" icon={<TrendingUp className="h-4 w-4" />} />
          <Metric label="Abaixo do mínimo" value={String(low.length)} tone="orange" icon={<AlertTriangle className="h-4 w-4" />} />
        </div>

        {/* Lista */}
        <section className="mt-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
            Insumos
          </div>
          {itemsQ.isLoading ? (
            <div className="p-10 text-center text-sm text-slate-400">Carregando…</div>
          ) : items.length === 0 ? (
            <div className="p-16 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-blue-600">
                <Boxes className="h-6 w-6" />
              </div>
              <div className="mt-3 text-sm font-semibold text-slate-800">Nenhum item em estoque</div>
              <p className="mt-1 text-xs text-slate-500">
                Cadastre insumos para controlar entradas, saídas e alertas de baixo estoque.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/60 text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Insumo</th>
                    <th className="px-4 py-2 font-semibold">Quantidade</th>
                    <th className="px-4 py-2 font-semibold">Mínimo</th>
                    <th className="px-4 py-2 font-semibold">Custo un.</th>
                    <th className="px-4 py-2 font-semibold">Valor</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => {
                    const alert = i.min_qty > 0 && i.qty <= i.min_qty;
                    return (
                      <tr key={i.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                        <td className="px-4 py-2.5 font-medium text-slate-800">{i.name}</td>
                        <td className={cn("px-4 py-2.5 tabular-nums", alert && "font-bold text-orange-600")}>
                          {i.qty} {i.unit}
                        </td>
                        <td className="px-4 py-2.5 tabular-nums text-slate-500">{i.min_qty} {i.unit}</td>
                        <td className="px-4 py-2.5 tabular-nums text-slate-700">{brl(i.cost)}</td>
                        <td className="px-4 py-2.5 tabular-nums font-semibold text-slate-900">{brl(i.qty * i.cost)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={() => setOpenItem(i)}
                            className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-blue-600"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Movimentações */}
        <section className="mt-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
            Últimas movimentações
          </div>
          {(movsQ.data ?? []).length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">Sem movimentações registradas.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {(movsQ.data ?? []).map((m) => {
                const item = items.find((i) => i.id === m.item_id);
                const isIn = m.kind === "in";
                return (
                  <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <div className="flex items-center gap-2.5">
                      <span className={cn(
                        "grid h-7 w-7 place-items-center rounded-lg",
                        isIn ? "bg-emerald-50 text-emerald-600" : m.kind === "out" ? "bg-orange-50 text-orange-600" : "bg-blue-50 text-blue-600",
                      )}>
                        {isIn ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                      </span>
                      <div>
                        <div className="font-medium text-slate-800">{item?.name ?? "Item removido"}</div>
                        <div className="text-[11px] text-slate-500">
                          {new Date(m.created_at).toLocaleString("pt-BR")}
                          {m.note ? ` · ${m.note}` : ""}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={cn("text-sm font-bold tabular-nums", isIn ? "text-emerald-600" : "text-orange-600")}>
                        {isIn ? "+" : "-"}{m.qty} {item?.unit ?? ""}
                      </div>
                      {m.cost > 0 && <div className="text-[11px] text-slate-500">{brl(m.cost)}</div>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <ItemSheet
        open={openItem !== null}
        value={openItem}
        onClose={() => setOpenItem(null)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["stock-items", rid] });
          qc.invalidateQueries({ queryKey: ["stock-movs", rid] });
        }}
        restaurantId={rid ?? ""}
      />
      <MovementSheet
        open={openMove}
        onClose={() => setOpenMove(false)}
        items={items}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["stock-items", rid] });
          qc.invalidateQueries({ queryKey: ["stock-movs", rid] });
        }}
        restaurantId={rid ?? ""}
      />
    </AdminShell>
  );
}

const TONE = {
  blue: "bg-blue-50 text-blue-600",
  emerald: "bg-emerald-50 text-emerald-600",
  orange: "bg-orange-50 text-orange-600",
} as const;

function Metric({ label, value, tone, icon }: {
  label: string; value: string; tone: keyof typeof TONE; icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
          <div className="mt-1 text-xl font-black tabular-nums text-slate-900">{value}</div>
        </div>
        <span className={cn("grid h-8 w-8 place-items-center rounded-lg", TONE[tone])}>{icon}</span>
      </div>
    </div>
  );
}

function ItemSheet({
  open, value, onClose, onSaved, restaurantId,
}: {
  open: boolean;
  value: StockItem | "new" | null;
  onClose: () => void;
  onSaved: () => void;
  restaurantId: string;
}) {
  const isNew = value === "new";
  const initial = isNew ? null : (value as StockItem | null);
  const [name, setName] = React.useState("");
  const [unit, setUnit] = React.useState("un");
  const [qty, setQty] = React.useState(0);
  const [minQty, setMinQty] = React.useState(0);
  const [cost, setCost] = React.useState(0);

  React.useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setUnit(initial?.unit ?? "un");
    setQty(initial?.qty ?? 0);
    setMinQty(initial?.min_qty ?? 0);
    setCost(initial?.cost ?? 0);
  }, [open, initial]);

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Informe o nome");
      if (isNew) {
        await createStockItem({
          restaurant_id: restaurantId, name: name.trim(), unit, qty, min_qty: minQty, cost,
        });
      } else if (initial) {
        await updateStockItem(initial.id, {
          name: name.trim(), unit, qty, min_qty: minQty, cost,
        });
      }
    },
    onSuccess: () => { onSaved(); toast.success("Item salvo"); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async () => { if (initial) await deleteStockItem(initial.id); },
    onSuccess: () => { onSaved(); toast.success("Item removido"); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isNew ? "Novo item de estoque" : "Editar item"}</SheetTitle>
          <SheetDescription>Cadastre insumos para acompanhar consumo.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <label className="grid gap-1.5 text-xs font-medium text-slate-600">
            <span>Nome</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Farinha de trigo" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1.5 text-xs font-medium text-slate-600">
              <span>Unidade</span>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["un","kg","g","L","ml","cx","pct"].map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-slate-600">
              <span>Quantidade atual</span>
              <Input type="number" step="0.001" value={qty} onChange={(e) => setQty(Number(e.target.value))} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1.5 text-xs font-medium text-slate-600">
              <span>Estoque mínimo</span>
              <Input type="number" step="0.001" value={minQty} onChange={(e) => setMinQty(Number(e.target.value))} />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-slate-600">
              <span>Custo por unidade (R$)</span>
              <Input type="number" step="0.01" value={cost} onChange={(e) => setCost(Number(e.target.value))} />
            </label>
          </div>
        </div>
        <div className="mt-6 flex justify-between gap-2">
          {!isNew ? (
            <Button variant="ghost" onClick={() => del.mutate()} disabled={del.isPending}>
              <Trash2 className="h-4 w-4 text-red-500" /> Excluir
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MovementSheet({
  open, onClose, items, onSaved, restaurantId,
}: {
  open: boolean;
  onClose: () => void;
  items: StockItem[];
  onSaved: () => void;
  restaurantId: string;
}) {
  const [itemId, setItemId] = React.useState("");
  const [kind, setKind] = React.useState<"in" | "out" | "adjust">("in");
  const [qty, setQty] = React.useState(0);
  const [cost, setCost] = React.useState(0);
  const [note, setNote] = React.useState("");

  React.useEffect(() => {
    if (open) { setItemId(""); setKind("in"); setQty(0); setCost(0); setNote(""); }
  }, [open]);

  const save = useMutation({
    mutationFn: async () => {
      if (!itemId) throw new Error("Selecione o insumo");
      if (qty <= 0 && kind !== "adjust") throw new Error("Informe a quantidade");
      await registerMovement({
        restaurant_id: restaurantId,
        item_id: itemId, kind, qty, cost, note: note.trim() || null,
      });
    },
    onSuccess: () => { onSaved(); toast.success("Movimento registrado"); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Registrar movimentação</SheetTitle>
          <SheetDescription>Entrada, saída ou ajuste de estoque.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <label className="grid gap-1.5 text-xs font-medium text-slate-600">
            <span>Insumo</span>
            <Select value={itemId} onValueChange={setItemId}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                {items.map((i) => (
                  <SelectItem key={i.id} value={i.id}>{i.name} ({i.qty} {i.unit})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(["in","out","adjust"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-xs font-semibold transition",
                  kind === k
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                )}
              >
                {k === "in" ? "Entrada" : k === "out" ? "Saída" : "Ajuste"}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1.5 text-xs font-medium text-slate-600">
              <span>Quantidade</span>
              <Input type="number" step="0.001" value={qty} onChange={(e) => setQty(Number(e.target.value))} />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-slate-600">
              <span>Custo total (R$)</span>
              <Input type="number" step="0.01" value={cost} onChange={(e) => setCost(Number(e.target.value))} />
            </label>
          </div>
          <label className="grid gap-1.5 text-xs font-medium text-slate-600">
            <span>Observação</span>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: NF 12345, fornecedor…" />
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Registrar</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
