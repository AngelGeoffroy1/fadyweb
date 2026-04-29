
-- Drop the existing restrictive policy
DROP POLICY "Users can view booking time slots for availability checking" ON bookings;

-- Recreate it for ALL roles (public = anon + authenticated) and include 'en_cours' status
CREATE POLICY "Users can view booking time slots for availability checking"
ON bookings FOR SELECT
TO public
USING (status = ANY (ARRAY['confirmed'::text, 'pending'::text, 'en_cours'::text]));
;
