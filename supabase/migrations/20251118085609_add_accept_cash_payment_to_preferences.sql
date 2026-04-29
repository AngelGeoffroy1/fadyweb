-- Add accept_cash_payment column to preferences table
ALTER TABLE public.preferences
ADD COLUMN accept_cash_payment boolean NOT NULL DEFAULT false;

-- Add comment to column
COMMENT ON COLUMN public.preferences.accept_cash_payment IS 'Indique si le coiffeur accepte les paiements en liquide';;
