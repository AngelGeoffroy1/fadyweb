-- Créer une fonction qui met à jour le statut du coiffeur quand les documents sont vérifiés
CREATE OR REPLACE FUNCTION update_hairdresser_status_on_verification()
RETURNS TRIGGER AS $$
BEGIN
  -- Si le statut de vérification passe à 'verified', mettre à jour le statut du coiffeur
  IF NEW.verification_status = 'verified' AND (OLD.verification_status IS NULL OR OLD.verification_status != 'verified') THEN
    UPDATE hairdressers
    SET statut = 'Diplomé'
    WHERE id = NEW.hairdresser_id AND statut = 'Amateur';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Créer le trigger sur la table hairdresser_diploma_verification
DROP TRIGGER IF EXISTS trigger_update_hairdresser_status ON hairdresser_diploma_verification;
CREATE TRIGGER trigger_update_hairdresser_status
  AFTER INSERT OR UPDATE OF verification_status
  ON hairdresser_diploma_verification
  FOR EACH ROW
  EXECUTE FUNCTION update_hairdresser_status_on_verification();

-- Commenter la fonction et le trigger
COMMENT ON FUNCTION update_hairdresser_status_on_verification() IS 'Met à jour automatiquement le statut du coiffeur à Diplomé quand ses documents sont vérifiés';
COMMENT ON TRIGGER trigger_update_hairdresser_status ON hairdresser_diploma_verification IS 'Trigger qui appelle update_hairdresser_status_on_verification() après insertion ou mise à jour du statut de vérification';;
