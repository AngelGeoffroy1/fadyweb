-- Supprimer le trigger de notification qui ne peut pas envoyer de push notifications
-- Les notifications push doivent être envoyées depuis l'app Fady Pro

-- Supprimer le trigger
DROP TRIGGER IF EXISTS notify_new_message_trigger ON messages;

-- Supprimer la fonction (optionnel, on peut la garder pour d'autres usages)
-- DROP FUNCTION IF EXISTS notify_new_message();;
