-- Fonction pour mettre à jour les statuts "passé"
CREATE OR REPLACE FUNCTION update_past_bookings()
RETURNS void AS $$
BEGIN
    -- Mettre à jour les réservations dont la date est passée et qui ne sont pas déjà terminées/annulées
    UPDATE bookings 
    SET status = 'past'
    WHERE booking_date < CURRENT_DATE 
    AND status IN ('pending', 'confirmed')
    AND status != 'past';
END;
$$ LANGUAGE plpgsql;

-- Créer un trigger qui s'exécute automatiquement
CREATE OR REPLACE FUNCTION trigger_update_past_bookings()
RETURNS trigger AS $$
BEGIN
    -- Exécuter la fonction de mise à jour
    PERFORM update_past_bookings();
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger qui s'exécute à chaque insertion/mise à jour
DROP TRIGGER IF EXISTS update_past_bookings_trigger ON bookings;
CREATE TRIGGER update_past_bookings_trigger
    AFTER INSERT OR UPDATE ON bookings
    FOR EACH STATEMENT
    EXECUTE FUNCTION trigger_update_past_bookings();;
