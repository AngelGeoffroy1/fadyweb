ALTER TABLE public.stripe_payments
  DROP CONSTRAINT IF EXISTS stripe_payments_status_check;

ALTER TABLE public.stripe_payments
  ADD CONSTRAINT stripe_payments_status_check
  CHECK (status IN ('pending', 'succeeded', 'failed', 'canceled', 'refunded'));
