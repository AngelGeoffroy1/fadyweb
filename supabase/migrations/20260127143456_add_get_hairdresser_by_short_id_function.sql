-- Function to get a hairdresser by short ID (first 8 chars of UUID)
CREATE OR REPLACE FUNCTION get_hairdresser_by_short_id(short_id TEXT)
RETURNS SETOF hairdressers
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT * FROM hairdressers
  WHERE id::text ILIKE short_id || '%'
  LIMIT 1;
$$;;
