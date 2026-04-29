-- Correction du trigger de notification pour éviter les notifications auto-envoyées
-- À exécuter dans le SQL Editor de Supabase

-- Supprimer l'ancien trigger
DROP TRIGGER IF EXISTS notify_new_message_trigger ON messages;

-- Créer une nouvelle fonction de notification améliorée
CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER AS $$
DECLARE
    user_prefs RECORD;
    receiver_user_id UUID;
    sender_user_id UUID;
    is_sender_current_user BOOLEAN := false;
BEGIN
    -- Déterminer qui est le destinataire et l'expéditeur
    receiver_user_id := NEW.receiver_id;
    sender_user_id := NEW.sender_id;
    
    -- Vérifier si l'expéditeur est l'utilisateur actuellement connecté
    -- On utilise auth.uid() pour obtenir l'ID de l'utilisateur actuellement connecté
    -- Si auth.uid() est égal au sender_id, alors c'est l'utilisateur qui envoie son propre message
    IF auth.uid() = sender_user_id THEN
        is_sender_current_user := true;
    END IF;
    
    -- Ne pas envoyer de notification si c'est l'utilisateur actuel qui envoie le message
    IF is_sender_current_user THEN
        RETURN NEW;
    END IF;
    
    -- Récupérer les préférences du destinataire
    SELECT * INTO user_prefs
    FROM notification_preferences
    WHERE user_id = receiver_user_id;
    
    -- Si les notifications de messages sont activées, envoyer la notification
    IF user_prefs.new_messages THEN
        PERFORM send_push_notification(
            receiver_user_id,
            'Nouveau message',
            NEW.content,
            jsonb_build_object(
                'type', 'new_message',
                'hairdresser_id', NEW.sender_id,
                'message_id', NEW.id,
                'action', 'open_chat'
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recréer le trigger avec la nouvelle logique
CREATE TRIGGER notify_new_message_trigger
    AFTER INSERT ON messages
    FOR EACH ROW EXECUTE FUNCTION notify_new_message();;
