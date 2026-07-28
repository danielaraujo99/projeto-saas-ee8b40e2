import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin/admin-shell";
import { useAdminSession } from "@/lib/admin/session";
import {
  listWaiters,
  createWaiter,
  updateWaiter,
  deleteWaiter,
  getWaiterStats,
  type Waiter,
} from "@/lib/admin/waiters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, UserRound } from "lucide-react";
import { brl } from "@/lib/format";
import { requireAdminRole } from "@/lib/admin/role-guard";

export const Route = createFileRoute("/admin/garcons")({
  head: () => ({
    meta: [
      { title: "Garçons — Painel" },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: () => requireAdminRole(["admin"]),
  component: WaitersPage,
});

function WaitersPage() {
  const { data: session } = useAdminSession();
  const rid = session?.restaurantId;
  const qc = useQueryClient();

  const { data: waiters, isLoading } = useQuery({
    queryKey: ["waiters", rid],
    queryFn: () => listWaiters(rid!),
    enabled: !!rid,
  });
  const { data: stats } = useQuery({
    queryKey: ["waiter-stats", rid],
    queryFn: () => getWaiterStats(rid!),
    enabled: !!rid,
  });

  const [openForm, setOpenForm] = React.useState(false);
  const [editing, setEditing] = React.useState<Waiter | null>(null);
  const [confirmDel, setConfirmDel] = React.useState<Waiter | null>(null);

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["waiters", rid] });
    await qc.invalidateQueries({ queryKey: ["waiter-stats", rid] });
  }

  return (
    <AdminShell title="Garçons">
      <div className="px-4 py-6 sm:px-8">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Garçons</h2>
            <p className="text-sm text-slate-500">
              Equipe de salão. O PIN identifica quem abre e opera cada comanda de mesa.
            </p>
          </div>
          <Button
            onClick={() => {
              setEditing(null);
              setOpenForm(true);
            }}
          >
            <Plus className="h-4 w-4" /> Novo garçom
          </Button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          {!waiters || waiters.length === 0 ? (
            <div className="grid h-48 place-items-center text-sm text-slate-500">
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              ) : (
                "Nenhum garçom cadastrado."
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Garçom</th>
                  <th className="px-4 py-2.5">PIN</th>
                  <th className="px-4 py-2.5">Comandas abertas</th>
                  <th className="px-4 py-2.5">Total atendido</th>
                  <th className="px-4 py-2.5">Ticket médio</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {waiters.map((w) => {
                  const s = stats?.[w.id];
                  return (
                    <tr key={w.id}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          {w.photo_url ? (
                            <img
                              src={w.photo_url}
                              alt={w.name}
                              className="h-9 w-9 rounded-full object-cover"
                            />
                          ) : (
                            <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary">
                              <UserRound className="h-4 w-4" />
                            </div>
                          )}
                          <span className="font-medium text-slate-800">{w.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700">{w.pin}</td>
                      <td className="px-4 py-3 text-slate-700">{s?.open_tables ?? 0}</td>
                      <td className="px-4 py-3 text-slate-700">{brl(s?.total_value ?? 0)}</td>
                      <td className="px-4 py-3 text-slate-700">{brl(s?.ticket_avg ?? 0)}</td>
                      <td className="px-4 py-3">
                        <Switch
                          checked={w.active}
                          onCheckedChange={async (v) => {
                            await updateWaiter(w.id, { active: v });
                            await refresh();
                          }}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setEditing(w);
                              setOpenForm(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setConfirmDel(w)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <WaiterFormSheet
        open={openForm}
        onOpenChange={setOpenForm}
        editing={editing}
        restaurantId={rid}
        onSaved={refresh}
      />

      <AlertDialog open={!!confirmDel} onOpenChange={(v) => !v && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover garçom?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDel?.name} não poderá mais operar mesas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!confirmDel) return;
                try {
                  await deleteWaiter(confirmDel.id);
                  toast.success("Garçom removido");
                  setConfirmDel(null);
                  await refresh();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Falha ao remover");
                }
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}

function WaiterFormSheet({
  open,
  onOpenChange,
  editing,
  restaurantId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Waiter | null;
  restaurantId?: string;
  onSaved: () => void;
}) {
  const [name, setName] = React.useState("");
  const [pin, setPin] = React.useState("");
  const [photo, setPhoto] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setName(editing?.name ?? "");
      setPin(editing?.pin ?? "");
      setPhoto(editing?.photo_url ?? "");
    }
  }, [open, editing]);

  async function save() {
    if (!restaurantId) return;
    if (!name.trim() || !pin.trim()) {
      toast.error("Nome e PIN são obrigatórios");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateWaiter(editing.id, { name, pin, photo_url: photo || null });
        toast.success("Garçom atualizado");
      } else {
        await createWaiter({
          restaurant_id: restaurantId,
          name,
          pin,
          photo_url: photo || null,
        });
        toast.success("Garçom cadastrado");
      }
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Falha ao salvar. Rode 'salao-setup.sql' no Supabase.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{editing ? "Editar garçom" : "Novo garçom"}</SheetTitle>
          <SheetDescription>Dados de identificação e acesso rápido.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <label className="grid gap-1.5 text-xs font-medium text-slate-600">
            <span>Nome</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-slate-600">
            <span>Código / PIN de acesso</span>
            <Input
              value={pin}
              maxLength={8}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            />
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-slate-600">
            <span>Foto (URL, opcional)</span>
            <Input
              placeholder="https://…"
              value={photo}
              onChange={(e) => setPhoto(e.target.value)}
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
