-- Trancar projeto oficial: derrubar policies anon abertas de orders + revogar
-- grants residuais de anon em todas as tabelas de negócio.
BEGIN;

DROP POLICY IF EXISTS "orders_anon_read"   ON public.orders;
DROP POLICY IF EXISTS "orders_anon_insert" ON public.orders;
DROP POLICY IF EXISTS "orders_anon_update" ON public.orders;

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.orders             FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.profiles           FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.restaurant_members FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.restaurants        FROM anon;

COMMIT;