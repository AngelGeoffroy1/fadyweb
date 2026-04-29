
CREATE OR REPLACE FUNCTION public.get_bookings_cuts_stats()
RETURNS TABLE(total_coupes bigint, coupes_completed bigint, coupes_cancelled bigint, coupes_pending bigint)
LANGUAGE sql
STABLE
AS $$
  SELECT
    SUM(number_of_cuts)                                                               AS total_coupes,
    SUM(number_of_cuts) FILTER (WHERE status = 'completed')                           AS coupes_completed,
    SUM(number_of_cuts) FILTER (WHERE status IN ('cancelled','refund'))               AS coupes_cancelled,
    SUM(number_of_cuts) FILTER (WHERE status NOT IN ('completed','cancelled','refund')) AS coupes_pending
  FROM bookings;
$$;
;
