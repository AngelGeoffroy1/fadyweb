-- RPC SECURITY DEFINER to expose ONLY minimal fields needed for slot
-- computation (no PII leak). Replaces the broad SELECT policy that let anon
-- read every confirmed/pending/in-progress booking.
CREATE OR REPLACE FUNCTION public.get_hairdresser_busy_slots(
  p_hairdresser_id uuid,
  p_date date
)
RETURNS TABLE (
  booking_time time,
  duration_minutes integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT
    b.booking_time,
    (COALESCE(hs.duration_minutes, 30) * COALESCE(b.number_of_cuts, 1))::integer
  FROM public.bookings b
  LEFT JOIN public.hairdresser_services hs ON hs.id = b.service_id
  WHERE b.hairdresser_id = p_hairdresser_id
    AND b.booking_date = p_date
    AND b.status IN ('pending', 'confirmed', 'en_cours')
  ORDER BY b.booking_time;
$$;

REVOKE ALL ON FUNCTION public.get_hairdresser_busy_slots(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_hairdresser_busy_slots(uuid, date) TO anon, authenticated;

-- Drop the over-permissive SELECT policies. User-owned and hairdresser-owned
-- SELECT policies on bookings remain untouched (authenticated scope).
DROP POLICY IF EXISTS "Anon can check booking availability" ON public.bookings;
DROP POLICY IF EXISTS "Authenticated users can check booking availability" ON public.bookings;;
