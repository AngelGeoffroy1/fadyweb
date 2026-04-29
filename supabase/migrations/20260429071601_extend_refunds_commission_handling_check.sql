ALTER TABLE public.refunds DROP CONSTRAINT IF EXISTS refunds_commission_handling_check;

ALTER TABLE public.refunds
  ADD CONSTRAINT refunds_commission_handling_check
  CHECK (commission_handling IN (
    'barber_pays',
    'client_pays',
    'fady_covers',
    'keep_platform_commission',
    'refund_all'
  ));;
