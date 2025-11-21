# Fady Admin Dashboard

Interface d'administration pour la plateforme Fady, permettant de gérer les utilisateurs, coiffeurs, vérifications de diplômes et administrateurs.

## 🚀 Fonctionnalités

- **Dashboard avec KPI** : Statistiques en temps réel avec graphiques interactifs
- **Gestion des diplômes** : Vérification et validation des diplômes des coiffeurs
- **Gestion des administrateurs** : Ajout/suppression d'administrateurs
- **Liste des utilisateurs** : Vue d'ensemble des clients
- **Liste des coiffeurs** : Gestion des coiffeurs avec statistiques
- **Authentification sécurisée** : Accès restreint aux administrateurs uniquement
- **Design moderne** : Interface utilisant Shadcn UI avec animations Framer Motion

## 🛠️ Technologies utilisées

- **Next.js 14** avec App Router
- **TypeScript** pour la sécurité des types
- **Tailwind CSS** pour le styling
- **Shadcn UI** pour les composants
- **Framer Motion** pour les animations
- **Supabase** pour la base de données et l'authentification
- **Recharts** pour les graphiques

## 📋 Prérequis

- Node.js 18+ 
- npm ou yarn
- Compte Supabase avec projet configuré

## ⚙️ Installation

1. **Cloner le projet**
   ```bash
   cd fady-admin
   ```

2. **Installer les dépendances**
   ```bash
   npm install
   ```

3. **Configuration des variables d'environnement**
   
   Créez un fichier `.env.local` à la racine du projet :
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Configuration des polices**
   
   Ajoutez les fichiers de police dans `src/app/fonts/` :
   - `UberMoveMedium.otf`
   - `UberMoveBold.otf`

5. **Configuration de la base de données**
   
   La table `admins` et les fonctions SQL ont été créées automatiquement via les migrations Supabase.

6. **Créer le premier administrateur**
   
   Connectez-vous à votre base de données Supabase et insérez manuellement le premier admin :
   ```sql
   INSERT INTO public.admins (user_id, role, created_at)
   VALUES ('your_user_id_from_auth_users', 'admin', NOW());
   ```

## 🚀 Démarrage

```bash
npm run dev
```

L'application sera accessible sur [http://localhost:3000](http://localhost:3000)

## 🔐 Authentification

- Seuls les utilisateurs présents dans la table `admins` peuvent accéder au dashboard
- L'authentification utilise Supabase Auth
- Le middleware vérifie automatiquement les droits d'administrateur

## 📊 Fonctionnalités détaillées

### Dashboard
- **KPI en temps réel** : Nombre d'utilisateurs, coiffeurs, réservations, revenus
- **Graphiques interactifs** : Évolution mensuelle, répartition des réservations
- **Statut des diplômes** : Nombre de demandes en attente/vérifiées

### Gestion des diplômes
- **Liste des demandes** : Toutes les soumissions de diplômes
- **Filtres** : Par statut (en attente, vérifié, rejeté)
- **Actions** : Approuver ou rejeter avec raison
- **Visualisation** : Ouverture des PDFs de diplômes

### Gestion des administrateurs
- **Ajout d'admins** : Par email d'utilisateur existant
- **Suppression** : Retrait des droits d'administrateur
- **Historique** : Qui a ajouté quel admin

### Listes
- **Utilisateurs** : Clients avec informations complètes
- **Coiffeurs** : Avec statistiques de réservations et revenus

## 🎨 Design

- **Couleur principale** : #06C270 (vert Fady)
- **Polices** : Uber Move Medium et Bold
- **Animations** : Micro-interactions avec Framer Motion
- **Responsive** : Interface adaptative mobile/desktop

## 🔧 Structure du projet

```
fady-admin/
├── src/
│   ├── app/
│   │   ├── (auth)/login/          # Page de connexion
│   │   ├── (dashboard)/           # Dashboard et pages admin
│   │   │   ├── page.tsx          # Dashboard principal
│   │   │   ├── users/            # Liste des utilisateurs
│   │   │   ├── hairdressers/     # Liste des coiffeurs
│   │   │   ├── diplomas/         # Gestion des diplômes
│   │   │   └── admins/           # Gestion des admins
│   │   ├── fonts/                # Polices personnalisées
│   │   └── layout.tsx            # Layout principal
│   ├── components/
│   │   └── ui/                   # Composants Shadcn UI
│   └── lib/
│       ├── supabase/             # Configuration Supabase
│       └── hooks/                # Hooks personnalisés
├── middleware.ts                  # Middleware d'authentification
└── components.json               # Configuration Shadcn UI
```

## 🚀 Déploiement

1. **Build de production**
   ```bash
   npm run build
   ```

2. **Démarrage en production**
   ```bash
   npm start
   ```

3. **Variables d'environnement**
   
   Assurez-vous que les variables d'environnement sont configurées sur votre plateforme de déploiement.

## 📝 Notes importantes

- Les polices Uber Move doivent être ajoutées manuellement
- Le premier administrateur doit être créé manuellement en base
- L'interface est entièrement en français
- Toutes les données sont sécurisées par Row Level Security (RLS)

## 🤝 Support

Pour toute question ou problème, contactez l'équipe de développement Fady.