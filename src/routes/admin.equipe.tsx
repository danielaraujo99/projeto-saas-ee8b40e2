import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus, Copy, Loader2, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { useAdminSession, type AdminRole } from "@/lib/admin/session";
import { requireAdminRole } from "@/lib/admin/role-guard";
import {
  ROLE_LABEL,
  createInvite,
  inviteErrorText,
  inviteLink,
  inviteStatus,
  listInvites,
  listTeamMembers,
  removeMember,
  revokeInvite,
  updateMemberRole,
  type TeamInvite,
} from "@/lib/admin/team";

export const Route = createFileRoute("/admin/equipe")({
  head: () => ({ meta: [{ title: "Equipe — MenuAltas" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: () => requireAdminRole(["admin"]),
  component: EquipePage,
});

const ROLES: AdminRole[] = ["admin", "caixa", "cozinha"];

function EquipePage() {
  const qc = useQueryClient();
  const { data: session } = useAdminSession();
  const restaurantId = session?.restaurantId;

  const membersQ = useQuery({
    queryKey: ["admin-team", restaurantId],
    queryFn: () => listTeamMembers(restaurantId!),
    enabled: !!restaurantId,
  });
  const invitesQ = useQuery({
    queryKey: ["admin-invites", restaurantId],
    queryFn: () => listInvites(restaurantId!),
    enabled: !!restaurantId,
  });

  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<AdminRole>("caixa");
  const [busy, setBusy] = React.useState(false);
  const [lastLink, setLastLink] = React.useState<string | null>(null);
  const [removing, setRemoving] = React.useState<{ userId: string; name: string } | null>(null);

  async function submitInvite() {
    if (!restaurantId) return;
    setBusy(true);
    try {
      const res = await createInvite({ restaurantId, email, role });
      const link = inviteLink(res.token);
      setLastLink(link);
      await navigator.clipboard.writeText(link).catch(() => undefined);
      toast.success("Convite criado — link copiado para a área de transferência.");
      setEmail("");
      qc.invalidateQueries({ queryKey: ["admin-invites", restaurantId] });
    } catch (err) {
      toast.error(err instanceof Error ? inviteErrorText(err.message) : "Falha ao convidar.");
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(userId: string, next: AdminRole) {
    if (!restaurantId) return;
    try {
      await updateMemberRole({ restaurantId, userId, role: next });
      toast.success("Papel atualizado. Vale a partir do próximo login do membro.");
      qc.invalidateQueries({ queryKey: ["admin-team", restaurantId] });
    } catch {
      toast.error("Não foi possível alterar o papel.");
    }
  }

  async function confirmRemove() {
    if (!restaurantId || !removing) return;
    try {
      await removeMember({ restaurantId, userId: removing.userId });
      toast.success("Acesso removido.");
      qc.invalidateQueries({ queryKey: ["admin-team", restaurantId] });
    } catch {
      toast.error("Não foi possível remover o acesso.");
    } finally {
      setRemoving(null);
    }
  }

  const members = membersQ.data ?? [];
  const invites = (invitesQ.data ?? []).filter((i) => inviteStatus(i) === "pending");

  return (
    <AdminShell title="Equipe e Permissões">
      <div className="px-4 py-6 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Equipe e Permissões</h2>
            <p className="text-sm text-slate-500">Membros que acessam o painel.</p>
          </div>
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-4 w-4" /> Convidar membro
          </Button>
        </div>

        {membersQ.isError && (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {inviteErrorText(
              membersQ.error instanceof Error ? membersQ.error.message : "Falha ao carregar.",
            )}
          </p>
        )}

        <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">Papel</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {membersQ.isLoading && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-slate-400">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              )}
              {!membersQ.isLoading && members.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-sm text-slate-400">
                    Nenhum membro cadastrado.
                  </td>
                </tr>
              )}
              {members.map((m) => {
                const isSelf = m.user_id === session?.user.id;
                return (
                  <tr key={m.user_id}>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {m.name ?? "—"}
                      {isSelf && <span className="ml-2 text-xs text-slate-400">(você)</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{m.email ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Select
                        value={m.role}
                        disabled={isSelf}
                        onValueChange={(v) => changeRole(m.user_id, v as AdminRole)}
                      >
                        <SelectTrigger className="h-8 w-32 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => (
                            <SelectItem key={r} value={r}>
                              {ROLE_LABEL[r]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isSelf}
                        className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                        onClick={() =>
                          setRemoving({ userId: m.user_id, name: m.name ?? m.email ?? "membro" })
                        }
                      >
                        <Trash2 className="h-4 w-4" /> Remover
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <h3 className="mt-8 text-sm font-bold uppercase tracking-wide text-slate-500">
          Convites pendentes
        </h3>
        <div className="mt-3 space-y-2">
          {invites.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
              Nenhum convite pendente.
            </p>
          )}
          {invites.map((inv) => (
            <InviteRow
              key={inv.id}
              invite={inv}
              onRevoke={async () => {
                try {
                  await revokeInvite(inv.id);
                  toast.success("Convite cancelado.");
                  qc.invalidateQueries({ queryKey: ["admin-invites", restaurantId] });
                } catch (err) {
                  toast.error(
                    err instanceof Error ? inviteErrorText(err.message) : "Falha ao cancelar.",
                  );
                }
              }}
            />
          ))}
        </div>
      </div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Convidar membro</DialogTitle>
            <DialogDescription>
              O convidado recebe um link válido por 7 dias e entra com o e-mail informado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="inv-email">E-mail</Label>
              <Input
                id="inv-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="pessoa@email.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Papel</Label>
              <Select value={role} onValueChange={(v) => setRole(v as AdminRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {lastLink && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                  <Check className="h-3.5 w-3.5" /> Link do convite
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded bg-white px-2 py-1 text-[11px] text-slate-600">
                    {lastLink}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(lastLink);
                      toast.success("Link copiado.");
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              Fechar
            </Button>
            <Button onClick={submitInvite} disabled={busy || !email.trim()}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Gerar convite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removing} onOpenChange={(v) => !v && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover acesso</AlertDialogTitle>
            <AlertDialogDescription>
              {removing?.name} perderá o acesso ao painel deste restaurante. Esta ação pode ser
              desfeita com um novo convite.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}

function InviteRow({ invite, onRevoke }: { invite: TeamInvite; onRevoke: () => void }) {
  const link = inviteLink(invite.token);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-slate-800">{invite.email}</div>
        <div className="text-xs text-slate-500">
          {ROLE_LABEL[invite.role]} · expira em{" "}
          {new Date(invite.expires_at).toLocaleDateString("pt-BR")}
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            navigator.clipboard.writeText(link);
            toast.success("Link copiado.");
          }}
        >
          <Copy className="h-3.5 w-3.5" /> Copiar link
        </Button>
        <Button size="sm" variant="ghost" className="text-rose-600" onClick={onRevoke}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
