import * as React from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ClipboardList,
  ChefHat,
  Menu,
  LogOut,
  Loader2,
  Calculator,
  UtensilsCrossed,
  Boxes,
  Ticket,
  Users,
  Star,
  Wallet,
  Shield,
  Settings,
  UserRound,
  Grid3x3,
  Truck,
  Printer,
} from "lucide-react";
import { supabase } from "@/lib/custom-supabase";
import { useAdminSession, type AdminRole } from "@/lib/admin/session";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
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
import { cn } from "@/lib/utils";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: AdminRole[];
};

const NAV: NavItem[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, roles: ["admin"] },
  { to: "/admin/pedidos", label: "Pedidos", icon: ClipboardList, roles: ["admin", "caixa"] },
  { to: "/admin/entregas", label: "Entregas", icon: Truck, roles: ["admin", "caixa"] },
  { to: "/admin/mesas", label: "Mesas", icon: Grid3x3, roles: ["admin", "caixa"] },
  { to: "/admin/garcons", label: "Garçons", icon: UserRound, roles: ["admin"] },
  { to: "/admin/pdv", label: "PDV (Caixa)", icon: Calculator, roles: ["admin", "caixa"] },
  { to: "/admin/cardapio", label: "Cardápio", icon: UtensilsCrossed, roles: ["admin"] },
  { to: "/admin/estoque", label: "Estoque", icon: Boxes, roles: ["admin"] },
  { to: "/admin/cupons", label: "Cupons e Promoções", icon: Ticket, roles: ["admin"] },
  { to: "/admin/clientes", label: "Clientes", icon: Users, roles: ["admin"] },
  { to: "/admin/avaliacoes", label: "Avaliações", icon: Star, roles: ["admin"] },
  { to: "/admin/financeiro", label: "Financeiro", icon: Wallet, roles: ["admin"] },
  { to: "/admin/equipe", label: "Equipe e Permissões", icon: Shield, roles: ["admin"] },
  { to: "/admin/impressao", label: "Impressão", icon: Printer, roles: ["admin"] },
  { to: "/admin/configuracoes", label: "Configurações", icon: Settings, roles: ["admin"] },
];

export function AdminShell({
  title,
  children,
  minimal = false,
}: {
  title: string;
  children: React.ReactNode;
  minimal?: boolean;
}) {
  const nav = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { data: session, isLoading } = useAdminSession();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [logoutOpen, setLogoutOpen] = React.useState(false);

  // Guarda de rota + role
  React.useEffect(() => {
    if (isLoading) return;
    if (!session) {
      nav({ to: "/admin/login", search: { redirect: path } as never });
      return;
    }
    if (session.needsSelection) {
      nav({ to: "/admin/selecionar-restaurante", replace: true });
      return;
    }
    if (session.role === "cozinha" && path !== "/admin/cozinha") {
      nav({ to: "/admin/cozinha", replace: true });
    }
  }, [session, isLoading, path, nav]);


  if (isLoading || !session) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const items = NAV.filter((n) => n.roles.includes(session.role));

  async function signOut() {
    await supabase.auth.signOut();
    nav({ to: "/admin/login", search: {}, replace: true });
  }

  if (minimal) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50">
        <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 font-semibold">
            <ChefHat className="h-5 w-5 text-amber-400" />
            <span>{session.restaurantName} · Cozinha</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLogoutOpen(true)}
            className="text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </header>
        <main>{children}</main>
        <LogoutDialog open={logoutOpen} onOpenChange={setLogoutOpen} onConfirm={signOut} />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar desktop */}
      <aside className="hidden h-screen w-64 shrink-0 bg-slate-950 text-slate-200 lg:flex lg:flex-col">
        <SidebarInner items={items} path={path} restaurantName={session.restaurantName} />
      </aside>

      {/* Sidebar drawer mobile */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 border-none bg-slate-950 p-0 text-slate-200">
          <VisuallyHidden asChild>
            <SheetTitle>Menu</SheetTitle>
          </VisuallyHidden>
          <SidebarInner
            items={items}
            path={path}
            restaurantName={session.restaurantName}
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Área de conteúdo */}
      <div className="flex h-screen min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="truncate text-base font-bold text-slate-900 sm:text-lg">{title}</h1>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1 text-sm hover:bg-slate-50">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {(session.profileName || "?").slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden max-w-[140px] truncate sm:block">
                  {session.profileName}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                {session.role === "admin"
                  ? "Administrador"
                  : session.role === "caixa"
                    ? "Caixa"
                    : "Cozinha"}
                <span className="mt-0.5 block truncate text-[11px] font-normal text-slate-400">
                  {session.restaurantName}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {session.memberships.length > 1 && (
                <>
                  <DropdownMenuItem onSelect={() => nav({ to: "/admin/selecionar-restaurante" })}>
                    <Store className="h-4 w-4" />
                    Trocar restaurante
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onSelect={() => setLogoutOpen(true)}>
                <LogOut className="h-4 w-4" />
                Sair da conta
              </DropdownMenuItem>
            </DropdownMenuContent>

          </DropdownMenu>
        </header>
        <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>

      <LogoutDialog open={logoutOpen} onOpenChange={setLogoutOpen} onConfirm={signOut} />
    </div>
  );
}

function SidebarInner({
  items,
  path,
  restaurantName,
  onNavigate,
}: {
  items: NavItem[];
  path: string;
  restaurantName: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-white text-slate-900 font-black">
          M
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-white">{restaurantName}</div>
          <div className="text-[11px] uppercase tracking-wide text-slate-400">
            Painel administrativo
          </div>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {items.map((n) => {
          const active =
            n.to === "/admin"
              ? path === "/admin"
              : path === n.to || path.startsWith(n.to + "/");
          const Icon = n.icon;
          return (
            <Link
              key={n.to}
              to={n.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-white/10 text-white"
                  : "text-slate-400 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 px-4 py-3 text-[11px] text-slate-500">
        MenuAltas · v1.0
      </div>
    </div>
  );
}

function LogoutDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sair da conta?</AlertDialogTitle>
          <AlertDialogDescription>
            Você precisará entrar novamente para acessar o painel.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Ficar aqui</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Sair</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
