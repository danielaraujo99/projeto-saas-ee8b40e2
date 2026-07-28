import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
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

export const Route = createFileRoute("/admin/pdv")({
  head: () => ({ meta: [{ title: "PDV — MenuAltas" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: () => requireAdminRole(["admin", "caixa"]),
  component: PdvPage,
});

type Line = { id: string; name: string; price: number; qty: number };

function PdvPage() {
  const [cart, setCart] = React.useState<Line[]>([]);
  const [openDialog, setOpenDialog] = React.useState<null | "open" | "close" | "sangria" | "supri">(null);
  const [cashOpen, setCashOpen] = React.useState(true);
  const [payOpen, setPayOpen] = React.useState(false);
  const [discount, setDiscount] = React.useState(0);
  const [addForm, setAddForm] = React.useState({ name: "", price: "" });

  const subtotal = cart.reduce((a, b) => a + b.price * b.qty, 0);
  const total = Math.max(0, subtotal - discount);
  const count = cart.reduce((a, b) => a + b.qty, 0);

  function addItem() {
    const name = addForm.name.trim();
    const price = Number(addForm.price);
    if (!name || !price || price <= 0) {
      toast.error("Informe nome e preço válidos.");
      return;
    }
    setCart((c) => [
      ...c,
      { id: crypto.randomUUID(), name, price, qty: 1 },
    ]);
    setAddForm({ name: "", price: "" });
  }

  return (
    <AdminShell title="PDV (Caixa)">
      <div className="grid gap-4 px-4 py-6 sm:px-8 lg:grid-cols-[minmax(0,1fr)_400px]">
        <section className="min-w-0 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Frente de caixa</h2>
                <p className="text-xs text-slate-500">
                  Caixa {cashOpen ? "aberto" : "fechado"} · Turno de hoje
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
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold text-slate-900">Adicionar item</div>
            <p className="text-xs text-slate-500">
              Cadastre produtos no cardápio para ter uma grade rápida. Enquanto isso, adicione livre:
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_140px_auto]">
              <Input
                placeholder="Nome do produto"
                value={addForm.name}
                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
              />
              <Input
                type="number"
                step="0.5"
                placeholder="Preço"
                value={addForm.price}
                onChange={(e) => setAddForm({ ...addForm, price: e.target.value })}
              />
              <Button onClick={addItem}>
                <Plus className="h-4 w-4" /> Adicionar
              </Button>
            </div>
          </div>
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
              Adicione produtos para começar.
            </p>
          ) : (
            <ul className="mt-3 flex-1 space-y-2 overflow-y-auto">
              {cart.map((l) => (
                <li key={l.id} className="rounded-lg border border-slate-100 bg-slate-50/50 p-2.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-800">{l.name}</span>
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
                            c.map((x) =>
                              x.id === l.id ? { ...x, qty: Math.max(1, x.qty - 1) } : x,
                            ),
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
                      R$ {(l.price * l.qty).toFixed(2)}
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
                onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                placeholder="0,00"
                className="h-7 w-20 text-right text-xs"
              />
            </div>
            <Row label="Total" value={total} bold />
          </div>
          <Button
            className="mt-4 h-11 w-full text-sm font-semibold"
            disabled={cart.length === 0}
            onClick={() => setPayOpen(true)}
          >
            <DollarSign className="h-4 w-4" /> Finalizar venda
          </Button>
        </aside>
      </div>

      <PdvPaymentModal
        open={payOpen}
        onOpenChange={setPayOpen}
        total={total}
        onConfirmed={() => {
          setCart([]);
          setDiscount(0);
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
                ? "Confirme o valor em dinheiro em caixa para conferência."
                : "Informe o valor da operação."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-600">Valor (R$)</label>
            <Input type="number" placeholder="0,00" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (openDialog === "open") setCashOpen(true);
                if (openDialog === "close") setCashOpen(false);
                toast.success("Operação registrada");
                setOpenDialog(null);
              }}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
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
      <span className="tabular-nums">R$ {value.toFixed(2)}</span>
    </div>
  );
}
