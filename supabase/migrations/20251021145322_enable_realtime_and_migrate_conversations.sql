-- Activer Realtime pour les messages et conversations
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;

-- Créer des conversations pour les réservations existantes (migration)
INSERT INTO conversations (user_id, hairdresser_id)
SELECT DISTINCT user_id, hairdresser_id
FROM bookings
ON CONFLICT (user_id, hairdresser_id) DO NOTHING;;
