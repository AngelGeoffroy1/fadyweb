
-- 1. Convertir les chaînes vides en NULL automatiquement
CREATE OR REPLACE FUNCTION trg_normalize_slug()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.slug IS NOT NULL AND TRIM(NEW.slug) = '' THEN
        NEW.slug := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_slug_normalize
    BEFORE INSERT OR UPDATE OF slug ON hairdressers
    FOR EACH ROW
    EXECUTE FUNCTION trg_normalize_slug();

-- 2. CHECK constraint : format regex (minuscules, chiffres, tirets, 3-50 chars, pas de tiret en début/fin)
ALTER TABLE hairdressers
    ADD CONSTRAINT chk_slug_format
    CHECK (
        slug IS NULL
        OR (
            slug ~ '^[a-z0-9][a-z0-9\-]{1,48}[a-z0-9]$'
            AND slug NOT LIKE '%---%'
        )
    );

-- 3. Liste de slugs réservés
CREATE OR REPLACE FUNCTION trg_check_reserved_slugs()
RETURNS TRIGGER AS $$
DECLARE
    reserved_slugs TEXT[] := ARRAY[
        'admin', 'api', 'app', 'auth', 'login', 'logout', 'signup', 'register',
        'support', 'help', 'contact', 'about', 'terms', 'privacy', 'legal',
        'settings', 'profile', 'account', 'dashboard', 'search', 'explore',
        'home', 'index', 'fady', 'fady-app', 'fady-pro', 'fadypro', 'fadyapp',
        'booking', 'bookings', 'reservation', 'reservations',
        'coiffeur', 'coiffeurs', 'coiffeuse', 'coiffeuses',
        'hairdresser', 'hairdressers',
        'blog', 'news', 'pricing', 'tarifs', 'cgu', 'cgv', 'mentions-legales',
        'webhook', 'webhooks', 'callback', 'redirect', 'oauth',
        'stripe', 'payment', 'payments', 'paiement', 'paiements',
        'static', 'assets', 'images', 'css', 'js', 'fonts',
        'sitemap', 'robots', 'favicon', 'manifest',
        'www', 'mail', 'email', 'test', 'dev', 'staging', 'prod',
        'null', 'undefined', 'true', 'false'
    ];
BEGIN
    IF NEW.slug IS NOT NULL AND NEW.slug = ANY(reserved_slugs) THEN
        RAISE EXCEPTION 'Le slug "%" est réservé et ne peut pas être utilisé', NEW.slug
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_slug_reserved_check
    BEFORE INSERT OR UPDATE OF slug ON hairdressers
    FOR EACH ROW
    EXECUTE FUNCTION trg_check_reserved_slugs();
;
