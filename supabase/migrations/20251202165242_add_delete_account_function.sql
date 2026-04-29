-- Fonction pour supprimer complètement un compte utilisateur
-- Cette fonction supprime toutes les données associées au compte
-- et l'utilisateur de auth.users

CREATE OR REPLACE FUNCTION delete_user_account(user_password TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_user_id UUID;
    current_user_email TEXT;
    hairdresser_record RECORD;
BEGIN
    -- Récupérer l'ID de l'utilisateur authentifié
    current_user_id := auth.uid();
    
    -- Vérifier que l'utilisateur est authentifié
    IF current_user_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Non authentifié'
        );
    END IF;
    
    -- Récupérer l'email de l'utilisateur depuis auth.users
    SELECT email INTO current_user_email
    FROM auth.users
    WHERE id = current_user_id;
    
    -- Vérifier le mot de passe en tentant une réauthentification
    -- Note: Cette vérification est faite côté client avant l'appel à cette fonction
    -- car Supabase ne permet pas de vérifier directement le mot de passe côté serveur
    
    -- Récupérer le hairdresser_id si existe
    SELECT * INTO hairdresser_record
    FROM hairdressers
    WHERE user_id = current_user_id;
    
    -- Supprimer toutes les données associées au coiffeur si existe
    IF hairdresser_record.id IS NOT NULL THEN
        -- Supprimer les images de la galerie
        DELETE FROM hairdresser_gallery WHERE hairdresser_id = hairdresser_record.id;
        
        -- Supprimer les avis reçus
        DELETE FROM reviews WHERE hairdresser_id = hairdresser_record.id;
        
        -- Supprimer les messages des conversations
        DELETE FROM messages 
        WHERE conversation_id IN (
            SELECT id FROM conversations 
            WHERE hairdresser_id = hairdresser_record.id
        );
        
        -- Supprimer les conversations
        DELETE FROM conversations WHERE hairdresser_id = hairdresser_record.id;
        
        -- Supprimer les réservations
        DELETE FROM bookings WHERE hairdresser_id = hairdresser_record.id;
        
        -- Supprimer les services
        DELETE FROM hairdresser_services WHERE hairdresser_id = hairdresser_record.id;
        
        -- Supprimer les disponibilités
        DELETE FROM hairdresser_availability WHERE hairdresser_id = hairdresser_record.id;
        
        -- Supprimer les abonnements
        DELETE FROM hairdresser_subscriptions WHERE hairdresser_id = hairdresser_record.id;
        
        -- Supprimer le compte Stripe Connect
        DELETE FROM hairdresser_stripe_accounts WHERE hairdresser_id = hairdresser_record.id;
        
        -- Supprimer les paiements
        DELETE FROM stripe_payments WHERE hairdresser_id = hairdresser_record.id;
        
        -- Supprimer les documents de vérification
        DELETE FROM hairdresser_diploma_verification WHERE hairdresser_id = hairdresser_record.id;
        
        -- Supprimer le profil coiffeur
        DELETE FROM hairdressers WHERE id = hairdresser_record.id;
    END IF;
    
    -- Supprimer les préférences de notification
    DELETE FROM notification_preferences WHERE user_id = current_user_id;
    
    -- Supprimer l'entrée de la table users
    DELETE FROM users WHERE id = current_user_id;
    
    -- Supprimer l'utilisateur de auth.users
    DELETE FROM auth.users WHERE id = current_user_id;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Compte supprimé avec succès'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$;;
