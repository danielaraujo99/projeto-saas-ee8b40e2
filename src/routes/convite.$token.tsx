import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/custom-supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Store, ShieldCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { inviteErrorText, ROLE_LABEL } from "@/lib/admin/team";
import type { AdminRole } from "@/lib/admin/session";

export const Route = createFileRoute("/convite/$token")({
  head: () => ({
    meta: [
      { title: "Convite de equipe — MenuAltas" },
      { name: "description", content: "Aceite o convite para acessar o painel do restaurante." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InvitePage,
});

type Peek = {
  email: string;
  role: AdminRole;
  restaurant_name: string;
  expires_at: string;
  status: "pending" | "accepted" | "expired" | "revoked";
};

function InvitePage() {
  const { token } = Route.useParams();
  const nav = useNavigate();
  const [mode, setMode] = React.useState<"signin" | "signup">("signup");
  const [password, setPassword] = React.useState("");
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const q = useQuery({
    queryKey: ["invite", token],
    queryFn: async (): Promise<Peek | null> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("peek_restaurant_invite", {
        _token: token,
      });
      if (error) throw new Error(inviteErrorText(error.message));
      const row = Array.isArray(data) ? data[0] : data;
      return (row ?? null) as Peek | null;
    },
  });

  async function accept() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("accept_restaurant_invite", {
      _token: token,
    });
    if (error) throw new Error(inviteErrorText(error.message));
    const row = Array.isArray(data) ? data[0] : data;
    await supabase.auth.refreshSession();
    const role = (row?.role ?? "caixa") as AdminRole;
    toast.success(`Acesso liberado como ${ROLE_LABEL[role]}.`);
    if (role === "cozinha") nav({ to: "/admin/cozinha", replace: true });
    else nav({ to: "/admin/pedidos", replace: true });
  }

  async function submit() {
    const invite = q.data;
    if (!invite) return;
    setBusy(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        if (mode === "signup") {
          const { error } = await supabase.auth.signUp({
            email: invite.email,
            password,
            options: { data: { name: name.trim() || invite.email.split("@")[0] } },
          });
          if (error) throw new Error(error.message);
          const { error: signInErr } = await supabase.auth.signInWithPassword({
            email: invite.email,
            password,
          });
          if (signInErr) {
            toast.info("Confirme seu e-mail e abra este link novamente para concluir.");
            return;
          }
        } else {
          const { error } = await supabase.auth.signInWithPassword({
            email: invite.email,
            password,
          });
          if (error) throw new Error("E-mail ou senha inválidos.");
        }
      }
      await accept();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível aceitar o convite.");
    } finally {
      setBusy(false);
    }
  }

  if (q.isLoading) {
    return (
      <Center>
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </Center>
    );
  }

  const invite = q.data;
  if (!invite || invite.status !== "pending") {
    const text =
      !invite
        ? "Convite não encontrado."
        : invite.status === "accepted"
          ? "Este convite já foi utilizado."
          : invite.status === "revoked"
            ? "Este convite foi cancelado."
            : "Este convite expirou.";
    return (
      <Center>
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" />
          <h1 className="mt-3 text-lg font-bold text-slate-900">Convite indisponível</h1>
          <p className="mt-1 text-sm text-slate-500">{text}</p>
          <Button className="mt-4 w-full" onClick={() => nav({ to: "/admin/login", search: {} })}>
            Ir para o login
          </Button>
        </div>
      </Center>
    );
  }

  return (
    <Center>
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-primary">
          <Store className="h-5 w-5" />
          <span className="text-xs font-bold uppercase tracking-wide">Convite de equipe</span>
        </div>
        <h1 className="mt-2 text-xl font-bold text-slate-900">{invite.restaurant_name}</h1>
        <p className="mt-1 text-sm text-slate-500">
          Você foi convidado como{" "}
          <strong className="text-slate-800">{ROLE_LABEL[invite.role]}</strong> usando o e-mail{" "}
          <strong className="text-slate-800">{invite.email}</strong>.
        </p>

        <div className="mt-5 space-y-3">
          <div className="inline-flex rounded-lg bg-slate-100 p-1 text-xs font-semibold">
            <button
              className={`rounded-md px-3 py-1.5 ${mode === "signup" ? "bg-white shadow-sm" : "text-slate-500"}`}
              onClick={() => setMode("signup")}
            >
              Criar conta
            </button>
            <button
              className={`rounded-md px-3 py-1.5 ${mode === "signin" ? "bg-white shadow-sm" : "text-slate-500"}`}
              onClick={() => setMode("signin")}
            >
              Já tenho conta
            </button>
          </div>

          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="inv-name">Seu nome</Label>
              <Input id="inv-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="inv-pass">Senha</Label>
            <Input
              id="inv-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <Button className="w-full" onClick={submit} disabled={busy || password.length < 6}>
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            Aceitar convite
          </Button>
        </div>
      </div>
    </Center>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">{children}</div>
  );
}
