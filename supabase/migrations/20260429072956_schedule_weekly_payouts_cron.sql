-- Wrapper function qui lit le secret depuis app_settings et appelle l'edge function
CREATE OR REPLACE FUNCTION public.trigger_weekly_payouts()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret text;
  v_request_id bigint;
BEGIN
  SELECT value INTO v_secret FROM public.app_settings WHERE key = 'cron_secret';
  IF v_secret IS NULL THEN
    RAISE NOTICE 'cron_secret not configured in app_settings, skipping payouts run';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url := 'https://sfxmdvdzqasvzujwbbfg.supabase.co/functions/v1/run-weekly-payouts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := '{}'::jsonb
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.trigger_weekly_payouts FROM PUBLIC;

-- Schedule lundi 8h UTC (= 9h Paris en hiver, 10h en été)
SELECT cron.schedule(
  'fady-weekly-payouts',
  '0 8 * * 1',
  $cron$ SELECT public.trigger_weekly_payouts(); $cron$
);;
