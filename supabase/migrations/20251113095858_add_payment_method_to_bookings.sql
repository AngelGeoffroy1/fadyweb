ALTER TABLE bookings ADD COLUMN payment_method TEXT DEFAULT 'card' CHECK (payment_method IN ('card', 'cash'));;
