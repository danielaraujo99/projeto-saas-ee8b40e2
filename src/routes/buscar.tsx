import * as React from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search as SearchIcon, SearchX, Star, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { listActiveRestaurants } from "@/lib/storefront";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/buscar")({
  head: () => ({
    meta: [
      { title: "Buscar restaurantes — MenuAtlas" },
      { name: "description", content: "Descubra restaurantes e lanchonetes perto de você." },
      { property: "og:title", content: "Buscar restaurantes — MenuAtlas" },
      { property: "og:description", content: "Descubra restaurantes e lanchonetes perto de você." },
    ],
  }),
  component: Page,
});

const SUGGESTIONS = ["Hambúrguer", "Pizza", "Japonesa", "Açaí", "Vegana", "Doces"];

function Page() {
  const [q, setQ] = React.useState("");
  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["active-restaurants"],
    queryFn: listActiveRestaurants,
    staleTime: 60_000,
  });

  const results = React.useMemo(() => {
    if (!q.trim()) return cards;
    const s = q.toLowerCase();
    return cards.filter(
      (c) => c.name.toLowerCase().includes(s) || (c.category ?? "").toLowerCase().includes(s),
    );
  }, [q, cards]);

  return (
    <div className="min-h-screen bg-background pb-24 md:pt-20">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur md:hidden">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <h1 className="text-lg font-bold">Buscar</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Restaurantes, cozinhas, pratos…"
            className="h-12 rounded-2xl pl-11 text-base"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setQ(s)}
              className={cn(
                "rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground/70 transition-colors hover:border-primary hover:bg-primary-soft hover:text-primary",
                q === s && "border-primary bg-primary-soft text-primary",
              )}
            >
              {s}
            </button>
          ))}
        </div>

        {isLoading ? (
          <ul className="mt-6 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <li key={i}>
                <Skeleton className="h-24 w-full rounded-2xl" />
              </li>
            ))}
          </ul>
        ) : results.length === 0 ? (
          <EmptyState
            className="my-8"
            icon={<SearchX className="h-6 w-6" />}
            title="Nenhum restaurante encontrado"
            description={
              q.trim()
                ? `Não encontramos nada para "${q.trim()}". Tente outro termo.`
                : "Nenhum restaurante ativo no momento."
            }
          />
        ) : (
          <>
            <h2 className="mt-6 text-sm font-semibold text-foreground/70">
              {results.length} restaurante{results.length === 1 ? "" : "s"} encontrado
              {results.length === 1 ? "" : "s"}
            </h2>

            <ul className="mt-3 space-y-3">
              {results.map((c) => (
                <li key={c.id}>
                  <Link
                    to="/$slug"
                    params={{ slug: c.slug }}
                    className="flex gap-3 overflow-hidden rounded-2xl border border-border bg-card p-3 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-elevated)]"
                  >
                    <div
                      className="h-20 w-20 shrink-0 rounded-xl bg-cover bg-center"
                      style={{ backgroundImage: `url(${c.cover})` }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-base font-bold text-foreground">{c.name}</div>
                      {c.category ? (
                        <div className="line-clamp-1 text-xs text-foreground/60">{c.category}</div>
                      ) : null}
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-foreground/70">
                        <span className="inline-flex items-center gap-1">
                          <Star className="h-3 w-3 fill-warning text-warning" /> {c.rating.toFixed(1)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {c.minutes[0]}–{c.minutes[1]} min
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}
