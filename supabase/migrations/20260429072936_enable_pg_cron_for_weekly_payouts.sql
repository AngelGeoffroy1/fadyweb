CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Crée une table pour stocker la config du cron (le secret du run-weekly-payouts).
-- L'admin doit y insérer le secret CRON_SECRET (même valeur que l'env var de l'edge function).
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only on app_settings"
  ON public.app_settings FOR ALL TO service_role
  USING (true) WITH CHECK (true);;
