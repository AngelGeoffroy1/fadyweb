-- Allow null user_id in bookings for webapp (guest) bookings
ALTER TABLE bookings ALTER COLUMN user_id DROP NOT NULL;;
