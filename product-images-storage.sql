-- ============================================================
-- MenuAtlas — Políticas de Storage do bucket "product-images"
-- Rodar no SQL Editor do projeto Supabase custom (tckhsajvekpnfqtsstlx)
-- O bucket já foi criado (público, 5 MB, apenas imagens).
-- Convenção de caminho: <restaurant_id>/<uuid>.<ext>
-- ============================================================

-- Leitura pública (cardápio do cliente)
DROP POLICY IF EXISTS "product_images_public_read" ON storage.objects;
CREATE POLICY "product_images_public_read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'product-images');

-- Upload: apenas membro do restaurante, e só dentro da pasta do próprio restaurante
DROP POLICY IF EXISTS "product_images_member_insert" ON storage.objects;
CREATE POLICY "product_images_member_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND public.is_restaurant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

-- Atualização (upsert / troca de imagem)
DROP POLICY IF EXISTS "product_images_member_update" ON storage.objects;
CREATE POLICY "product_images_member_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND public.is_restaurant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
)
WITH CHECK (
  bucket_id = 'product-images'
  AND public.is_restaurant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

-- Exclusão
DROP POLICY IF EXISTS "product_images_member_delete" ON storage.objects;
CREATE POLICY "product_images_member_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND public.is_restaurant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

-- ============================================================
-- Higiene: produtos órfãos (sem categoria) ficam invisíveis no cardápio.
-- Move cada produto sem categoria para a 1ª categoria do próprio restaurante.
-- ============================================================
UPDATE public.products p
SET category_id = (
  SELECT c.id
  FROM public.categories c
  WHERE c.restaurant_id = p.restaurant_id
  ORDER BY c.sort_order NULLS LAST, c.created_at
  LIMIT 1
)
WHERE p.category_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.restaurant_id = p.restaurant_id
  );
