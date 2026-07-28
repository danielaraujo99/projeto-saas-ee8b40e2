import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { HomePage } from "./index";
import { MenuProvider } from "@/components/menu-context";
import { fetchDemoMenu } from "@/lib/storefront";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Demo — MenuAtlas" },
      {
        name: "description",
        content:
          "Experimente o cardápio digital MenuAtlas em uma demonstração interativa completa.",
      },
      { property: "og:title", content: "Demo — MenuAtlas" },
      {
        property: "og:description",
        content: "Cardápio digital de demonstração do MenuAtlas.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DemoPage,
});

function DemoPage() {
  const q = useQuery({
    queryKey: ["storefront", "demo"],
    queryFn: fetchDemoMenu,
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
      <div className="grid min-h-screen place-items-center bg-background px-6">
        <EmptyState
          title="Cardápio demo indisponível"
          description="Cadastre um restaurante no painel para vê-lo aqui."
        />
      </div>
    );
  }
  return (
    <MenuProvider categories={q.data.categories} products={q.data.products}>
      <HomePage />
    </MenuProvider>
  );
}
