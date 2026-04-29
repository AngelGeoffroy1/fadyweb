-- Fonction pour calculer la note moyenne et le nombre total de reviews
CREATE OR REPLACE FUNCTION calculate_hairdresser_rating(p_hairdresser_id UUID)
RETURNS TABLE(average_rating NUMERIC, total_reviews INTEGER) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(AVG(r.rating), 0)::NUMERIC(3,2) as average_rating,
        COUNT(r.id)::INTEGER as total_reviews
    FROM reviews r
    WHERE r.hairdresser_id = p_hairdresser_id;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour mettre à jour les statistiques d'un coiffeur
CREATE OR REPLACE FUNCTION update_hairdresser_stats(p_hairdresser_id UUID)
RETURNS VOID AS $$
DECLARE
    stats RECORD;
BEGIN
    -- Calculer les statistiques
    SELECT * INTO stats FROM calculate_hairdresser_rating(p_hairdresser_id);
    
    -- Mettre à jour la table hairdressers
    UPDATE hairdressers 
    SET 
        rating = stats.average_rating,
        total_reviews = stats.total_reviews
    WHERE id = p_hairdresser_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour les stats après INSERT dans reviews
CREATE OR REPLACE FUNCTION trigger_update_hairdresser_rating_insert()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM update_hairdresser_stats(NEW.hairdresser_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour les stats après UPDATE dans reviews
CREATE OR REPLACE FUNCTION trigger_update_hairdresser_rating_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Mettre à jour les stats pour l'ancien et le nouveau coiffeur (au cas où le coiffeur change)
    IF OLD.hairdresser_id != NEW.hairdresser_id THEN
        PERFORM update_hairdresser_stats(OLD.hairdresser_id);
    END IF;
    PERFORM update_hairdresser_stats(NEW.hairdresser_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour les stats après DELETE dans reviews
CREATE OR REPLACE FUNCTION trigger_update_hairdresser_rating_delete()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM update_hairdresser_stats(OLD.hairdresser_id);
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Créer les triggers
DROP TRIGGER IF EXISTS trg_reviews_insert ON reviews;
CREATE TRIGGER trg_reviews_insert
    AFTER INSERT ON reviews
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_hairdresser_rating_insert();

DROP TRIGGER IF EXISTS trg_reviews_update ON reviews;
CREATE TRIGGER trg_reviews_update
    AFTER UPDATE ON reviews
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_hairdresser_rating_update();

DROP TRIGGER IF EXISTS trg_reviews_delete ON reviews;
CREATE TRIGGER trg_reviews_delete
    AFTER DELETE ON reviews
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_hairdresser_rating_delete();;
