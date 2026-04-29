-- Créer une table spécifique pour les device tokens de Fady Pro
CREATE TABLE IF NOT EXISTS fady_pro_device_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_token TEXT NOT NULL,
    platform TEXT NOT NULL DEFAULT 'ios',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, device_token)
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_fady_pro_device_tokens_user_id ON fady_pro_device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_fady_pro_device_tokens_device_token ON fady_pro_device_tokens(device_token);

-- RLS (Row Level Security)
ALTER TABLE fady_pro_device_tokens ENABLE ROW LEVEL SECURITY;

-- Policy pour que les utilisateurs ne voient que leurs tokens
CREATE POLICY "Users can manage their own Fady Pro device tokens" ON fady_pro_device_tokens
    FOR ALL USING (auth.uid() = user_id);

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_fady_pro_device_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_fady_pro_device_tokens_updated_at
    BEFORE UPDATE ON fady_pro_device_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_fady_pro_device_tokens_updated_at();;
