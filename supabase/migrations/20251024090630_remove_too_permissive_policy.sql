-- Supprimer la politique trop permissive
DROP POLICY IF EXISTS "Authenticated users can update hairdresser stats" ON hairdressers;;
