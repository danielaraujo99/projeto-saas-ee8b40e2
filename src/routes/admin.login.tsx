import * as React from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { supabase } from "@/lib/custom-supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff, LogIn, Loader2, LogOut, Store } from "lucide-react";
import { toast } from "sonner";
import loginBg from "@/assets/login-bg.mp4.asset.json";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [
      { title: "Entrar no painel — Restaurante Demo" },
      { name: "description", content: "Acesse o painel administrativo do seu restaurante." },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? (s.redirect as string) : undefined,
  }),
  component: LoginPage,
});

function LoginPage() {
  const nav = useNavigate();
  const search = useSearch({ from: "/admin/login" });
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = React.useState(false);
  const [resending, setResending] = React.useState(false);
  const [checkingSession, setCheckingSession] = React.useState(true);
  const [signedInEmail, setSignedInEmail] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (cancelled) return;
      if (!user) {
        setCheckingSession(false);
        return;
      }

      const { data: rows } = await supabase
        .from("restaurant_members")
        .select("restaurant_id")
        .eq("user_id", user.id);
      if (cancelled) return;
      const memberships = rows ?? [];
      if (memberships.length === 0) {
        setSignedInEmail(user.email ?? "esta conta");
        setEmail(user.email ?? "");
        setCheckingSession(false);
        return;
      }

      const meta = (user.app_metadata ?? {}) as Record<string, unknown>;
      const activeId = typeof meta.active_restaurant_id === "string" ? meta.active_restaurant_id : null;
      const hasValidActive = !!activeId && memberships.some((m) => m.restaurant_id === activeId);

      if (memberships.length === 1 || hasValidActive) {
        nav({ to: search.redirect || "/admin", replace: true });
        return;
      }
      // Múltiplos restaurantes e nenhum ativo — precisa escolher explicitamente.
      nav({ to: "/admin/selecionar-restaurante", replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [nav, search.redirect]);


  async function signOutCurrent() {
    setBusy(true);
    await supabase.auth.signOut();
    setSignedInEmail(null);
    setPassword("");
    setBusy(false);
    toast.success("Sessão encerrada.");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNeedsConfirm(false);
    setBusy(true);
    if (signedInEmail) {
      await supabase.auth.signOut();
      setSignedInEmail(null);
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
        setNeedsConfirm(true);
        setError("Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada (e a pasta de spam).");
      } else if (msg.includes("invalid login") || msg.includes("invalid_credentials")) {
        setError("E-mail ou senha inválidos. Verifique e tente novamente.");
      } else {
        setError(error.message || "Não foi possível entrar agora. Tente novamente.");
      }
      return;
    }
    toast.success("Bem-vindo de volta!");
    // Decide destino com base em quantos restaurantes o usuário é membro.
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes.user;
    if (!user) {
      nav({ to: search.redirect || "/admin", replace: true });
      return;
    }
    const { data: rows } = await supabase
      .from("restaurant_members")
      .select("restaurant_id")
      .eq("user_id", user.id);
    const memberships = rows ?? [];
    if (memberships.length === 0) {
      nav({ to: "/admin/cadastro", replace: true });
      return;
    }
    const meta = (user.app_metadata ?? {}) as Record<string, unknown>;
    const activeId = typeof meta.active_restaurant_id === "string" ? meta.active_restaurant_id : null;
    const hasValidActive = !!activeId && memberships.some((m) => m.restaurant_id === activeId);
    if (memberships.length === 1 || hasValidActive) {
      nav({ to: search.redirect || "/admin", replace: true });
      return;
    }
    nav({ to: "/admin/selecionar-restaurante", replace: true });

  }

  async function resendConfirmation() {
    if (!email) {
      setError("Digite seu e-mail para reenviar a confirmação.");
      return;
    }
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/admin/login` },
    });
    setResending(false);
    if (error) {
      toast.error(error.message || "Falha ao reenviar e-mail de confirmação.");
      return;
    }
    toast.success("E-mail de confirmação reenviado. Cheque sua caixa de entrada.");
  }


  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-2">
      {/* Painel de identidade */}
      <div className="relative hidden overflow-hidden bg-slate-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <video
          className="absolute inset-0 h-full w-full object-cover opacity-80 brightness-110 contrast-105"
          src={loginBg.url}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/35 via-slate-800/25 to-black/45" aria-hidden />
        <div className="relative flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/20 backdrop-blur">
            <Store className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold">MenuAltas</span>
        </div>
        <div className="relative max-w-md">
          <span className="mb-3 inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-white/80 backdrop-blur">
            Painel administrativo
          </span>
          <h2 className="text-4xl font-black leading-tight">
            Operação no ritmo certo, resultados na medida.
          </h2>
          <p className="mt-4 text-white/85">
            Receba pedidos, organize mesas e entregas, ajuste seu cardápio e acompanhe o
            caixa em tempo real. Tudo em um só lugar, para você focar no que realmente importa.
          </p>
        </div>
        <p className="relative text-sm text-white/60">© MenuAltas · Painel para restaurantes</p>
      </div>

      {/* Formulário */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center gap-2 lg:hidden">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-white">
              <Store className="h-4 w-4" />
            </div>
            <span className="text-base font-bold">MenuAltas</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900">Entrar</h1>
          <p className="mt-1 text-sm text-slate-500">
            Acesse com o e-mail cadastrado do restaurante.
          </p>

          {checkingSession ? (
            <div className="mt-6 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Verificando sessão...
            </div>
          ) : null}

          {signedInEmail && !checkingSession ? (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-semibold">Cadastro do restaurante pendente</p>
              <p className="mt-1 text-amber-800">
                Você está conectado como {signedInEmail}, mas essa conta ainda não tem restaurante.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  size="sm"
                  className="h-9"
                  onClick={() => nav({ to: "/admin/cadastro", replace: true })}
                >
                  Finalizar cadastro
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 bg-white"
                  onClick={signOutCurrent}
                  disabled={busy}
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sair da conta
                </Button>
              </div>
            </div>
          ) : null}

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                autoComplete="email"
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                <Link
                  to="/admin/recuperar-senha"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Esqueci minha senha
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={show ? "text" : "password"}
                  value={password}
                  autoComplete="current-password"
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? "Ocultar senha" : "Mostrar senha"}
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-600">
              <Checkbox defaultChecked /> Manter-me conectado
            </label>

            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
            {needsConfirm ? (
              <button
                type="button"
                onClick={resendConfirmation}
                disabled={resending}
                className="text-sm font-medium text-primary hover:underline disabled:opacity-60"
              >
                {resending ? "Reenviando..." : "Reenviar e-mail de confirmação"}
              </button>
            ) : null}


            <Button type="submit" className="h-11 w-full text-base font-semibold" disabled={busy || checkingSession}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              Entrar
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Ainda não tem conta?{" "}
            <Link to="/admin/cadastro" className="font-semibold text-primary hover:underline">
              Cadastrar restaurante
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
