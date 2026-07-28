import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/lib/custom-supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdaptiveSheet } from "@/components/adaptive-sheet";
import {
  Eye,
  EyeOff,
  Loader2,
  Store,
  Check,
  AlertTriangle,
  X,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import cadastroBg from "@/assets/cadastro-bg.mp4.asset.json";

export const Route = createFileRoute("/admin/cadastro")({
  head: () => ({
    meta: [
      { title: "Criar conta do restaurante — MenuAltas" },
      { name: "description", content: "Cadastre seu restaurante em minutos e comece a receber pedidos, organizar mesas e gerenciar o cardápio em um só painel." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SignupPage,
});

const CATEGORIES = [
  { id: "hamburgueria", label: "Hamburgueria", emoji: "🍔" },
  { id: "pizzaria", label: "Pizzaria", emoji: "🍕" },
  { id: "sushi", label: "Sushi", emoji: "🍣" },
  { id: "adega", label: "Adega", emoji: "🍷" },
  { id: "distribuidora", label: "Distribuidora", emoji: "🍺" },
  { id: "marmitas", label: "Marmitas", emoji: "🍱" },
  { id: "outros", label: "Outros", emoji: "🍽️" },
] as const;

function slugify(v: string) {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function formatPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function passwordStrength(pw: string): { score: number; label: string } {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return { score: s, label: ["Fraca", "Fraca", "Média", "Boa", "Forte"][s] };
}

type SlugState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "available"; slug: string }
  | { kind: "taken"; slug: string }
  | { kind: "invalid" };

function SignupPage() {
  const nav = useNavigate();
  const [name, setName] = React.useState("");
  const [restaurantName, setRestaurantName] = React.useState("");
  const [category, setCategory] = React.useState<string>("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [password2, setPassword2] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [show2, setShow2] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [catOpen, setCatOpen] = React.useState(false);
  const strength = passwordStrength(password);
  const selectedCat = CATEGORIES.find((c) => c.id === category);

  // Modo "finalizar cadastro": usuário já autenticado mas sem restaurante.
  // Nesse caso pulamos e-mail/senha e apenas coletamos dados do restaurante.
  const [authedUserId, setAuthedUserId] = React.useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;
      if (cancelled) return;
      if (!user) {
        setCheckingAuth(false);
        return;
      }
      // Já tem restaurante? Vai direto pro painel.
      const { data: member } = await supabase
        .from("restaurant_members")
        .select("role")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (member) {
        nav({ to: "/admin", replace: true });
        return;
      }
      setAuthedUserId(user.id);
      setEmail(user.email ?? "");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const meta = (user.user_metadata ?? {}) as any;
      if (meta.name) setName(meta.name);
      if (meta.phone) setPhone(formatPhone(String(meta.phone)));
      setCheckingAuth(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [nav]);

  const finalizeMode = !!authedUserId;

  // slug: auto-derived from name; user can edit
  const [slug, setSlug] = React.useState("");
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [slugState, setSlugState] = React.useState<SlugState>({ kind: "idle" });

  React.useEffect(() => {
    if (!slugTouched) setSlug(slugify(restaurantName));
  }, [restaurantName, slugTouched]);

  // debounced availability check
  React.useEffect(() => {
    const clean = slugify(slug);
    if (!clean) {
      setSlugState(slug ? { kind: "invalid" } : { kind: "idle" });
      return;
    }
    setSlugState({ kind: "checking" });
    let cancelled = false;
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc("is_slug_available", { _slug: clean });
      if (cancelled) return;
      if (error) {
        setSlugState({ kind: "idle" });
        return;
      }
      setSlugState(data ? { kind: "available", slug: clean } : { kind: "taken", slug: clean });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [slug]);

  const cleanSlug = slugify(slug);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!category) {
      setError("Escolha a categoria do restaurante.");
      return;
    }
    if (!finalizeMode) {
      if (password.length < 8) {
        setError("A senha deve ter pelo menos 8 caracteres.");
        return;
      }
      if (password !== password2) {
        setError("As senhas não coincidem.");
        return;
      }
    }
    if (phone.replace(/\D/g, "").length < 10) {
      setError("Informe um WhatsApp válido com DDD.");
      return;
    }
    if (!cleanSlug) {
      setError("Escolha um link público válido.");
      return;
    }
    if (slugState.kind === "taken") {
      setError("Este link já está em uso. Escolha outro.");
      return;
    }
    setBusy(true);

    // 1) Garante uma sessão autenticada ANTES de criar o restaurante.
    if (!finalizeMode) {
      const { data, error: signErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name, phone },
          emailRedirectTo: `${window.location.origin}/admin/cadastro`,
        },
      });
      if (signErr || !data.user) {
        setBusy(false);
        setError(
          signErr?.message === "User already registered"
            ? "Este e-mail já está cadastrado. Faça login para continuar."
            : (signErr?.message ?? "Falha ao criar conta."),
        );
        return;
      }
      if (!data.session) {
        // Tenta login imediato (caso confirmação de e-mail esteja desligada).
        const s = await supabase.auth.signInWithPassword({ email, password });
        if (s.error || !s.data.session) {
          setBusy(false);
          toast.info(
            "Conta criada! Confirme seu e-mail e volte para finalizar o cadastro do restaurante.",
          );
          nav({ to: "/admin/login", search: {} });
          return;
        }
      }
    }

    // 2) Cria o restaurante e vincula o usuário como admin (RPC SECURITY DEFINER).
    const { error: rpcErr } = await supabase.rpc("create_restaurant_with_slug", {
      _name: restaurantName,
      _slug: cleanSlug,
      _category: category,
      _phone: phone,
    });
    setBusy(false);
    if (rpcErr) {
      const msg = rpcErr.message ?? "";
      if (msg.includes("slug_taken")) {
        setError("Este link foi ocupado enquanto você preenchia. Escolha outro.");
        setSlugState({ kind: "taken", slug: cleanSlug });
        return;
      }
      if (msg.includes("already_has_restaurant")) {
        toast.success("Você já tem um restaurante vinculado. Redirecionando...");
        nav({ to: "/admin", replace: true });
        return;
      }
      if (msg.includes("not_authenticated")) {
        setError("Sua sessão expirou. Faça login e tente novamente.");
        return;
      }
      setError("Não foi possível criar o restaurante agora. Tente novamente em instantes.");
      return;
    }
    toast.success(`Restaurante criado! Seu link: menualtas.com.br/${cleanSlug}`);
    nav({ to: "/admin", replace: true });
  }


  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-2">
      {/* Coluna visual — fixa em desktop, não rola */}
      <aside className="relative hidden overflow-hidden bg-slate-900 p-10 text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:justify-between xl:p-12">
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={cadastroBg.url}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/70 via-slate-900/45 to-black/70" aria-hidden />
        <div className="relative flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/20 backdrop-blur">
            <Store className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold">MenuAltas</span>
        </div>
        <div className="relative max-w-md space-y-4">
          <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-white/85 backdrop-blur">
            Setup em 3 minutos · sem cartão de crédito
          </span>
          <h2 className="text-4xl font-black leading-tight">
            A fatia sai quente. O pedido já caiu no KDS.
          </h2>
          <p className="text-white/85">
            Do primeiro clique ao primeiro pedido impresso na cozinha: monte o cardápio, ligue o delivery e abra as mesas hoje. Sem instalação, sem taxa por pedido, sem enrolação.
          </p>
          <ul className="space-y-2 text-white/85">
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4" /> Cardápio digital com QR Code por mesa
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4" /> Impressão automática cozinha + balcão
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4" /> Fechamento de caixa em 1 clique
            </li>
          </ul>
        </div>
        <p className="relative text-sm text-white/60">© MenuAltas · Painel para restaurantes</p>
      </aside>

      {/* Coluna do formulário — rola independente */}
      <main className="flex min-h-screen items-start justify-center px-5 py-8 sm:px-8 sm:py-12 lg:h-screen lg:overflow-y-auto">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-[26px]">
            {finalizeMode ? "Finalizar cadastro do restaurante" : "Criar conta do restaurante"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {finalizeMode
              ? "Sua conta já existe. Falta só configurar o restaurante para começar."
              : "Crie seu cardápio digital e comece a receber pedidos hoje mesmo."}
          </p>

          {checkingAuth ? (
            <div className="mt-8 grid place-items-center py-10 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (


          <form onSubmit={submit} className="mt-5 space-y-3.5">
            <div className="grid gap-3.5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Seu nome</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rname">Nome do restaurante</Label>
                <Input
                  id="rname"
                  value={restaurantName}
                  onChange={(e) => setRestaurantName(e.target.value)}
                  placeholder="Ex.: Cantina do Zé"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <button
                type="button"
                onClick={() => setCatOpen(true)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition",
                  selectedCat
                    ? "border-slate-300 bg-white text-slate-900"
                    : "border-slate-200 bg-white text-slate-400 hover:border-slate-300",
                )}
              >
                <span className="flex items-center gap-2">
                  {selectedCat ? (
                    <>
                      <span aria-hidden className="text-base">{selectedCat.emoji}</span>
                      {selectedCat.label}
                    </>
                  ) : (
                    "Escolha o tipo do seu restaurante"
                  )}
                </span>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </button>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="slug">Link público do cardápio</Label>
              <div className="flex items-stretch overflow-hidden rounded-md border border-slate-200 focus-within:border-slate-400 focus-within:ring-1 focus-within:ring-slate-200">
                <span className="hidden place-items-center bg-slate-50 px-3 text-xs text-slate-500 sm:grid">
                  menualtas.com.br/
                </span>
                <span className="grid place-items-center bg-slate-50 px-2 text-xs text-slate-500 sm:hidden">
                  /
                </span>
                <input
                  id="slug"
                  className="min-w-0 flex-1 bg-white px-2 py-2 text-sm outline-none"
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"));
                  }}
                  placeholder="cantina-do-ze"
                />
                <span className="grid w-9 shrink-0 place-items-center bg-white pr-2">
                  {slugState.kind === "checking" ? (
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  ) : slugState.kind === "available" ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : slugState.kind === "taken" || slugState.kind === "invalid" ? (
                    <X className="h-4 w-4 text-rose-600" />
                  ) : null}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                {slugState.kind === "available" && (
                  <span className="text-emerald-600">
                    Disponível — <span className="font-medium">menualtas.com.br/{cleanSlug}</span>
                  </span>
                )}
                {slugState.kind === "taken" && (
                  <span className="text-rose-600">
                    <span className="font-medium">menualtas.com.br/{cleanSlug}</span> já está em uso. Escolha outro.
                  </span>
                )}
                {slugState.kind === "invalid" && (
                  <span className="text-rose-600">Use apenas letras, números e hífen.</span>
                )}
                {(slugState.kind === "idle" || slugState.kind === "checking") && (
                  <>
                    Seu link:{" "}
                    <span className="font-medium text-slate-700">
                      menualtas.com.br/{cleanSlug || "seu-restaurante"}
                    </span>
                  </>
                )}
              </p>
            </div>

            {finalizeMode ? (
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {email}
                </div>
                <p className="text-[11px] text-slate-500">
                  Você já está autenticado. Só falta cadastrar o restaurante.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                  />
                </div>

                <div className="grid gap-3.5 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="password">Senha</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={show ? "text" : "password"}
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                        onClick={() => setShow((s) => !s)}
                        aria-label={show ? "Ocultar" : "Mostrar"}
                      >
                        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {password ? (
                      <div className="flex items-center gap-2">
                        <div className="flex flex-1 gap-1">
                          {[0, 1, 2, 3].map((i) => (
                            <div
                              key={i}
                              className={cn(
                                "h-1 flex-1 rounded-full",
                                i < strength.score
                                  ? strength.score >= 3
                                    ? "bg-emerald-500"
                                    : "bg-amber-500"
                                  : "bg-slate-200",
                              )}
                            />
                          ))}
                        </div>
                        <span className="text-[11px] text-slate-500">{strength.label}</span>
                      </div>
                    ) : null}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password2">Confirmar</Label>
                    <div className="relative">
                      <Input
                        id="password2"
                        type={show2 ? "text" : "password"}
                        autoComplete="new-password"
                        value={password2}
                        onChange={(e) => setPassword2(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                        onClick={() => setShow2((s) => !s)}
                        aria-label={show2 ? "Ocultar" : "Mostrar"}
                      >
                        {show2 ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {password2 && password && password !== password2 ? (
                      <p className="text-[11px] text-rose-600">Não coincidem.</p>
                    ) : null}
                  </div>
                </div>
              </>
            )}


            <div className="space-y-1.5">
              <Label htmlFor="phone">WhatsApp pessoal (com DDD)</Label>
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                placeholder="(11) 99999-9999"
                maxLength={16}
                required
              />
              <p className="flex items-start gap-1.5 text-[11px] text-amber-800">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                Use o SEU número, não o do restaurante — é por onde falamos com o titular da conta.
              </p>
            </div>

            {error ? <p className="text-sm text-rose-600">{error}</p> : null}

            <Button
              type="submit"
              className="h-11 w-full font-semibold"
              disabled={busy || slugState.kind === "taken" || slugState.kind === "checking"}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Criar conta
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-500">
            Já tem conta?{" "}
            <Link to="/admin/login" search={{}} className="font-semibold text-primary hover:underline">
              Entrar
            </Link>
          </p>

          <p className="mt-4 text-center text-[11px] text-slate-400">
            Ao criar a conta você concorda com os{" "}
            <Link to="/" className="underline underline-offset-2 hover:text-slate-600">
              Termos de uso
            </Link>{" "}
            e a{" "}
            <Link to="/" className="underline underline-offset-2 hover:text-slate-600">
              Política de privacidade
            </Link>
            .
          </p>
        </div>
      </main>

      <AdaptiveSheet
        open={catOpen}
        onOpenChange={setCatOpen}
        title="Escolha a categoria"
        size="md"
      >
        <div className="px-5 pb-6 pt-5 sm:px-6">
          <div className="mb-1 text-base font-bold text-slate-900">Qual é o seu tipo de negócio?</div>
          <p className="mb-4 text-sm text-slate-500">
            Isso ajuda a preparar o cardápio inicial com o que faz sentido para você.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {CATEGORIES.map((c) => {
              const active = category === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setCategory(c.id);
                    setCatOpen(false);
                  }}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl border px-3 py-4 text-sm transition",
                    active
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                  )}
                >
                  <span aria-hidden className="text-2xl">{c.emoji}</span>
                  <span className="font-medium">{c.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </AdaptiveSheet>
    </div>
  );
}
