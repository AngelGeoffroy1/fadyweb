BEGIN;

ALTER TABLE public.app_version
  ADD COLUMN IF NOT EXISTS app_identifier text;

UPDATE public.app_version
SET app_identifier = 'fady'
WHERE app_identifier IS NULL;

INSERT INTO public.app_version (
  app_identifier,
  minimum_version,
  latest_version,
  force_update,
  update_message,
  app_store_url
)
SELECT
  'fady',
  '1.0.0',
  '1.0.0',
  false,
  'Une nouvelle version de Fady est disponible. Veuillez mettre à jour pour profiter des dernières fonctionnalités.',
  'https://apps.apple.com/fr/app/fady-coiffure/id6754072839'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.app_version
  WHERE app_identifier = 'fady'
);

INSERT INTO public.app_version (
  app_identifier,
  minimum_version,
  latest_version,
  force_update,
  update_message,
  app_store_url
)
SELECT
  'fady_pro',
  '1.0.0',
  '1.0.0',
  false,
  'Une nouvelle version de Fady Pro est disponible. Veuillez mettre à jour pour profiter des dernières fonctionnalités.',
  'https://apps.apple.com/fr/app/fady-pro-g%C3%A9rez-vos-clients/id6754292964'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.app_version
  WHERE app_identifier = 'fady_pro'
);

ALTER TABLE public.app_version
  ALTER COLUMN app_identifier SET NOT NULL;

DO $$
BEGIN
  ALTER TABLE public.app_version
    ADD CONSTRAINT app_version_app_identifier_check
    CHECK (app_identifier IN ('fady', 'fady_pro'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS app_version_app_identifier_unique
  ON public.app_version (app_identifier);

COMMIT;
