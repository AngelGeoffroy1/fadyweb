-- Créer les indexes pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_unread ON messages(receiver_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_conversations_hairdresser ON conversations(hairdresser_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);;
