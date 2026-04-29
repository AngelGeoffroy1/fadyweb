
CREATE OR REPLACE FUNCTION get_visible_barbers_stats()
RETURNS TABLE(total bigint, diplo_pro bigint, amateur bigint)
LANGUAGE sql
STABLE
AS $$
  SELECT
    COUNT(*)                                                        AS total,
    COUNT(*) FILTER (WHERE h.statut IN ('Diplomé','Pro'))           AS diplo_pro,
    COUNT(*) FILTER (WHERE h.statut = 'Amateur')                    AS amateur
  FROM hairdressers h
  WHERE h.avatar_url IS NOT NULL
    AND EXISTS (SELECT 1 FROM hairdresser_services  s WHERE s.hairdresser_id = h.id)
    AND EXISTS (SELECT 1 FROM hairdresser_gallery   g WHERE g.hairdresser_id = h.id)
    AND EXISTS (SELECT 1 FROM hairdresser_subscriptions hs WHERE hs.hairdresser_id = h.id AND hs.status = 'active')
    AND NOT EXISTS (SELECT 1 FROM invisible_hairdressers ih WHERE ih.hairdresser_id = h.id AND ih.is_invisible = true);
$$;
;
