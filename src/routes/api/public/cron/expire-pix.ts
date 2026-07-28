import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

/**
 * Cron público que expira Pix pendentes.
 *
 * Chamado pelo pg_cron a cada minuto via pg_net. A rota está sob
 * /api/public/* (bypass da autenticação da plataforma), então TODA
 * requisição é validada pelo header `x-cron-secret` — sem ele, 401.
 *
 * A ação em si é idempotente: só muda `pending_payment` cujo
 * pix_expires_at já passou. Rodar duas vezes não causa efeito colateral.
 */
export const Route = createFileRoute("/api/public/cron/expire-pix")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("x-cron-secret");
        const expected = process.env.CRON_SECRET;
        if (!expected || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const url = process.env.CUSTOM_SUPABASE_URL ?? process.env.SUPABASE_URL;
        const key =
          process.env.CUSTOM_SUPABASE_SERVICE_ROLE_KEY ??
          process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !key) {
          return new Response(
            JSON.stringify({ ok: false, error: "Backend não configurado." }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }

        try {
          const admin = createClient(url, key, {
            auth: { persistSession: false, autoRefreshToken: false },
            global: {
              fetch: (input, init) => {
                const headers = new Headers(init?.headers);
                if (
                  key.startsWith("sb_") &&
                  headers.get("Authorization") === `Bearer ${key}`
                ) {
                  headers.delete("Authorization");
                }
                headers.set("apikey", key);
                return fetch(input, { ...init, headers });
              },
            },
          });

          // Prefer chamar a função no banco (uma única transação).
          const { data, error } = await admin.rpc("expire_pending_pix_orders");
          if (error) throw error;

          return new Response(
            JSON.stringify({ ok: true, expired: data ?? 0, at: new Date().toISOString() }),
            { headers: { "content-type": "application/json" } },
          );
        } catch (err) {
          // Não vazar detalhes internos para o chamador.
          console.error("[cron:expire-pix]", err);
          return new Response(
            JSON.stringify({ ok: false, error: "Falha ao processar expiração." }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }
      },
    },
  },
});
