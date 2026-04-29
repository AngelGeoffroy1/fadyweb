-- Activer RLS sur la table hairdresser_gallery
ALTER TABLE hairdresser_gallery ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre aux utilisateurs authentifiés de voir toutes les images de galerie
CREATE POLICY "Anyone can view gallery images" ON hairdresser_gallery
    FOR SELECT USING (true);

-- Politique pour permettre aux coiffeurs d'insérer leurs propres images de galerie
CREATE POLICY "Hairdressers can insert their own gallery images" ON hairdresser_gallery
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM hairdressers 
            WHERE hairdressers.id = hairdresser_gallery.hairdresser_id 
            AND hairdressers.user_id = auth.uid()
        )
    );

-- Politique pour permettre aux coiffeurs de mettre à jour leurs propres images de galerie
CREATE POLICY "Hairdressers can update their own gallery images" ON hairdresser_gallery
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM hairdressers 
            WHERE hairdressers.id = hairdresser_gallery.hairdresser_id 
            AND hairdressers.user_id = auth.uid()
        )
    );

-- Politique pour permettre aux coiffeurs de supprimer leurs propres images de galerie
CREATE POLICY "Hairdressers can delete their own gallery images" ON hairdresser_gallery
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM hairdressers 
            WHERE hairdressers.id = hairdresser_gallery.hairdresser_id 
            AND hairdressers.user_id = auth.uid()
        )
    );;
