ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payout_logs_id uuid REFERENCES public.payout_logs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fady_commission_user numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fady_commission_barber numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_fee numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_net numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS funds_available_on date,
  ADD COLUMN IF NOT EXISTS channel text,
  ADD COLUMN IF NOT EXISTS commission_percentage numeric(5,2),
  ADD COLUMN IF NOT EXISTS payout_status text DEFAULT 'pending';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bookings_channel_check'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_channel_check
      CHECK (channel IS NULL OR channel IN ('ios','webapp','admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bookings_payout_status_check'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_payout_status_check
      CHECK (payout_status IS NULL OR payout_status IN ('pending','eligible','paid','refunded','cancelled'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_bookings_payout_eligibility
  ON public.bookings(payout_status, funds_available_on)
  WHERE payout_status IN ('pending','eligible');

COMMENT ON COLUMN public.bookings.fady_commission_user IS 'Frais service client (max(0.40, 5%) facturé en plus du prix coupe)';
COMMENT ON COLUMN public.bookings.fady_commission_barber IS 'Commission FADY prélevée sur la part barber selon abonnement (Standard 7%, Pro/Ambassador 0%)';
COMMENT ON COLUMN public.bookings.stripe_fee IS 'Frais Stripe nets sur la charge (depuis balance_transaction.fee)';
COMMENT ON COLUMN public.bookings.stripe_net IS 'Montant net après frais Stripe sur le compte plateforme';
COMMENT ON COLUMN public.bookings.funds_available_on IS 'Date à laquelle les fonds Stripe deviennent disponibles pour transfer';
COMMENT ON COLUMN public.bookings.channel IS 'Canal de création : ios | webapp | admin';
COMMENT ON COLUMN public.bookings.commission_percentage IS 'Snapshot du % commission barber appliqué à la création (immuable)';
COMMENT ON COLUMN public.bookings.payout_status IS 'État du virement vers le barber : pending | eligible | paid | refunded | cancelled';;
