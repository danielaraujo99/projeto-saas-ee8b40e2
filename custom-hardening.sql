-- =====================================================================
-- custom-hardening.sql  (v2)
-- Execute UMA VEZ no projeto Supabase "custom".
--
-- Correções desta versão:
--   - Não assume que public.restaurants.active existe no projeto custom.
--     Garante a coluna (default true) antes de usá-la nas policies do
--     cardápio público.
--   - Cria as tabelas que ainda faltavam: deliveries (entregas),
--     reviews (avaliações) e financial_entries (financeiro), já com
--     GRANTs, RLS, policies por membro e índices em restaurant_id.
--
-- Idempotente — pode rodar de novo com segurança.
-- =====================================================================

BEGIN;

-- 0) Pré-requisitos ----------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_restaurant_member'
  ) THEN
    RAISE EXCEPTION 'is_restaurant_member() ausente — recrie antes de rodar';
  END IF;
END $$;

-- Garante coluna active na tabela de restaurantes (default true).
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- 1) NOT NULL em restaurant_id nas tabelas existentes ------------------
ALTER TABLE public.categories        ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE public.products          ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE public.coupons           ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE public.waiters           ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE public.tables            ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE public.table_order_items ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE public.stock_items       ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE public.stock_movements   ALTER COLUMN restaurant_id SET NOT NULL;

-- 2) RLS ligado --------------------------------------------------------
ALTER TABLE public.categories        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waiters           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements   ENABLE ROW LEVEL SECURITY;

-- 3) CUPONS ------------------------------------------------------------
REVOKE SELECT ON public.coupons FROM anon;
DROP POLICY IF EXISTS "coup_public_read"  ON public.coupons;
DROP POLICY IF EXISTS "coup_member_read"  ON public.coupons;
DROP POLICY IF EXISTS "coup_member_write" ON public.coupons;
DROP POLICY IF EXISTS "coupons_member_all" ON public.coupons;
CREATE POLICY "coupons_member_all" ON public.coupons
  FOR ALL TO authenticated
  USING (public.is_restaurant_member(auth.uid(), restaurant_id))
  WITH CHECK (public.is_restaurant_member(auth.uid(), restaurant_id));

-- 4) GARÇONS -----------------------------------------------------------
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

-- 5) ESTOQUE -----------------------------------------------------------
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

-- 6) MESAS + COMANDAS --------------------------------------------------
DROP POLICY IF EXISTS "tables_public_read"  ON public.tables;
DROP POLICY IF EXISTS "tables_member_read"  ON public.tables;
DROP POLICY IF EXISTS "tables_member_write" ON public.tables;
DROP POLICY IF EXISTS "tables_member_all"   ON public.tables;
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

-- 7) CARDÁPIO (única exceção pública) ----------------------------------
DROP POLICY IF EXISTS "cat_public_read"        ON public.categories;
DROP POLICY IF EXISTS "cat_member_write"       ON public.categories;
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

-- 8) Índices em restaurant_id -----------------------------------------
CREATE INDEX IF NOT EXISTS idx_categories_rid        ON public.categories        (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_products_rid          ON public.products          (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_products_rid_active   ON public.products          (restaurant_id, active);
CREATE INDEX IF NOT EXISTS idx_coupons_rid           ON public.coupons           (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_waiters_rid           ON public.waiters           (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_tables_rid            ON public.tables            (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_toi_rid               ON public.table_order_items (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_stock_items_rid       ON public.stock_items       (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_rid   ON public.stock_movements   (restaurant_id);

-- =====================================================================
-- 9) NOVAS TABELAS — Entregas, Avaliações, Financeiro
--    Mesmo padrão: GRANT → RLS ON → policies por membro (admin p/ escrita
--    sensível). restaurant_id NOT NULL + índice.
-- =====================================================================

-- 9.1) ENTREGAS (deliveries) ------------------------------------------
CREATE TABLE IF NOT EXISTS public.deliveries (
  id             uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id  uuid        NOT NULL,
  order_id       uuid,                              -- opcional (pedido oficial)
  courier_name   text        NOT NULL,
  courier_phone  text,
  vehicle        text,                              -- moto/bike/carro/pé
  status         text        NOT NULL DEFAULT 'pending',
                                                    -- pending | assigned | picked | delivered | canceled
  fee            numeric     NOT NULL DEFAULT 0,
  distance_km    numeric,
  notes          text,
  assigned_at    timestamptz,
  delivered_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deliveries TO authenticated;
GRANT ALL ON public.deliveries TO service_role;

ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deliveries_member_all" ON public.deliveries;
CREATE POLICY "deliveries_member_all" ON public.deliveries
  FOR ALL TO authenticated
  USING (public.is_restaurant_member(auth.uid(), restaurant_id))
  WITH CHECK (public.is_restaurant_member(auth.uid(), restaurant_id));

CREATE INDEX IF NOT EXISTS idx_deliveries_rid         ON public.deliveries (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_rid_status  ON public.deliveries (restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_deliveries_rid_created ON public.deliveries (restaurant_id, created_at DESC);

-- 9.2) AVALIAÇÕES (reviews) -------------------------------------------
-- Leitura pública (só de restaurantes ativos); escrita restrita a membros.
CREATE TABLE IF NOT EXISTS public.reviews (
  id             uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id  uuid        NOT NULL,
  order_id       uuid,                              -- opcional (pedido oficial)
  customer_name  text,
  rating_food    smallint    CHECK (rating_food IS NULL OR rating_food BETWEEN 1 AND 5),
  rating_service smallint    CHECK (rating_service IS NULL OR rating_service BETWEEN 1 AND 5),
  rating_delivery smallint   CHECK (rating_delivery IS NULL OR rating_delivery BETWEEN 1 AND 5),
  comment        text,
  reply          text,                              -- resposta do restaurante
  visible        boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT SELECT ON public.reviews TO anon;
GRANT ALL ON public.reviews TO service_role;

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reviews_public_read" ON public.reviews;
CREATE POLICY "reviews_public_read" ON public.reviews
  FOR SELECT TO anon, authenticated
  USING (
    visible = true
    AND EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = reviews.restaurant_id AND r.active = true
    )
  );

DROP POLICY IF EXISTS "reviews_member_all" ON public.reviews;
CREATE POLICY "reviews_member_all" ON public.reviews
  FOR ALL TO authenticated
  USING (public.is_restaurant_member(auth.uid(), restaurant_id))
  WITH CHECK (public.is_restaurant_member(auth.uid(), restaurant_id));

CREATE INDEX IF NOT EXISTS idx_reviews_rid         ON public.reviews (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rid_created ON public.reviews (restaurant_id, created_at DESC);

-- 9.3) FINANCEIRO (financial_entries) ---------------------------------
-- Fechado: só membros leem, só admin escreve.
CREATE TABLE IF NOT EXISTS public.financial_entries (
  id             uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id  uuid        NOT NULL,
  kind           text        NOT NULL,              -- 'revenue' | 'expense' | 'adjustment'
  category       text,                              -- 'sales','delivery','supplier','payroll',...
  description    text,
  amount         numeric     NOT NULL,              -- positivo p/ revenue, negativo p/ expense
  occurred_at    timestamptz NOT NULL DEFAULT now(),
  order_id       uuid,                              -- opcional
  meta           jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_by     uuid,                              -- auth.uid() de quem lançou
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_entries TO authenticated;
GRANT ALL ON public.financial_entries TO service_role;

ALTER TABLE public.financial_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fin_member_read"  ON public.financial_entries;
CREATE POLICY "fin_member_read" ON public.financial_entries
  FOR SELECT TO authenticated
  USING (public.is_restaurant_member(auth.uid(), restaurant_id));

DROP POLICY IF EXISTS "fin_admin_write"  ON public.financial_entries;
CREATE POLICY "fin_admin_write" ON public.financial_entries
  FOR ALL TO authenticated
  USING (public.has_restaurant_role(auth.uid(), restaurant_id, 'admin'))
  WITH CHECK (public.has_restaurant_role(auth.uid(), restaurant_id, 'admin'));

CREATE INDEX IF NOT EXISTS idx_fin_rid          ON public.financial_entries (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_fin_rid_occurred ON public.financial_entries (restaurant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_fin_rid_kind     ON public.financial_entries (restaurant_id, kind);

-- 10) Trigger genérica de updated_at (idempotente) --------------------
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['deliveries','reviews','financial_entries'] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%1$s_touch ON public.%1$s;
       CREATE TRIGGER trg_%1$s_touch BEFORE UPDATE ON public.%1$s
       FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();', t);
  END LOOP;
END $$;

COMMIT;

-- =====================================================================
-- Verificação rápida (rode manualmente):
--   SELECT tablename, policyname, roles, qual
--     FROM pg_policies
--    WHERE schemaname='public'
--    ORDER BY tablename, policyname;
-- Nenhuma linha em tabelas de tenant deve ter qual='true'.
-- =====================================================================
