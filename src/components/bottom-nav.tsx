import * as React from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Search, ClipboardList, User2, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart } from "@/store/cart";
import { useAuth } from "@/store/auth";

const ITEMS = [
  { to: "/demo", label: "Início", icon: Home },
  { to: "/buscar", label: "Buscar", icon: Search },
  { to: "/pedidos", label: "Pedidos", icon: ClipboardList },
  { to: "/conta", label: "Conta", icon: User2 },
] as const;

// Routes where the bottom nav should NOT appear (full-screen flows).
const HIDDEN_PREFIXES = ["/", "/carrinho", "/checkout", "/pagamento", "/pedido", "/enderecos", "/auth", "/admin"];

function useShouldShowNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return !HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function BottomNav() {
  const show = useShouldShowNav();
  const itemCount = useCart((s) => s.itemCount());
  const user = useAuth((s) => s.user);

  if (!show) return null;
  return (
    <>
      {/* Mobile: fixed bottom bar */}
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <ul className="mx-auto flex max-w-md items-stretch justify-around px-2 py-1.5">
          {ITEMS.map((it) => (
            <li key={it.to} className="flex-1">
              <Link
                to={it.to}
                activeOptions={{ exact: it.to === "/demo" }}
                className="group flex flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-[11px] font-medium text-foreground/55 transition-colors data-[status=active]:text-primary"
              >
                <it.icon className="h-5 w-5 transition-transform group-data-[status=active]:scale-110" />
                <span>{it.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Desktop: top nav — balanced with brand on the left, nav center, cart/account on the right */}
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 top-0 z-40 hidden border-b border-border bg-background/90 backdrop-blur md:block"
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-6">
          <Link to="/demo" className="flex shrink-0 items-center gap-2 text-sm font-extrabold tracking-tight text-primary">
            <span
              aria-hidden
              className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground text-xs font-bold"
            >
              BA
            </span>
            MenuAtlas
          </Link>

          <div className="flex flex-1 items-center justify-center gap-1">
            {ITEMS.map((it) => (
              <Link
                key={it.to}
                to={it.to}
                activeOptions={{ exact: it.to === "/demo" }}
                className={cn(
                  "relative inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground/60 transition-colors hover:text-foreground",
                  "data-[status=active]:text-primary",
                  "after:pointer-events-none after:absolute after:inset-x-3 after:-bottom-[13px] after:h-0.5 after:rounded-full after:bg-primary after:opacity-0 data-[status=active]:after:opacity-100",
                )}
              >
                <it.icon className="h-4 w-4" />
                {it.label}
              </Link>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              to="/carrinho"
              aria-label="Carrinho"
              className={cn(
                "relative inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors",
                itemCount > 0
                  ? "border-transparent bg-primary text-primary-foreground hover:bg-primary/90"
                  : "border-border text-foreground/70 hover:bg-surface hover:text-foreground",
              )}
            >
              <ShoppingBag className="h-4 w-4" />
              {itemCount > 0 ? (
                <span className="rounded-full bg-primary-foreground/20 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums leading-none">
                  {itemCount}
                </span>
              ) : (
                <span className="hidden lg:inline">Carrinho</span>
              )}
            </Link>

            <Link
              to={user ? "/conta" : "/auth"}
              search={user ? undefined : ({ redirect: "/conta", mode: "login" } as never)}
              className="inline-flex h-9 max-w-[160px] items-center gap-2 rounded-full border border-border px-3 text-sm font-medium text-foreground/80 hover:bg-surface hover:text-foreground"
            >
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary-soft text-[11px] font-bold text-primary">
                {user ? user.name.trim().charAt(0).toUpperCase() : <User2 className="h-3.5 w-3.5" />}
              </span>
              <span className="hidden truncate lg:inline">{user ? user.name.split(" ")[0] : "Entrar"}</span>
            </Link>
          </div>
        </div>
      </nav>
    </>
  );
}

/** Spacer to add bottom padding on pages that show the bottom nav. */
export function BottomNavSpacer() {
  const show = useShouldShowNav();
  if (!show) return null;
  return <div className="h-16 md:h-0" aria-hidden />;
}
