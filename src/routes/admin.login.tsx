import * as React from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { supabase } from "@/lib/custom-supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff, LogIn, Loader2, Store } from "lucide-react";
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

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) nav({ to: search.redirect || "/admin", replace: true });
    });
  }, [nav, search.redirect]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNeedsConfirm(false);
    setBusy(true);
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
    nav({ to: search.redirect || "/admin", replace: true });
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

            <Button type="submit" className="h-11 w-full text-base font-semibold" disabled={busy}>
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
