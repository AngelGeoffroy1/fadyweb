-- Ajouter colonne webapp_commission_percentage pour les commissions spécifiques à la webapp
ALTER TABLE subscription_fees
ADD COLUMN IF NOT EXISTS webapp_commission_percentage NUMERIC
CHECK (webapp_commission_percentage >= 0 AND webapp_commission_percentage <= 100);

-- Mettre à jour les valeurs des commissions webapp
UPDATE subscription_fees SET webapp_commission_percentage = 6.00 WHERE subscription_type = 'standard';
UPDATE subscription_fees SET webapp_commission_percentage = 4.00 WHERE subscription_type = 'boost';
UPDATE subscription_fees SET webapp_commission_percentage = 3.00 WHERE subscription_type = 'ambassador';

-- Ajouter un commentaire sur la colonne
COMMENT ON COLUMN subscription_fees.webapp_commission_percentage IS 'Pourcentage de commission pour les réservations via la webapp (différent de la commission iOS)';;
