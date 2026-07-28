-- =====================================================================
-- custom-hardening-v3.sql
-- Execute UMA VEZ no projeto Supabase "custom" (SQL Editor).
-- Idempotente.
--
-- Faz:
--   1) Revoga SELECT de anon nas 10 tabelas que não precisam de leitura
--      pública (defense-in-depth). RLS já filtrava — este passo elimina
--      o grant residual para que uma futura mudança em RLS não vaze
--      dados cross-tenant.
--   2) Restringe a leitura pública de product_option_groups e
--      product_options: só devolve opções de produtos ativos cujo
--      restaurante também está ativo (mesmo padrão de categories/products).
--
-- NÃO mexe em orders nem coupons — já estão corretas.
-- =====================================================================

BEGIN;

-- 1) Revogar SELECT de anon em tabelas internas ------------------------
REVOKE SELECT ON public.waiters            FROM anon;
REVOKE SELECT ON public.tables             FROM anon;
REVOKE SELECT ON public.table_order_items  FROM anon;
REVOKE SELECT ON public.stock_items        FROM anon;
REVOKE SELECT ON public.stock_movements    FROM anon;
REVOKE SELECT ON public.deliveries         FROM anon;
REVOKE SELECT ON public.reviews            FROM anon;
REVOKE SELECT ON public.financial_entries  FROM anon;
REVOKE SELECT ON public.profiles           FROM anon;
REVOKE SELECT ON public.restaurant_members FROM anon;

-- 2) Restringir leitura pública das opções de produto ------------------
--    Só executa se as tabelas existirem (menu-options.sql já aplicado).
DO $$
BEGIN
  IF to_regclass('public.product_option_groups') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "pog_public_read" ON public.product_option_groups';
    EXECUTE $p$
      CREATE POLICY "pog_public_read" ON public.product_option_groups
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1
              FROM public.products p
              JOIN public.restaurants r ON r.id = p.restaurant_id
             WHERE p.id = product_option_groups.product_id
               AND p.active = true
               AND r.active = true
          )
        )
    $p$;
  END IF;

  IF to_regclass('public.product_options') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "po_public_read" ON public.product_options';
    EXECUTE $p$
      CREATE POLICY "po_public_read" ON public.product_options
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1
              FROM public.product_option_groups g
              JOIN public.products p    ON p.id = g.product_id
              JOIN public.restaurants r ON r.id = p.restaurant_id
             WHERE g.id = product_options.group_id
               AND p.active = true
               AND r.active = true
          )
        )
    $p$;
  END IF;
END$$;

COMMIT;
