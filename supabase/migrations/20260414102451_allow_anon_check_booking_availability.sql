-- Accorder au rôle anon un SELECT limité aux colonnes nécessaires pour vérifier la disponibilité
-- Exclut : user_id, address, total_price, stripe_payment_intent_id, payment_method
GRANT SELECT (id, hairdresser_id, service_id, booking_date, booking_time, status) ON public.bookings TO anon;

-- Policy RLS : anon ne peut voir que les bookings actifs (pour vérifier la disponibilité)
-- Identique à la policy "Authenticated users can check booking availability"
CREATE POLICY "Anon can check booking availability"
ON public.bookings
FOR SELECT
TO anon
USING (status IN ('confirmed', 'pending', 'en_cours'));;
