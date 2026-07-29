import * as React from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/store/auth";
import { Eye, EyeOff, LogIn, UserPlus, ArrowLeft, Loader2, UtensilsCrossed, Sparkles, Clock, BadgePercent } from "lucide-react";
import { toast } from "sonner";
import loginBg from "@/assets/login-bg.mp4.asset.json";
const BRAND_NAME = "MenuAtlas";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: `Entrar — ${BRAND_NAME}` },
      { name: "description", content: `Acesse sua conta para pedir no ${BRAND_NAME}: acompanhe pedidos, use cupons e finalize em poucos toques.` },
      { property: "og:title", content: `Entrar — ${BRAND_NAME}` },
      { property: "og:description", content: `Acesse sua conta para pedir no ${BRAND_NAME}: acompanhe pedidos, use cupons e finalize em poucos toques.` },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? (s.redirect as string) : undefined,
    mode: s.mode === "signup" ? ("signup" as const) : ("login" as const),
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const search = useSearch({ from: "/auth" });
  const safeRedirect = search.redirect?.startsWith("/") ? search.redirect : undefined;
  const [mode, setMode] = React.useState<"login" | "signup">(search.mode ?? "login");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [name, setName] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    setReady(true);
  }, []);

  const login = useAuth((s) => s.login);
  const signup = useAuth((s) => s.signup);
  const user = useAuth((s) => s.user);

  React.useEffect(() => {
    if (user) nav({ to: safeRedirect || "/demo", replace: true });
  }, [user, nav, safeRedirect]);

  function formatPhone(v: string) {
    const d = v.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }

  async function submit() {
    if (busy) return;
    setError(null);
    setBusy(true);
    const res =
      mode === "login"
        ? await login(email, password)
        : await signup({ name, email, phone: phone || undefined, password });
    setBusy(false);
    if (!res.ok) {
      setError(res.message ?? "Não foi possível continuar.");
      return;
    }
    toast.success(mode === "login" ? "Bem-vindo de volta!" : "Conta criada com sucesso!");
    nav({ to: safeRedirect || "/demo", replace: true });
  }

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      {/* Lado visual */}
      <div className="relative hidden overflow-hidden bg-slate-900 p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={loginBg.url}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/70 via-slate-900/40 to-black/70" aria-hidden />

        <div className="relative flex items-center gap-2">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15 backdrop-blur">
            <UtensilsCrossed className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <p className="text-xs uppercase tracking-[0.2em] text-white/70">Cardápio digital</p>
            <p className="text-lg font-bold">{BRAND_NAME}</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/85 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" /> Peça em 1 minuto
          </span>
          <h2 className="text-4xl font-black leading-[1.05] tracking-tight">
            Sua próxima refeição<br/>a um toque de distância.
          </h2>
          <p className="mt-4 text-white/85">
            Entre para salvar endereços, aplicar cupons exclusivos e acompanhar seu pedido do preparo à entrega — sem digitar tudo de novo.
          </p>

          <ul className="mt-6 space-y-2.5 text-sm">
            <li className="flex items-center gap-2 text-white/90">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-white/15 backdrop-blur"><Clock className="h-3.5 w-3.5" /></span>
              Checkout rápido com seus dados salvos
            </li>
            <li className="flex items-center gap-2 text-white/90">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-white/15 backdrop-blur"><BadgePercent className="h-3.5 w-3.5" /></span>
              Cupons e promoções direto na sua conta
            </li>
            <li className="flex items-center gap-2 text-white/90">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-white/15 backdrop-blur"><UtensilsCrossed className="h-3.5 w-3.5" /></span>
              Reencomende seus favoritos em dois toques
            </li>
          </ul>
        </div>

        <p className="relative text-xs text-white/60">
          © {new Date().getFullYear()} {BRAND_NAME} · Feito para quem ama comer bem.
        </p>
      </div>

      {/* Formulário */}
      <div className="relative flex items-center justify-center p-6 sm:p-10">
        <Link
          to="/demo"
          aria-label="Voltar ao cardápio"
          className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:bg-surface hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar ao cardápio
        </Link>

        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center gap-2 lg:hidden">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-primary-foreground">
              <UtensilsCrossed className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Cardápio digital</p>
              <p className="text-base font-bold">{BRAND_NAME}</p>
            </div>
          </div>

          <h1 className="text-3xl font-black tracking-tight text-foreground">
            {mode === "login" ? "Bem-vindo de volta" : "Crie sua conta"}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {mode === "login"
              ? "Entre para pedir mais rápido e acompanhar sua entrega."
              : "Leva menos de 30 segundos. Sem burocracia, só comida boa."}
          </p>

          <div className="mt-6 grid grid-cols-2 rounded-full bg-surface p-1 text-sm font-semibold">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={
                  mode === m
                    ? "rounded-full bg-background py-2 text-foreground shadow-[var(--shadow-card)]"
                    : "rounded-full py-2 text-muted-foreground hover:text-foreground"
                }
              >
                {m === "login" ? "Entrar" : "Criar conta"}
              </button>
            ))}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
            action={`/auth?mode=${mode}${safeRedirect ? `&redirect=${encodeURIComponent(safeRedirect)}` : ""}`}
            method="get"
            className="mt-5 space-y-4"
          >
            <input type="hidden" name="mode" value={mode} />
            {safeRedirect ? <input type="hidden" name="redirect" value={safeRedirect} /> : null}
            {mode === "signup" ? (
              <div className="space-y-1.5">
                <Label htmlFor="name">Nome completo</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Como devemos te chamar?"
                  autoComplete="name"
                  required
                />
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@email.com"
                autoComplete="email"
                required
              />
            </div>

            {mode === "signup" ? (
              <div className="space-y-1.5">
                <Label htmlFor="phone">
                  Telefone <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  placeholder="(11) 99999-9999"
                  autoComplete="tel"
                  maxLength={16}
                />
              </div>
            ) : null}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                {mode === "login" ? (
                  <button
                    type="button"
                    className="text-xs font-medium text-primary hover:underline"
                    onClick={() => toast.info("Em breve: recuperação de senha por e-mail.")}
                  >
                    Esqueci minha senha
                  </button>
                ) : null}
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "signup" ? "Mínimo 6 caracteres" : "Sua senha"}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? "Ocultar senha" : "Mostrar senha"}
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error ? (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <Button
              type="submit"
              className="h-12 w-full rounded-full text-base font-semibold"
              disabled={busy || !ready}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : mode === "login" ? (
                <LogIn className="h-4 w-4" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              {busy
                ? "Aguarde…"
                : !ready
                  ? "Carregando…"
                : mode === "login"
                  ? "Entrar"
                  : "Criar conta e continuar"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "login" ? (
              <>
                Ainda não tem conta?{" "}
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className="font-semibold text-primary hover:underline"
                >
                  Criar agora
                </button>
              </>
            ) : (
              <>
                Já tem conta?{" "}
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="font-semibold text-primary hover:underline"
                >
                  Fazer login
                </button>
              </>
            )}
          </p>

          <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground">
            Ao continuar você concorda com os Termos de uso e a Política de privacidade.
          </p>
        </div>
      </div>
    </div>
  );
}
