-- Migration: Ajout des colonnes Apple IAP
-- Ajouter colonnes pour gérer les abonnements via Apple In-App Purchase

ALTER TABLE hairdresser_subscriptions
ADD COLUMN IF NOT EXISTS apple_transaction_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS apple_original_transaction_id TEXT,
ADD COLUMN IF NOT EXISTS expires_date TIMESTAMPTZ;

-- Index pour améliorer les performances des requêtes
CREATE INDEX IF NOT EXISTS idx_hairdresser_subscriptions_apple_transaction_id
ON hairdresser_subscriptions(apple_transaction_id);

CREATE INDEX IF NOT EXISTS idx_hairdresser_subscriptions_apple_original_transaction_id
ON hairdresser_subscriptions(apple_original_transaction_id);

-- Commentaire pour documentation
COMMENT ON COLUMN hairdresser_subscriptions.apple_transaction_id IS 'ID unique de la transaction Apple pour cet abonnement';
COMMENT ON COLUMN hairdresser_subscriptions.apple_original_transaction_id IS 'ID de la transaction originale Apple (pour les renouvellements)';
COMMENT ON COLUMN hairdresser_subscriptions.expires_date IS 'Date d''expiration de l''abonnement Apple';;
