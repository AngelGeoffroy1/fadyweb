-- Recréer la fonction avec search_path sécurisé
CREATE OR REPLACE FUNCTION create_conversation_on_booking()
RETURNS TRIGGER 
SET search_path = public
AS $$
BEGIN
  -- Insérer une nouvelle conversation (ou ignorer si elle existe déjà grâce à UNIQUE)
  INSERT INTO conversations (user_id, hairdresser_id)
  VALUES (NEW.user_id, NEW.hairdresser_id)
  ON CONFLICT (user_id, hairdresser_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;;
