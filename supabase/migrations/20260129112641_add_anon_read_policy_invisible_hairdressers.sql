-- Ajouter une policy pour permettre aux utilisateurs anonymes de lire invisible_hairdressers
-- Ceci est nécessaire pour que la vérification d'invisibilité fonctionne pour tous les visiteurs

CREATE POLICY "Allow anon users to read invisible_hairdressers"
ON public.invisible_hairdressers
FOR SELECT
TO anon
USING (true);;
