-- Créer une fonction pour récupérer les reviews avec les noms d'utilisateurs
CREATE OR REPLACE FUNCTION get_reviews_with_users(p_hairdresser_id UUID)
RETURNS TABLE (
    id UUID,
    booking_id UUID,
    user_id UUID,
    hairdresser_id UUID,
    rating INTEGER,
    comment TEXT,
    created_at TIMESTAMPTZ,
    user_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id,
        r.booking_id,
        r.user_id,
        r.hairdresser_id,
        r.rating,
        r.comment,
        r.created_at,
        u.full_name
    FROM reviews r
    LEFT JOIN auth.users u ON r.user_id = u.id
    WHERE r.hairdresser_id = p_hairdresser_id
    ORDER BY r.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;;
