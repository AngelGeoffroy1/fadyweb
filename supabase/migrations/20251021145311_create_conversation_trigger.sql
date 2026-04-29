-- Créer une fonction pour créer automatiquement une conversation lors d'une nouvelle réservation
CREATE OR REPLACE FUNCTION create_conversation_on_booking()
RETURNS TRIGGER AS $$
BEGIN
  -- Insérer une nouvelle conversation (ou ignorer si elle existe déjà grâce à UNIQUE)
  INSERT INTO conversations (user_id, hairdresser_id)
  VALUES (NEW.user_id, NEW.hairdresser_id)
  ON CONFLICT (user_id, hairdresser_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Créer le trigger sur la table bookings
DROP TRIGGER IF EXISTS trigger_create_conversation ON bookings;

CREATE TRIGGER trigger_create_conversation
AFTER INSERT ON bookings
FOR EACH ROW
EXECUTE FUNCTION create_conversation_on_booking();;
