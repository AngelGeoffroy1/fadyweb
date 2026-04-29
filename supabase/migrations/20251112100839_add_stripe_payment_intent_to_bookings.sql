-- Add stripe_payment_intent_id column to bookings table
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT UNIQUE;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_bookings_stripe_payment_intent 
ON bookings(stripe_payment_intent_id);

-- Add comment
COMMENT ON COLUMN bookings.stripe_payment_intent_id IS 'Stripe PaymentIntent ID for paid bookings';;
