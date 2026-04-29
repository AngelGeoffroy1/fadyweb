update public.bookings
set payout_status = null
where payout_status = 'pending'
  and (
    payment_method is distinct from 'card'
    or stripe_payment_intent_id is null
  );;
