-- ============================================================
-- MenuAtlas — Opções e Adicionais (product_option_groups / product_options)
-- Rodar no SQL Editor do backend custom.
-- Colunas batem exatamente com o que a interface já existente usa.
-- ============================================================

-- ---------- 1) GRUPOS ----------
CREATE TABLE IF NOT EXISTS public.product_option_groups (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  product_id    uuid NOT NULL REFERENCES public.products(id)    ON DELETE CASCADE,
  name          text NOT NULL,
  selection     text NOT NULL DEFAULT 'single' CHECK (selection IN ('single','multiple')),
  required      boolean NOT NULL DEFAULT false,
  min_select    integer NOT NULL DEFAULT 0 CHECK (min_select >= 0),
  max_select    integer NOT NULL DEFAULT 1 CHECK (max_select >= 1),
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pog_product    ON public.product_option_groups(product_id);
CREATE INDEX IF NOT EXISTS idx_pog_restaurant ON public.product_option_groups(restaurant_id);

GRANT SELECT ON public.product_option_groups TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_option_groups TO authenticated;
GRANT ALL ON public.product_option_groups TO service_role;

ALTER TABLE public.product_option_groups ENABLE ROW LEVEL SECURITY;

-- ---------- 2) OPÇÕES ----------
CREATE TABLE IF NOT EXISTS public.product_options (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  group_id      uuid NOT NULL REFERENCES public.product_option_groups(id) ON DELETE CASCADE,
  name          text NOT NULL,
  price_delta   numeric(10,2) NOT NULL DEFAULT 0,
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_po_group      ON public.product_options(group_id);
CREATE INDEX IF NOT EXISTS idx_po_restaurant ON public.product_options(restaurant_id);

GRANT SELECT ON public.product_options TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_options TO authenticated;
GRANT ALL ON public.product_options TO service_role;

ALTER TABLE public.product_options ENABLE ROW LEVEL SECURITY;

-- ---------- 3) updated_at ----------
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_pog_touch ON public.product_option_groups;
CREATE TRIGGER trg_pog_touch BEFORE UPDATE ON public.product_option_groups
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_po_touch ON public.product_options;
CREATE TRIGGER trg_po_touch BEFORE UPDATE ON public.product_options
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------- 4) RLS: GRUPOS ----------
-- Limpa qualquer política antiga (inclusive a leitura aberta USING (true)).
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname='public' AND tablename='product_option_groups'
  LOOP EXECUTE format('DROP POLICY %I ON public.product_option_groups', p.policyname); END LOOP;
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname='public' AND tablename='product_options'
  LOOP EXECUTE format('DROP POLICY %I ON public.product_options', p.policyname); END LOOP;
END $$;

-- Leitura pública: SOMENTE se produto ativo E restaurante ativo.
CREATE POLICY "pog_public_read_active"
ON public.product_option_groups FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1
    FROM public.products pr
    JOIN public.restaurants r ON r.id = pr.restaurant_id
    WHERE pr.id = product_option_groups.product_id
      AND pr.restaurant_id = product_option_groups.restaurant_id
      AND pr.active = true
      AND r.active = true
  )
);

-- Membro do restaurante: leitura total do próprio tenant.
CREATE POLICY "pog_member_read"
ON public.product_option_groups FOR SELECT TO authenticated
USING (public.is_restaurant_member(auth.uid(), restaurant_id));

CREATE POLICY "pog_member_insert"
ON public.product_option_groups FOR INSERT TO authenticated
WITH CHECK (
  public.is_restaurant_member(auth.uid(), restaurant_id)
  AND EXISTS (SELECT 1 FROM public.products pr
              WHERE pr.id = product_id AND pr.restaurant_id = product_option_groups.restaurant_id)
);

CREATE POLICY "pog_member_update"
ON public.product_option_groups FOR UPDATE TO authenticated
USING (public.is_restaurant_member(auth.uid(), restaurant_id))
WITH CHECK (
  public.is_restaurant_member(auth.uid(), restaurant_id)
  AND EXISTS (SELECT 1 FROM public.products pr
              WHERE pr.id = product_id AND pr.restaurant_id = product_option_groups.restaurant_id)
);

CREATE POLICY "pog_member_delete"
ON public.product_option_groups FOR DELETE TO authenticated
USING (public.is_restaurant_member(auth.uid(), restaurant_id));

-- ---------- 5) RLS: OPÇÕES ----------
CREATE POLICY "po_public_read_active"
ON public.product_options FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1
    FROM public.product_option_groups g
    JOIN public.products pr    ON pr.id = g.product_id
    JOIN public.restaurants r  ON r.id  = pr.restaurant_id
    WHERE g.id = product_options.group_id
      AND g.restaurant_id = product_options.restaurant_id
      AND pr.active = true
      AND r.active  = true
  )
);

CREATE POLICY "po_member_read"
ON public.product_options FOR SELECT TO authenticated
USING (public.is_restaurant_member(auth.uid(), restaurant_id));

CREATE POLICY "po_member_insert"
ON public.product_options FOR INSERT TO authenticated
WITH CHECK (
  public.is_restaurant_member(auth.uid(), restaurant_id)
  AND EXISTS (SELECT 1 FROM public.product_option_groups g
              WHERE g.id = group_id AND g.restaurant_id = product_options.restaurant_id)
);

CREATE POLICY "po_member_update"
ON public.product_options FOR UPDATE TO authenticated
USING (public.is_restaurant_member(auth.uid(), restaurant_id))
WITH CHECK (
  public.is_restaurant_member(auth.uid(), restaurant_id)
  AND EXISTS (SELECT 1 FROM public.product_option_groups g
              WHERE g.id = group_id AND g.restaurant_id = product_options.restaurant_id)
);

CREATE POLICY "po_member_delete"
ON public.product_options FOR DELETE TO authenticated
USING (public.is_restaurant_member(auth.uid(), restaurant_id));
