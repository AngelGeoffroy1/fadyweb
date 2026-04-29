ALTER TABLE public.hairdressers
  ALTER COLUMN available_now_end_at TYPE time USING (available_now_end_at::time);
;
