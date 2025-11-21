# Configuration des polices Uber Move

## Instructions pour ajouter les vraies polices

1. **Téléchargez les polices Uber Move** depuis votre source officielle
2. **Remplacez les fichiers placeholder** dans `src/app/fonts/` :
   - `UberMoveMedium.otf` → Remplacez par le vrai fichier
   - `UberMoveBold.otf` → Remplacez par le vrai fichier

## Fichiers actuels (placeholders)

Les fichiers actuels sont des placeholders qui permettent au projet de compiler.
Pour utiliser les vraies polices Uber Move :

1. Supprimez les fichiers placeholder
2. Ajoutez les vrais fichiers `.otf`
3. Le projet utilisera automatiquement les nouvelles polices

## Fallback

En attendant les vraies polices, le projet utilise `system-ui` et `sans-serif` comme fallback,
ce qui garantit une bonne lisibilité sur tous les systèmes.