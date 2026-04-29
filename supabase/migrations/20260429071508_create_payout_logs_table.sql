CREATE TABLE IF NOT EXISTS public.payout_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hairdresser_id uuid NOT NULL REFERENCES public.hairdressers(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL CHECK (amount >= 0),
  date_virement timestamptz NOT NULL DEFAULT now(),
  stripe_transfer_id text UNIQUE,
  payout_status text NOT NULL DEFAULT 'pending'
    CHECK (payout_status IN ('pending','paid','refunded','failed')),
  bookings_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payout_logs_hairdresser
  ON public.payout_logs(hairdresser_id, payout_status);

ALTER TABLE public.payout_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on payout_logs"
  ON public.payout_logs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Hairdressers can read their own payout_logs"
  ON public.payout_logs FOR SELECT TO authenticated
  USING (
    hairdresser_id IN (
      SELECT id FROM public.hairdressers WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can read all payout_logs"
  ON public.payout_logs FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
  );;
