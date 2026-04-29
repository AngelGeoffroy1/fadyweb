-- Supprimer l'ancienne contrainte
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;

-- Créer une nouvelle contrainte qui inclut 'past'
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check 
CHECK (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'completed'::text, 'cancelled'::text, 'past'::text]));;
