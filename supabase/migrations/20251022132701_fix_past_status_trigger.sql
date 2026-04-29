-- Supprimer le trigger problématique
DROP TRIGGER IF EXISTS update_past_bookings_trigger ON bookings;
DROP FUNCTION IF EXISTS trigger_update_past_bookings();

-- Créer une fonction plus simple pour mettre à jour manuellement
CREATE OR REPLACE FUNCTION update_past_bookings_manual()
RETURNS void AS $$
BEGIN
    -- Mettre à jour les réservations dont la date est passée et qui ne sont pas déjà terminées/annulées
    UPDATE bookings 
    SET status = 'past'
    WHERE booking_date < CURRENT_DATE 
    AND status IN ('pending', 'confirmed')
    AND status != 'past';
END;
$$ LANGUAGE plpgsql;;
