UPDATE public.subscription_fees
   SET commission_percentage = 7,
       webapp_commission_percentage = 7,
       updated_at = now()
 WHERE subscription_type = 'standard';

UPDATE public.subscription_fees
   SET commission_percentage = 0,
       webapp_commission_percentage = 0,
       updated_at = now()
 WHERE subscription_type = 'boost';

UPDATE public.subscription_fees
   SET commission_percentage = 0,
       webapp_commission_percentage = 0,
       updated_at = now()
 WHERE subscription_type = 'ambassador';;
