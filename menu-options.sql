-- =====================================================================
-- menu-options.sql — grupos de personalização + storage de imagens
-- Rode UMA VEZ no projeto Supabase "custom". Idempotente.
-- =====================================================================
BEGIN;

-- 1) product_option_groups ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_option_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  min_select int NOT NULL DEFAULT 0,
  max_select int NOT NULL DEFAULT 1,
  required boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pog_product ON public.product_option_groups(product_id);
CREATE INDEX IF NOT EXISTS idx_pog_restaurant ON public.product_option_groups(restaurant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_option_groups TO authenticated;
GRANT ALL ON public.product_option_groups TO service_role;
GRANT SELECT ON public.product_option_groups TO anon;

ALTER TABLE public.product_option_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pog_public_read" ON public.product_option_groups;
DROP POLICY IF EXISTS "pog_member_write" ON public.product_option_groups;
CREATE POLICY "pog_public_read" ON public.product_option_groups
  FOR SELECT USING (true);
CREATE POLICY "pog_member_write" ON public.product_option_groups
  FOR ALL TO authenticated
  USING (public.is_restaurant_member(auth.uid(), restaurant_id))
  WITH CHECK (public.is_restaurant_member(auth.uid(), restaurant_id));

-- 2) product_options ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.product_option_groups(id) ON DELETE CASCADE,
  name text NOT NULL,
  price_delta numeric(10,2) NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_po_group ON public.product_options(group_id);
CREATE INDEX IF NOT EXISTS idx_po_restaurant ON public.product_options(restaurant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_options TO authenticated;
GRANT ALL ON public.product_options TO service_role;
GRANT SELECT ON public.product_options TO anon;

ALTER TABLE public.product_options ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "po_public_read" ON public.product_options;
DROP POLICY IF EXISTS "po_member_write" ON public.product_options;
CREATE POLICY "po_public_read" ON public.product_options
  FOR SELECT USING (true);
CREATE POLICY "po_member_write" ON public.product_options
  FOR ALL TO authenticated
  USING (public.is_restaurant_member(auth.uid(), restaurant_id))
  WITH CHECK (public.is_restaurant_member(auth.uid(), restaurant_id));

-- Trigger updated_at (reaproveita função pública se existir; senão cria)
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_pog_touch ON public.product_option_groups;
CREATE TRIGGER trg_pog_touch BEFORE UPDATE ON public.product_option_groups
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_po_touch ON public.product_options;
CREATE TRIGGER trg_po_touch BEFORE UPDATE ON public.product_options
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) Bucket de imagens de produto (público para leitura) ---------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Policies no storage.objects
DROP POLICY IF EXISTS "product_images_public_read"  ON storage.objects;
DROP POLICY IF EXISTS "product_images_member_write" ON storage.objects;
DROP POLICY IF EXISTS "product_images_member_update" ON storage.objects;
DROP POLICY IF EXISTS "product_images_member_delete" ON storage.objects;

CREATE POLICY "product_images_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-images');

-- O primeiro segmento do path é o restaurant_id (uuid). Só membros do
-- restaurante podem escrever/atualizar/apagar arquivos daquele prefixo.
CREATE POLICY "product_images_member_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND public.is_restaurant_member(auth.uid(), (split_part(name, '/', 1))::uuid)
  );

CREATE POLICY "product_images_member_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND public.is_restaurant_member(auth.uid(), (split_part(name, '/', 1))::uuid)
  );

CREATE POLICY "product_images_member_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND public.is_restaurant_member(auth.uid(), (split_part(name, '/', 1))::uuid)
  );

COMMIT;
