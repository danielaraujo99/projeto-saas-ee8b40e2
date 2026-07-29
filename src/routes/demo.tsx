import * as React from "react";
import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { supabase } from "@/lib/custom-supabase";
import { SearchX, Home } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */
const sb = supabase as any;

/**
 * /demo é apenas um atalho — redireciona para o slug real do restaurante
 * de demonstração para que a renderização passe pelo fluxo canônico /$slug.
 * Não recria layout: reaproveita 100% do que já funciona em /testeteste etc.
 */
export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Demo — MenuAtlas" },
      {
        name: "description",
        content:
          "Experimente o cardápio digital MenuAtlas em uma demonstração interativa.",
      },
      { property: "og:title", content: "Demo — MenuAtlas" },
      {
        property: "og:description",
        content: "Cardápio digital de demonstração do MenuAtlas.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: async () => {
    // 1) tenta slug 'demo'
    const preferred = await sb
      .from("restaurants")
      .select("slug")
      .eq("slug", "demo")
      .eq("active", true)
      .maybeSingle();
    let slug: string | null = preferred?.data?.slug ?? null;

    // 2) fallback: primeiro restaurante ativo
    if (!slug) {
      const first = await sb
        .from("restaurants")
        .select("slug")
        .eq("active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      slug = first?.data?.slug ?? null;
    }

    if (slug) {
      throw redirect({ to: "/$slug", params: { slug } });
    }
    // sem restaurante ativo -> renderiza fallback
  },
  component: DemoFallback,
});

function DemoFallback() {
  return (
    <div className="min-h-screen bg-background px-4 pb-24 pt-10 md:pt-24">
      <div className="mx-auto max-w-md">
        <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
          <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-primary-soft text-primary">
            <SearchX className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Demo indisponível</h1>
          <p className="mt-2 text-sm leading-relaxed text-foreground/65">
            Nenhum restaurante ativo foi encontrado para exibir a demonstração.
          </p>
          <div className="mt-6">
            <Link
              to="/"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-95"
            >
              <Home className="h-4 w-4" /> Ir para o início
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
