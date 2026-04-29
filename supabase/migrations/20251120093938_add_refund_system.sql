-- Add 'refund' status to bookings
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check 
  CHECK (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'completed'::text, 'cancelled'::text, 'past'::text, 'en_cours'::text, 'refund'::text]));

-- Create refunds table
CREATE TABLE IF NOT EXISTS refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  stripe_refund_id text UNIQUE,
  payment_intent_id text NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  refund_type text NOT NULL CHECK (refund_type = ANY (ARRAY['full'::text, 'partial'::text])),
  commission_handling text NOT NULL CHECK (commission_handling = ANY (ARRAY['keep_platform_commission'::text, 'refund_all'::text])),
  platform_amount_kept numeric NOT NULL DEFAULT 0 CHECK (platform_amount_kept >= 0),
  hairdresser_amount_reversed numeric NOT NULL DEFAULT 0 CHECK (hairdresser_amount_reversed >= 0),
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending'::text, 'succeeded'::text, 'failed'::text])),
  admin_id uuid REFERENCES admins(id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enable RLS on refunds table
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

-- Create policy for admins to read all refunds
CREATE POLICY "Admins can view all refunds"
  ON refunds FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid()
    )
  );

-- Create policy for admins to insert refunds
CREATE POLICY "Admins can create refunds"
  ON refunds FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid()
    )
  );

-- Create policy for admins to update refunds
CREATE POLICY "Admins can update refunds"
  ON refunds FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS refunds_booking_id_idx ON refunds(booking_id);
CREATE INDEX IF NOT EXISTS refunds_stripe_refund_id_idx ON refunds(stripe_refund_id);
CREATE INDEX IF NOT EXISTS refunds_status_idx ON refunds(status);
CREATE INDEX IF NOT EXISTS refunds_created_at_idx ON refunds(created_at DESC);

COMMENT ON TABLE refunds IS 'Table pour tracer tous les remboursements effectués via Stripe';
COMMENT ON COLUMN refunds.commission_handling IS 'Comment gérer la commission lors du remboursement: keep_platform_commission ou refund_all';
COMMENT ON COLUMN refunds.platform_amount_kept IS 'Montant gardé par la plateforme Fady (commission non remboursée)';
COMMENT ON COLUMN refunds.hairdresser_amount_reversed IS 'Montant récupéré du compte Connect du coiffeur';;
