-- Ajouter un champ pour stocker le type d'abonnement planifié après la fin de la période actuelle
ALTER TABLE hairdresser_subscriptions
ADD COLUMN pending_subscription_type text;

-- Ajouter un commentaire pour expliquer le champ
COMMENT ON COLUMN hairdresser_subscriptions.pending_subscription_type IS 'Type d''abonnement qui sera activé à la fin de la période actuelle (utilisé pour les downgrades vers standard)';

-- Ajouter une contrainte pour valider les valeurs
ALTER TABLE hairdresser_subscriptions
ADD CONSTRAINT pending_subscription_type_check 
CHECK (pending_subscription_type IS NULL OR pending_subscription_type IN ('standard', 'rookie', 'boost'));;
