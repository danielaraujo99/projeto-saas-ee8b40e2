import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Ticket, Pencil, Trash2, Percent, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { useAdminSession } from "@/lib/admin/session";
import {
  listCoupons, createCoupon, updateCoupon, deleteCoupon, type CouponRow,
} from "@/lib/admin/coupons";
import { brl } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireAdminRole } from "@/lib/admin/role-guard";

export const Route = createFileRoute("/admin/cupons")({
  head: () => ({ meta: [{ title: "Cupons — MenuAltas" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: () => requireAdminRole(["admin"]),
  component: CuponsPage,
});

function CuponsPage() {
  const { data: session } = useAdminSession();
  const rid = session?.restaurantId;
  const qc = useQueryClient();

  const coupsQ = useQuery({
    queryKey: ["coupons", rid],
    queryFn: () => listCoupons(rid!),
    enabled: !!rid,
  });

  const [openCoupon, setOpenCoupon] = React.useState<CouponRow | "new" | null>(null);
  const coupons = coupsQ.data ?? [];

  return (
    <AdminShell title="Cupons e Promoções">
      <div className="px-4 py-6 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Cupons e Promoções</h2>
            <p className="text-sm text-slate-500">Ofereça descontos para atrair e fidelizar clientes.</p>
          </div>
          <Button onClick={() => setOpenCoupon("new")}>
            <Plus className="h-4 w-4" /> Novo cupom
          </Button>
        </div>

        {coupsQ.isLoading ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-400">
            Carregando…
          </div>
        ) : coupons.length === 0 ? (
          <div className="mt-6 grid place-items-center rounded-2xl border border-dashed border-slate-200 bg-white p-16 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-blue-600">
              <Ticket className="h-6 w-6" />
            </div>
            <div className="mt-3 text-sm font-semibold text-slate-800">Sem cupons ativos</div>
            <p className="mt-1 max-w-sm text-xs text-slate-500">
              Crie cupons percentuais ou de valor fixo para clientes.
            </p>
          </div>
        ) : (
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {coupons.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setOpenCoupon(c)}
                  className={cn(
                    "group relative w-full overflow-hidden rounded-xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
                    c.active ? "border-blue-200 bg-gradient-to-br from-blue-50 to-white" : "border-slate-200 bg-slate-50",
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <div className="font-mono text-lg font-black tracking-widest text-slate-900">{c.code}</div>
                      {c.description && (
                        <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">{c.description}</div>
                      )}
                    </div>
                    <span className={cn(
                      "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
                      c.kind === "percent" ? "bg-blue-100 text-blue-600" : "bg-emerald-100 text-emerald-600",
                    )}>
                      {c.kind === "percent" ? <Percent className="h-4 w-4" /> : <DollarSign className="h-4 w-4" />}
                    </span>
                  </div>
                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <div className="text-2xl font-black text-blue-600">
                        {c.kind === "percent" ? `${c.value}%` : brl(c.value)}
                      </div>
                      {c.min_order > 0 && (
                        <div className="text-[10px] uppercase tracking-wide text-slate-500">
                          Mín. {brl(c.min_order)}
                        </div>
                      )}
                    </div>
                    <div className="text-right text-[11px] text-slate-500">
                      {c.max_uses ? `${c.used_count}/${c.max_uses} usos` : `${c.used_count} usos`}
                      {c.expires_at && (
                        <div>Expira {new Date(c.expires_at).toLocaleDateString("pt-BR")}</div>
                      )}
                    </div>
                  </div>
                  {!c.active && (
                    <span className="absolute right-3 top-3 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      Inativo
                    </span>
                  )}
                  <Pencil className="absolute bottom-3 right-3 h-4 w-4 text-slate-300 transition group-hover:text-blue-500" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <CouponSheet
        open={openCoupon !== null}
        value={openCoupon}
        onClose={() => setOpenCoupon(null)}
        onSaved={() => qc.invalidateQueries({ queryKey: ["coupons", rid] })}
        restaurantId={rid ?? ""}
      />
    </AdminShell>
  );
}

function CouponSheet({
  open, value, onClose, onSaved, restaurantId,
}: {
  open: boolean;
  value: CouponRow | "new" | null;
  onClose: () => void;
  onSaved: () => void;
  restaurantId: string;
}) {
  const isNew = value === "new";
  const initial = isNew ? null : (value as CouponRow | null);

  const [code, setCode] = React.useState("");
  const [kind, setKind] = React.useState<"percent" | "fixed">("percent");
  const [val, setVal] = React.useState(10);
  const [minOrder, setMinOrder] = React.useState(0);
  const [maxUses, setMaxUses] = React.useState<number | "">("");
  const [expiresAt, setExpiresAt] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [active, setActive] = React.useState(true);

  React.useEffect(() => {
    if (!open) return;
    setCode(initial?.code ?? "");
    setKind(initial?.kind ?? "percent");
    setVal(initial?.value ?? 10);
    setMinOrder(initial?.min_order ?? 0);
    setMaxUses(initial?.max_uses ?? "");
    setExpiresAt(initial?.expires_at ? initial.expires_at.slice(0, 10) : "");
    setDescription(initial?.description ?? "");
    setActive(initial?.active ?? true);
  }, [open, initial]);

  const save = useMutation({
    mutationFn: async () => {
      if (!code.trim()) throw new Error("Informe o código");
      if (val <= 0) throw new Error("Valor inválido");
      const payload = {
        code: code.trim().toUpperCase(),
        kind,
        value: val,
        min_order: minOrder,
        max_uses: maxUses === "" ? null : Number(maxUses),
        expires_at: expiresAt ? new Date(expiresAt + "T23:59:59").toISOString() : null,
        description: description.trim() || null,
        active,
      };
      if (isNew) {
        await createCoupon({ restaurant_id: restaurantId, ...payload });
      } else if (initial) {
        await updateCoupon(initial.id, payload);
      }
    },
    onSuccess: () => { onSaved(); toast.success("Cupom salvo"); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async () => { if (initial) await deleteCoupon(initial.id); },
    onSuccess: () => { onSaved(); toast.success("Cupom removido"); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isNew ? "Novo cupom" : "Editar cupom"}</SheetTitle>
          <SheetDescription>Configure descontos por percentual ou valor fixo.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <label className="grid gap-1.5 text-xs font-medium text-slate-600">
            <span>Código</span>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Ex.: BEMVINDO10"
              className="font-mono uppercase tracking-widest"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(["percent","fixed"] as const).map((k) => (
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
                {k === "percent" ? "Percentual" : "Valor fixo"}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1.5 text-xs font-medium text-slate-600">
              <span>{kind === "percent" ? "Desconto (%)" : "Desconto (R$)"}</span>
              <Input type="number" step="0.01" value={val} onChange={(e) => setVal(Number(e.target.value))} />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-slate-600">
              <span>Pedido mínimo (R$)</span>
              <Input type="number" step="0.01" value={minOrder} onChange={(e) => setMinOrder(Number(e.target.value))} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1.5 text-xs font-medium text-slate-600">
              <span>Máx. usos (opcional)</span>
              <Input type="number" value={maxUses} onChange={(e) => setMaxUses(e.target.value === "" ? "" : Number(e.target.value))} />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-slate-600">
              <span>Expira em</span>
              <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </label>
          </div>
          <label className="grid gap-1.5 text-xs font-medium text-slate-600">
            <span>Descrição</span>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
            <div>
              <div className="text-sm font-medium text-slate-800">Cupom ativo</div>
              <div className="text-[11px] text-slate-500">Se desligar, clientes não conseguem usar.</div>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </label>
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
