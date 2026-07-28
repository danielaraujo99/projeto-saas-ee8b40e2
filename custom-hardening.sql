-- =====================================================================
-- custom-hardening.sql
-- Execute UMA VEZ no projeto Supabase "custom" (cardápio, cupons, mesas,
-- garçons, estoque). Nada aqui toca o projeto oficial (orders / restaurants).
--
-- Objetivos:
--   1) Garantir restaurant_id NOT NULL em todas as tabelas de tenant.
--   2) Reforçar RLS por membro do restaurante (is_restaurant_member).
--   3) Remover políticas abertas (USING true) que vazam dados entre tenants.
--   4) Manter APENAS a exceção pública do cardápio (products/categories),
--      escopada por restaurante ativo e itens ativos.
--   5) Índices em restaurant_id para consultas rápidas.
--
-- Idempotente: pode rodar de novo com segurança.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0) Pré-requisito: função is_restaurant_member já existe neste projeto.
--    (Definida no bootstrap; apenas confirmamos que está presente.)
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_restaurant_member'
  ) THEN
    RAISE EXCEPTION 'is_restaurant_member() ausente neste projeto — recrie antes de rodar este script';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 1) NOT NULL em restaurant_id (base do isolamento)
-- ---------------------------------------------------------------------
ALTER TABLE public.categories        ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE public.products          ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE public.coupons           ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE public.waiters           ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE public.tables            ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE public.table_order_items ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE public.stock_items       ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE public.stock_movements   ALTER COLUMN restaurant_id SET NOT NULL;

-- ---------------------------------------------------------------------
-- 2) RLS ligado em todas
-- ---------------------------------------------------------------------
ALTER TABLE public.categories        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waiters           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements   ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 3) CUPONS — sem leitura pública (uso via server-side/admin apenas)
-- ---------------------------------------------------------------------
REVOKE SELECT ON public.coupons FROM anon;
DROP POLICY IF EXISTS "coup_public_read"  ON public.coupons;
DROP POLICY IF EXISTS "coup_member_read"  ON public.coupons;
DROP POLICY IF EXISTS "coup_member_write" ON public.coupons;

CREATE POLICY "coupons_member_all" ON public.coupons
  FOR ALL TO authenticated
  USING (public.is_restaurant_member(auth.uid(), restaurant_id))
  WITH CHECK (public.is_restaurant_member(auth.uid(), restaurant_id));

-- ---------------------------------------------------------------------
-- 4) GARÇONS — leitura por membro, escrita apenas admin
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "waiters_public_read"  ON public.waiters;
DROP POLICY IF EXISTS "waiters_member_read"  ON public.waiters;
DROP POLICY IF EXISTS "waiters_admin_write"  ON public.waiters;

CREATE POLICY "waiters_member_read" ON public.waiters
  FOR SELECT TO authenticated
  USING (public.is_restaurant_member(auth.uid(), restaurant_id));
CREATE POLICY "waiters_admin_write" ON public.waiters
  FOR ALL TO authenticated
  USING (public.has_restaurant_role(auth.uid(), restaurant_id, 'admin'))
  WITH CHECK (public.has_restaurant_role(auth.uid(), restaurant_id, 'admin'));

-- ---------------------------------------------------------------------
-- 5) ESTOQUE — apenas membros
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "stock_public_read"  ON public.stock_items;
DROP POLICY IF EXISTS "stock_member_all"   ON public.stock_items;
CREATE POLICY "stock_member_all" ON public.stock_items
  FOR ALL TO authenticated
  USING (public.is_restaurant_member(auth.uid(), restaurant_id))
  WITH CHECK (public.is_restaurant_member(auth.uid(), restaurant_id));

DROP POLICY IF EXISTS "stmov_public_read"  ON public.stock_movements;
DROP POLICY IF EXISTS "stmov_member_all"   ON public.stock_movements;
CREATE POLICY "stmov_member_all" ON public.stock_movements
  FOR ALL TO authenticated
  USING (public.is_restaurant_member(auth.uid(), restaurant_id))
  WITH CHECK (public.is_restaurant_member(auth.uid(), restaurant_id));

-- ---------------------------------------------------------------------
-- 6) MESAS + COMANDAS — apenas membros
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "tables_public_read"  ON public.tables;
DROP POLICY IF EXISTS "tables_member_read"  ON public.tables;
DROP POLICY IF EXISTS "tables_member_write" ON public.tables;
CREATE POLICY "tables_member_all" ON public.tables
  FOR ALL TO authenticated
  USING (public.is_restaurant_member(auth.uid(), restaurant_id))
  WITH CHECK (public.is_restaurant_member(auth.uid(), restaurant_id));

DROP POLICY IF EXISTS "toi_public_read" ON public.table_order_items;
DROP POLICY IF EXISTS "toi_member_all"  ON public.table_order_items;
CREATE POLICY "toi_member_all" ON public.table_order_items
  FOR ALL TO authenticated
  USING (public.is_restaurant_member(auth.uid(), restaurant_id))
  WITH CHECK (public.is_restaurant_member(auth.uid(), restaurant_id));

-- ---------------------------------------------------------------------
-- 7) CARDÁPIO (categorias/produtos) — única exceção pública
--    Leitura anon é permitida SOMENTE quando:
--      - o item está ativo, e
--      - pertence a um restaurante ativo.
--    Escrita continua restrita a membros do restaurante.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "cat_public_read"     ON public.categories;
DROP POLICY IF EXISTS "cat_member_write"    ON public.categories;
DROP POLICY IF EXISTS "categories_public_read" ON public.categories;
DROP POLICY IF EXISTS "categories_member_all"  ON public.categories;

CREATE POLICY "categories_public_read" ON public.categories
  FOR SELECT TO anon, authenticated
  USING (
    active = true
    AND EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = categories.restaurant_id AND r.active = true
    )
  );
CREATE POLICY "categories_member_all" ON public.categories
  FOR ALL TO authenticated
  USING (public.is_restaurant_member(auth.uid(), restaurant_id))
  WITH CHECK (public.is_restaurant_member(auth.uid(), restaurant_id));

DROP POLICY IF EXISTS "prod_public_read"     ON public.products;
DROP POLICY IF EXISTS "prod_member_write"    ON public.products;
DROP POLICY IF EXISTS "products_public_read" ON public.products;
DROP POLICY IF EXISTS "products_member_all"  ON public.products;

CREATE POLICY "products_public_read" ON public.products
  FOR SELECT TO anon, authenticated
  USING (
    active = true
    AND EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = products.restaurant_id AND r.active = true
    )
  );
CREATE POLICY "products_member_all" ON public.products
  FOR ALL TO authenticated
  USING (public.is_restaurant_member(auth.uid(), restaurant_id))
  WITH CHECK (public.is_restaurant_member(auth.uid(), restaurant_id));

-- ---------------------------------------------------------------------
-- 8) Índices em restaurant_id (desempenho)
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_categories_rid        ON public.categories        (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_products_rid          ON public.products          (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_products_rid_active   ON public.products          (restaurant_id, active);
CREATE INDEX IF NOT EXISTS idx_coupons_rid           ON public.coupons           (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_waiters_rid           ON public.waiters           (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_tables_rid            ON public.tables            (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_toi_rid               ON public.table_order_items (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_stock_items_rid       ON public.stock_items       (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_rid   ON public.stock_movements   (restaurant_id);

COMMIT;

-- =====================================================================
-- Verificação rápida (opcional, rode manualmente após o COMMIT):
--   SELECT tablename, policyname, roles, qual
--     FROM pg_policies
--    WHERE schemaname = 'public'
--      AND tablename IN ('categories','products','coupons','waiters',
--                        'tables','table_order_items','stock_items',
--                        'stock_movements')
--    ORDER BY tablename, policyname;
-- Nenhuma linha deve ter qual = 'true'.
-- =====================================================================
