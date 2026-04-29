-- Table pour gérer les clients bloqués par les coiffeurs
CREATE TABLE IF NOT EXISTS blocked_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hairdresser_id UUID NOT NULL REFERENCES hairdressers(id) ON DELETE CASCADE,
    blocked_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    
    -- Contrainte d'unicité : un coiffeur ne peut bloquer qu'une fois un client
    UNIQUE(hairdresser_id, blocked_user_id)
);

-- Index pour améliorer les performances des requêtes
CREATE INDEX idx_blocked_clients_hairdresser_id ON blocked_clients(hairdresser_id);
CREATE INDEX idx_blocked_clients_blocked_user_id ON blocked_clients(blocked_user_id);

-- Activer RLS (Row Level Security)
ALTER TABLE blocked_clients ENABLE ROW LEVEL SECURITY;

-- Policy pour permettre aux coiffeurs de voir leurs clients bloqués
CREATE POLICY "Hairdressers can view their blocked clients"
ON blocked_clients
FOR SELECT
USING (
    blocked_by_user_id = auth.uid()
);

-- Policy pour permettre aux coiffeurs de bloquer des clients
CREATE POLICY "Hairdressers can block clients"
ON blocked_clients
FOR INSERT
WITH CHECK (
    blocked_by_user_id = auth.uid()
);

-- Policy pour permettre aux coiffeurs de débloquer des clients
CREATE POLICY "Hairdressers can unblock clients"
ON blocked_clients
FOR DELETE
USING (
    blocked_by_user_id = auth.uid()
);

-- Commentaire sur la table
COMMENT ON TABLE blocked_clients IS 'Table pour gérer les clients bloqués par les coiffeurs. Un client bloqué ne peut plus envoyer de messages au coiffeur.';;
