
-- Supprimer les anciennes policies trop permissives sur le bucket diplomas
DROP POLICY IF EXISTS "Users can view diplomas" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload diplomas" ON storage.objects;
DROP POLICY IF EXISTS "Users can update diplomas" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete diplomas" ON storage.objects;

-- SELECT : un coiffeur ne peut voir que ses propres diplômes
CREATE POLICY "Hairdressers can view own diplomas"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'diplomas'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.hairdressers WHERE user_id = auth.uid()
  )
);

-- INSERT : un coiffeur ne peut uploader que dans son propre dossier
CREATE POLICY "Hairdressers can upload own diplomas"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'diplomas'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.hairdressers WHERE user_id = auth.uid()
  )
);

-- UPDATE : un coiffeur ne peut modifier que ses propres diplômes
CREATE POLICY "Hairdressers can update own diplomas"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'diplomas'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.hairdressers WHERE user_id = auth.uid()
  )
);

-- DELETE : un coiffeur ne peut supprimer que ses propres diplômes
CREATE POLICY "Hairdressers can delete own diplomas"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'diplomas'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.hairdressers WHERE user_id = auth.uid()
  )
);
;
