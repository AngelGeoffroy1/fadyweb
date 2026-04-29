-- Ajouter la colonne cover_image_url à la table hairdressers
ALTER TABLE public.hairdressers 
ADD COLUMN cover_image_url TEXT;

-- Ajouter un commentaire pour documenter la colonne
COMMENT ON COLUMN public.hairdressers.cover_image_url IS 'URL de l''image de couverture du coiffeur';;
