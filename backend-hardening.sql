-- =====================================================================
-- backend-hardening.sql
-- Aplica no projeto Supabase custom (tckhsajvekpnfqtsstlx).
--
-- 1) Colunas para persistir a cobrança Pix e a chave de idempotência.
-- 2) Índice único (device_id, idempotency_key) para eliminar duplicatas.
-- 3) Função `expire_pending_pix_orders` que marca como cancelado
--    todo pedido pending_payment cujo pix_expires_at já passou.
-- 4) Agendador pg_cron: chama a rota /api/public/cron/expire-pix a cada
--    minuto usando pg_net. Substitua {PROJECT_URL} e {CRON_SECRET}.
--
-- Observação: orders(short_id) já possui UNIQUE (orders_short_id_key).
-- =====================================================================

-- 1) Colunas Pix + idempotência
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pix_payment_id bigint,
  ADD COLUMN IF NOT EXISTS pix_code text,
  ADD COLUMN IF NOT EXISTS pix_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS idempotency_key text;

-- 2) Idempotência por dispositivo (não bloqueia legado NULL)
CREATE UNIQUE INDEX IF NOT EXISTS orders_device_idem_key
  ON public.orders (device_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS orders_pix_expires_idx
  ON public.orders (pix_expires_at)
  WHERE status = 'pending_payment';

-- 3) Função de expiração automática
CREATE OR REPLACE FUNCTION public.expire_pending_pix_orders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE public.orders
     SET status = 'canceled',
         status_updated_at = now()
   WHERE status = 'pending_payment'
     AND pix_expires_at IS NOT NULL
     AND pix_expires_at < now();
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- 4) Agendador pg_cron (executar apenas se pg_cron/pg_net estiverem habilitados)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- CREATE EXTENSION IF NOT EXISTS pg_net;
--
-- SELECT cron.schedule(
--   'expire-pending-pix',
--   '* * * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://{PROJECT_URL}/api/public/cron/expire-pix',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'x-cron-secret', '{CRON_SECRET}'
--     ),
--     body := '{}'::jsonb
--   );
--   $$
-- );
--
-- Alternativa 100% SQL (sem endpoint HTTP), se preferir:
-- SELECT cron.schedule(
--   'expire-pending-pix-sql',
--   '* * * * *',
--   $$ SELECT public.expire_pending_pix_orders(); $$
-- );
