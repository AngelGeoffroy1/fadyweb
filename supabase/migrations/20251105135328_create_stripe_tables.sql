-- Table pour les comptes Stripe Connect
CREATE TABLE IF NOT EXISTS hairdresser_stripe_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hairdresser_id UUID NOT NULL UNIQUE REFERENCES hairdressers(id) ON DELETE CASCADE,
    stripe_account_id TEXT NOT NULL UNIQUE,
    onboarding_status TEXT NOT NULL DEFAULT 'pending' CHECK (onboarding_status IN ('pending', 'completed', 'rejected')),
    onboarding_link TEXT,
    charges_enabled BOOLEAN DEFAULT false,
    payouts_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table pour les abonnements
CREATE TABLE IF NOT EXISTS hairdresser_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hairdresser_id UUID NOT NULL REFERENCES hairdressers(id) ON DELETE CASCADE,
    subscription_type TEXT NOT NULL CHECK (subscription_type IN ('standard', 'rookie', 'boost')),
    stripe_subscription_id TEXT UNIQUE,
    stripe_price_id TEXT,
    stripe_customer_id TEXT,
    status TEXT NOT NULL DEFAULT 'incomplete' CHECK (status IN ('active', 'canceled', 'past_due', 'incomplete', 'trialing')),
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table pour l'historique des paiements
CREATE TABLE IF NOT EXISTS stripe_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    hairdresser_id UUID NOT NULL REFERENCES hairdressers(id) ON DELETE CASCADE,
    stripe_payment_intent_id TEXT UNIQUE,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
    currency TEXT DEFAULT 'eur',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'canceled')),
    payment_type TEXT NOT NULL CHECK (payment_type IN ('subscription', 'booking')),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_hairdresser_stripe_accounts_hairdresser_id ON hairdresser_stripe_accounts(hairdresser_id);
CREATE INDEX IF NOT EXISTS idx_hairdresser_stripe_accounts_stripe_account_id ON hairdresser_stripe_accounts(stripe_account_id);
CREATE INDEX IF NOT EXISTS idx_hairdresser_subscriptions_hairdresser_id ON hairdresser_subscriptions(hairdresser_id);
CREATE INDEX IF NOT EXISTS idx_hairdresser_subscriptions_stripe_subscription_id ON hairdresser_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payments_hairdresser_id ON stripe_payments(hairdresser_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payments_booking_id ON stripe_payments(booking_id);

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers pour mettre à jour updated_at
CREATE TRIGGER update_hairdresser_stripe_accounts_updated_at
    BEFORE UPDATE ON hairdresser_stripe_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hairdresser_subscriptions_updated_at
    BEFORE UPDATE ON hairdresser_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies pour hairdresser_stripe_accounts
ALTER TABLE hairdresser_stripe_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Les coiffeurs peuvent voir leur propre compte Stripe"
    ON hairdresser_stripe_accounts FOR SELECT
    USING (
        hairdresser_id IN (
            SELECT id FROM hairdressers WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Les coiffeurs peuvent insérer leur propre compte Stripe"
    ON hairdresser_stripe_accounts FOR INSERT
    WITH CHECK (
        hairdresser_id IN (
            SELECT id FROM hairdressers WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Les coiffeurs peuvent mettre à jour leur propre compte Stripe"
    ON hairdresser_stripe_accounts FOR UPDATE
    USING (
        hairdresser_id IN (
            SELECT id FROM hairdressers WHERE user_id = auth.uid()
        )
    );

-- RLS Policies pour hairdresser_subscriptions
ALTER TABLE hairdresser_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Les coiffeurs peuvent voir leurs propres abonnements"
    ON hairdresser_subscriptions FOR SELECT
    USING (
        hairdresser_id IN (
            SELECT id FROM hairdressers WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Les coiffeurs peuvent insérer leurs propres abonnements"
    ON hairdresser_subscriptions FOR INSERT
    WITH CHECK (
        hairdresser_id IN (
            SELECT id FROM hairdressers WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Les coiffeurs peuvent mettre à jour leurs propres abonnements"
    ON hairdresser_subscriptions FOR UPDATE
    USING (
        hairdresser_id IN (
            SELECT id FROM hairdressers WHERE user_id = auth.uid()
        )
    );

-- RLS Policies pour stripe_payments
ALTER TABLE stripe_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Les coiffeurs peuvent voir leurs propres paiements"
    ON stripe_payments FOR SELECT
    USING (
        hairdresser_id IN (
            SELECT id FROM hairdressers WHERE user_id = auth.uid()
        )
    );;
