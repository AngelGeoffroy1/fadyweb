-- Fix CRITIQUE #3 : get_hairdresser_by_short_id acceptait un pattern LIKE vide ou trop court
-- qui retournait un coiffeur arbitraire. On exige un préfixe >= 8 caractères hex et on fixe search_path.
CREATE OR REPLACE FUNCTION public.get_hairdresser_by_short_id(short_id text)
RETURNS SETOF public.hairdressers
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT *
  FROM public.hairdressers
  WHERE length(short_id) >= 8
    AND short_id ~ '^[0-9a-fA-F-]+$'
    AND id::text ILIKE short_id || '%'
  LIMIT 1;
$$;;
