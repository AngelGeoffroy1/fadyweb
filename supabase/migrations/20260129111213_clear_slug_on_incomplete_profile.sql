
-- Fonction principale : vérifie si le profil est complet, sinon efface le slug
CREATE OR REPLACE FUNCTION check_and_clear_slug(p_hairdresser_id UUID)
RETURNS VOID AS $$
DECLARE
    v_statut TEXT;
    v_avatar_url TEXT;
    v_slug TEXT;
    v_gallery_count INT;
    v_services_count INT;
    v_amateur_priced_count INT;
    v_diploma_status TEXT;
    v_has_active_sub BOOLEAN;
    v_is_complete BOOLEAN := TRUE;
BEGIN
    -- Récupérer les infos du coiffeur
    SELECT statut, avatar_url, slug
    INTO v_statut, v_avatar_url, v_slug
    FROM hairdressers
    WHERE id = p_hairdresser_id;

    -- Si pas de slug, rien à faire
    IF v_slug IS NULL OR v_slug = '' THEN
        RETURN;
    END IF;

    -- Vérifier photo de profil
    IF v_avatar_url IS NULL OR v_avatar_url = '' THEN
        v_is_complete := FALSE;
    END IF;

    -- Vérifier galerie (au moins 1 photo ou vidéo)
    IF v_is_complete THEN
        SELECT COUNT(*) INTO v_gallery_count
        FROM hairdresser_gallery
        WHERE hairdresser_id = p_hairdresser_id;

        IF v_gallery_count = 0 THEN
            v_is_complete := FALSE;
        END IF;
    END IF;

    -- Vérifier prestations (au moins 1)
    IF v_is_complete THEN
        SELECT COUNT(*) INTO v_services_count
        FROM hairdresser_services
        WHERE hairdresser_id = p_hairdresser_id;

        IF v_services_count = 0 THEN
            v_is_complete := FALSE;
        END IF;
    END IF;

    -- Vérifications spécifiques au statut
    IF v_is_complete AND COALESCE(v_statut, 'Amateur') = 'Amateur' THEN
        -- Amateur : vérifier abonnement actif
        SELECT EXISTS(
            SELECT 1 FROM hairdresser_subscriptions
            WHERE hairdresser_id = p_hairdresser_id
              AND status = 'active'
        ) INTO v_has_active_sub;

        IF NOT v_has_active_sub THEN
            v_is_complete := FALSE;
        END IF;
    ELSIF v_is_complete AND v_statut = 'Diplomé' THEN
        -- Diplomé : vérifier diplôme vérifié
        SELECT verification_status INTO v_diploma_status
        FROM hairdresser_diploma_verification
        WHERE hairdresser_id = p_hairdresser_id
        ORDER BY created_at DESC
        LIMIT 1;

        IF v_diploma_status IS NULL OR v_diploma_status != 'verified' THEN
            v_is_complete := FALSE;
        END IF;

        -- Diplomé : vérifier que tous les services ont un prix
        IF v_is_complete THEN
            SELECT COUNT(*) INTO v_amateur_priced_count
            FROM hairdresser_services
            WHERE hairdresser_id = p_hairdresser_id
              AND price IS NULL;

            IF v_amateur_priced_count > 0 THEN
                v_is_complete := FALSE;
            END IF;
        END IF;
    END IF;

    -- Si profil incomplet, effacer le slug
    IF NOT v_is_complete THEN
        UPDATE hairdressers SET slug = NULL WHERE id = p_hairdresser_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function pour hairdresser_services (DELETE ou UPDATE prix)
CREATE OR REPLACE FUNCTION trg_check_slug_on_service_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM check_and_clear_slug(OLD.hairdresser_id);
        RETURN OLD;
    ELSE
        PERFORM check_and_clear_slug(NEW.hairdresser_id);
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function pour hairdresser_gallery (DELETE)
CREATE OR REPLACE FUNCTION trg_check_slug_on_gallery_change()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM check_and_clear_slug(OLD.hairdresser_id);
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function pour hairdresser_subscriptions (UPDATE status)
CREATE OR REPLACE FUNCTION trg_check_slug_on_subscription_change()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM check_and_clear_slug(NEW.hairdresser_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function pour hairdresser_diploma_verification (UPDATE status)
CREATE OR REPLACE FUNCTION trg_check_slug_on_diploma_change()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM check_and_clear_slug(NEW.hairdresser_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function pour hairdressers (UPDATE avatar_url ou statut)
CREATE OR REPLACE FUNCTION trg_check_slug_on_hairdresser_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.avatar_url IS DISTINCT FROM NEW.avatar_url
       OR OLD.statut IS DISTINCT FROM NEW.statut THEN
        PERFORM check_and_clear_slug(NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Créer les triggers

-- Services : suppression ou mise à jour du prix
CREATE TRIGGER trg_slug_service_delete
    AFTER DELETE ON hairdresser_services
    FOR EACH ROW
    EXECUTE FUNCTION trg_check_slug_on_service_change();

CREATE TRIGGER trg_slug_service_update
    AFTER UPDATE OF price ON hairdresser_services
    FOR EACH ROW
    EXECUTE FUNCTION trg_check_slug_on_service_change();

-- Galerie : suppression
CREATE TRIGGER trg_slug_gallery_delete
    AFTER DELETE ON hairdresser_gallery
    FOR EACH ROW
    EXECUTE FUNCTION trg_check_slug_on_gallery_change();

-- Abonnements : changement de statut
CREATE TRIGGER trg_slug_subscription_update
    AFTER UPDATE OF status ON hairdresser_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION trg_check_slug_on_subscription_change();

-- Diplôme : changement de statut de vérification
CREATE TRIGGER trg_slug_diploma_update
    AFTER UPDATE OF verification_status ON hairdresser_diploma_verification
    FOR EACH ROW
    EXECUTE FUNCTION trg_check_slug_on_diploma_change();

-- Hairdresser : changement d'avatar ou statut
CREATE TRIGGER trg_slug_hairdresser_update
    AFTER UPDATE OF avatar_url, statut ON hairdressers
    FOR EACH ROW
    EXECUTE FUNCTION trg_check_slug_on_hairdresser_change();
;
