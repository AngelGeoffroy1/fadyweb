-- Ajouter la colonne user_id à la table hairdressers pour lier un compte utilisateur à un profil coiffeur
ALTER TABLE hairdressers 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Créer un index pour améliorer les performances de recherche
CREATE INDEX idx_hairdressers_user_id ON hairdressers(user_id);

-- Ajouter un commentaire pour documenter la colonne
COMMENT ON COLUMN hairdressers.user_id IS 'ID de l''utilisateur Auth Supabase associé à ce profil de coiffeur';;
