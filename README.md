# EMPIRE-FLEET CONTROL

Application de gestion de flotte de véhicules (Condition-Vente & Location) pour entrepreneur partenaire Yango.

## Stack

- **Next.js 14** (App Router, TypeScript) — frontend + API routes
- **PostgreSQL** + **Prisma** — base de données relationnelle persistante
- **NextAuth** (credentials provider) + **bcryptjs** — authentification, mots de passe hashés
- **Tailwind CSS** — interface responsive
- **ExcelJS** + **@react-pdf/renderer** — exports Excel et PDF

## Installation locale

### 1. Prérequis

```bash
brew install node postgresql@16
brew services start postgresql@16
createdb empire_fleet_control
```

### 2. Configuration

```bash
cp .env.example .env
# éditer .env : DATABASE_URL, NEXTAUTH_SECRET (générer avec `openssl rand -base64 32`)
```

### 3. Installation et base de données

```bash
npm install
npx prisma migrate dev --name init
npm run prisma:seed
```

Le seed crée un compte administrateur par défaut :
- **Identifiant** : `admin`
- **Mot de passe** : `Admin@2026`

⚠️ Changez ce mot de passe immédiatement après la première connexion (page Utilisateurs).

### 4. Lancer l'application

```bash
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000).

## Modèle de permissions

- **Administrateur** : tous les droits (création/suppression de comptes, chauffeurs, affectations, paramètres).
- **Employé** : lecture totale sur toutes les données. Écriture (versements, caution, suivi hebdo, commentaires, profil) **uniquement** sur les chauffeurs qui lui ont été affectés via la page "Affectations". Le contrôle est appliqué côté serveur sur chaque endpoint d'écriture (`src/lib/access.ts` → `requireDriverWriteAccess`), donc impossible à contourner depuis le navigateur.

## Logique métier clé

- **Versements/Loyers** : un badge "Jour inhabituel" s'affiche automatiquement si la date saisie est un mardi ou un dimanche (`src/lib/business.ts` → `isUnusualPaymentDay`).
- **Pénalités hebdomadaires** : calculées sur les heures manquantes (`(objectif − heures réalisées) × taux du chauffeur`) mais **jamais déduites automatiquement**. Un bouton "Appliquer" déclenche la déduction réelle :
  - Location → crée un mouvement de caution `DEDUCTION_SANCTION`.
  - Condition-Vente → s'ajoute au "reste à payer" affiché sur la fiche chauffeur.
- **Solde de caution** : recalculé en temps réel comme la somme de tous les mouvements (`caution_movements`), jamais stocké comme valeur figée.
- **Classements** : basés sur le nombre de courses cumulées (`weekly_trackings.ridesCompleted`), séparés par type de contrat.
- **Audit** : chaque création/modification significative est journalisée dans `audit_logs` (qui, quoi, quand).

## Déploiement en production

1. Provisionner une base PostgreSQL managée (Neon, Supabase, RDS...).
2. Définir `DATABASE_URL` et `NEXTAUTH_SECRET` dans les variables d'environnement de l'hébergeur (Vercel, Render, VPS Docker...).
3. `npx prisma migrate deploy` au déploiement.
4. `npm run build && npm run start` (ou build Next.js standard sur Vercel).
5. Exécuter le seed une seule fois sur la base de production pour créer le compte admin initial.

## Structure des dossiers

```
prisma/schema.prisma     Schéma de base de données complet
prisma/seed.ts           Création du compte admin par défaut
src/lib/                 Auth, contrôle d'accès, logique métier, exports
src/app/api/             Toutes les routes API (drivers, payments, caution, weekly, comments, users, assignments, dashboard)
src/app/                 Pages : login, dashboard, drivers, users, assignments
```
