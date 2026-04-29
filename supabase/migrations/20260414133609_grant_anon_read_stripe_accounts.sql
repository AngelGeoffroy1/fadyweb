-- Column-level SELECT grant on hairdresser_stripe_accounts for anon.
-- Public profile page needs these to decide if online booking is available.
GRANT SELECT (
  hairdresser_id,
  charges_enabled,
  onboarding_status
) ON public.hairdresser_stripe_accounts TO anon;

-- Matching RLS policy for anon
-- (existing policies only cover authenticated and owner).
CREATE POLICY "Anon can view payment capabilities"
  ON public.hairdresser_stripe_accounts
  FOR SELECT
  TO anon
  USING (true);;
