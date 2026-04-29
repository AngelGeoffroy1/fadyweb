
-- Ajouter le type 'ambassador' au constraint de subscription_type
ALTER TABLE hairdresser_subscriptions 
DROP CONSTRAINT hairdresser_subscriptions_subscription_type_check;

ALTER TABLE hairdresser_subscriptions 
ADD CONSTRAINT hairdresser_subscriptions_subscription_type_check 
CHECK (subscription_type = ANY (ARRAY['standard'::text, 'rookie'::text, 'boost'::text, 'ambassador'::text]));

-- Ajouter les colonnes pour les abonnements offerts
ALTER TABLE hairdresser_subscriptions 
ADD COLUMN IF NOT EXISTS is_gifted BOOLEAN DEFAULT FALSE;

ALTER TABLE hairdresser_subscriptions 
ADD COLUMN IF NOT EXISTS gifted_by_admin_id UUID REFERENCES admins(id);

ALTER TABLE hairdresser_subscriptions 
ADD COLUMN IF NOT EXISTS gifted_reason TEXT;

COMMENT ON COLUMN hairdresser_subscriptions.is_gifted IS 'Indique si l''abonnement est offert par un admin';
COMMENT ON COLUMN hairdresser_subscriptions.gifted_by_admin_id IS 'ID de l''admin qui a offert l''abonnement';
COMMENT ON COLUMN hairdresser_subscriptions.gifted_reason IS 'Raison pour laquelle l''abonnement a été offert';
;
