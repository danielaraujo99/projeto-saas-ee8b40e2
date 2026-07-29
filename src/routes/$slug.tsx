import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { HomePage } from "./index";
import { MenuProvider } from "@/components/menu-context";
import { fetchMenuBySlug } from "@/lib/storefront";
import { Loader2, SearchX, Home, UtensilsCrossed } from "lucide-react";

export const Route = createFileRoute("/$slug")({
  head: () => ({
    meta: [
      { title: "Cardápio digital" },
      { name: "description", content: "Peça pelo cardápio digital do restaurante." },
    ],
  }),
  component: SlugStorefront,
});

function SlugStorefront() {
  const { slug } = Route.useParams();
  const q = useQuery({
    queryKey: ["storefront", slug],
    queryFn: () => fetchMenuBySlug(slug),
    staleTime: 30_000,
  });

  if (q.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!q.data) {
    return (
      <div className="min-h-screen bg-background px-4 pb-24 pt-10 md:pt-24">
        <div className="mx-auto max-w-md">
          <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
            <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-primary-soft text-primary">
              <SearchX className="h-7 w-7" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Restaurante não encontrado</h1>
            <p className="mt-2 text-sm leading-relaxed text-foreground/65">
              O endereço{" "}
              <span className="rounded-md bg-surface px-1.5 py-0.5 font-mono text-xs text-foreground/80">
                /{slug}
              </span>{" "}
              não existe ou o restaurante está temporariamente indisponível.
            </p>

            <div className="mt-6 flex flex-col gap-2">
              <Link
                to="/"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-95"
              >
                <Home className="h-4 w-4" /> Ir para o início
              </Link>
              <Link
                to="/buscar"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-border bg-background px-5 text-sm font-semibold text-foreground hover:bg-surface"
              >
                <UtensilsCrossed className="h-4 w-4" /> Explorar restaurantes
              </Link>
            </div>

            <p className="mt-6 text-[11px] text-foreground/50">
              Se você é o dono deste restaurante, verifique se o slug está correto no painel administrativo.
            </p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <MenuProvider
      categories={q.data.categories}
      products={q.data.products}
      restaurantId={q.data.restaurantId}
      restaurantSlug={q.data.slug}
      restaurantName={q.data.restaurantName}
      restaurant={q.data.restaurant}
    >
      <HomePage />
    </MenuProvider>
  );
}

