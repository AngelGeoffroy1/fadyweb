-- Column-level SELECT grant on bookings for anon (slot-generator needs these)
-- Row filtering stays enforced by existing RLS policy
-- "Anon can check booking availability" (status IN pending/confirmed/en_cours).
GRANT SELECT (
  id,
  hairdresser_id,
  service_id,
  booking_date,
  booking_time,
  number_of_cuts,
  status
) ON public.bookings TO anon;

-- Column-level SELECT grant on hairdresser_subscriptions for anon
-- Only the fields the public profile page needs.
GRANT SELECT (
  hairdresser_id,
  subscription_type,
  status
) ON public.hairdresser_subscriptions TO anon;

-- Matching RLS policy for anon on hairdresser_subscriptions
-- (existing policies only cover authenticated and owner).
CREATE POLICY "Anon can view subscription status"
  ON public.hairdresser_subscriptions
  FOR SELECT
  TO anon
  USING (true);;
