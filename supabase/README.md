# Supabase backend FADY

Ce dossier est la source locale canonique pour le backend Supabase du projet FADY (`sfxmdvdzqasvzujwbbfg`).

## Contenu

- `migrations/` : historique SQL synchronisé depuis `supabase_migrations.schema_migrations` du projet remote.
- `functions/` : Edge Functions dont le code source est disponible localement.
- `.temp/` : métadonnées locales de la CLI Supabase. Ce dossier est ignoré par Git.

## Commandes utiles

Depuis `Fady Website/` :

```bash
supabase migration list
supabase migration fetch
supabase functions list
supabase functions deploy <function-name> --use-api --no-verify-jwt
```

## Règles de travail

- Les nouvelles migrations doivent être créées ici.
- Les modifications d'Edge Functions doivent être faites ici avant déploiement.
- Les autres dossiers `supabase/` dans les apps iOS sont conservés pour compatibilité locale, mais ne doivent plus être utilisés comme source principale du backend.
