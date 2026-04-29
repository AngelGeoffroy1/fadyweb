
-- Step 1: Add slug column (nullable initially)
ALTER TABLE public.hairdressers
ADD COLUMN slug text;

-- Step 2: Create a function to slugify a name (reusable)
CREATE OR REPLACE FUNCTION public.slugify(input_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  result text;
BEGIN
  result := lower(input_text);
  -- Remove accents by transliterating
  result := translate(result,
    'àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ',
    'aaaaaaeceeeeiiiidnoooooouuuuyty'
  );
  -- Replace non-alphanumeric characters with hyphens
  result := regexp_replace(result, '[^a-z0-9]+', '-', 'g');
  -- Remove leading/trailing hyphens
  result := trim(both '-' from result);
  RETURN result;
END;
$$;

-- Step 3: Populate slugs for existing hairdressers with collision handling
DO $$
DECLARE
  rec RECORD;
  base_slug text;
  final_slug text;
  counter integer;
BEGIN
  FOR rec IN SELECT id, name FROM public.hairdressers ORDER BY created_at ASC
  LOOP
    base_slug := public.slugify(rec.name);
    
    -- If empty slug, use the first 8 chars of the UUID
    IF base_slug = '' OR base_slug IS NULL THEN
      base_slug := left(rec.id::text, 8);
    END IF;
    
    final_slug := base_slug;
    counter := 2;
    
    -- Handle duplicates by appending a number
    WHILE EXISTS (SELECT 1 FROM public.hairdressers WHERE slug = final_slug AND id != rec.id) LOOP
      final_slug := base_slug || '-' || counter;
      counter := counter + 1;
    END LOOP;
    
    UPDATE public.hairdressers SET slug = final_slug WHERE id = rec.id;
  END LOOP;
END;
$$;

-- Step 4: Make slug NOT NULL and add unique constraint
ALTER TABLE public.hairdressers
ALTER COLUMN slug SET NOT NULL;

ALTER TABLE public.hairdressers
ADD CONSTRAINT hairdressers_slug_unique UNIQUE (slug);

-- Step 5: Create an index for fast slug lookups
CREATE INDEX idx_hairdressers_slug ON public.hairdressers (slug);

-- Step 6: Add a comment
COMMENT ON COLUMN public.hairdressers.slug IS 'URL-friendly slug for the hairdresser profile page. Can be customized by the hairdresser via the iOS app.';
;
