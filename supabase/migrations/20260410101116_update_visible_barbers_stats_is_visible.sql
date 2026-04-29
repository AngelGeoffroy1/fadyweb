
CREATE OR REPLACE FUNCTION get_visible_barbers_stats()
RETURNS TABLE(total bigint, diplo_pro bigint, amateur bigint)
LANGUAGE sql
STABLE
AS $$
  SELECT
    COUNT(*)                                                   AS total,
    COUNT(*) FILTER (WHERE statut IN ('Diplomé','Pro'))        AS diplo_pro,
    COUNT(*) FILTER (WHERE statut = 'Amateur')                 AS amateur
  FROM hairdressers
  WHERE is_visible = true;
$$;
;
