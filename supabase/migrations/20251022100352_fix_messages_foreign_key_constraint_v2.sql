-- Supprimer l'ancienne contrainte de clé étrangère
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_receiver_id_fkey;

-- Permettre NULL pour receiver_id
ALTER TABLE messages ALTER COLUMN receiver_id DROP NOT NULL;

-- Créer une fonction pour vérifier que receiver_id existe dans users ou hairdressers
CREATE OR REPLACE FUNCTION check_receiver_id_exists()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.receiver_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.receiver_id) AND 
       NOT EXISTS (SELECT 1 FROM hairdressers WHERE id = NEW.receiver_id) THEN
      RAISE EXCEPTION 'receiver_id must exist in users or hairdressers table';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer un trigger pour vérifier la contrainte
DROP TRIGGER IF EXISTS check_receiver_id_trigger ON messages;
CREATE TRIGGER check_receiver_id_trigger
  BEFORE INSERT OR UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION check_receiver_id_exists();;
