# Hivation

> **Changer le nom du produit** : une seule ligne par application. Site : `name` dans [web/src/lib/brand.ts](web/src/lib/brand.ts) (interface, titres, référencement, documentation). API : `BRAND_NAME` dans [api/src/brand.ts](api/src/brand.ts) (e-mails, expéditeur par défaut). Le logo se remplace à part : `web/public/logo.svg`, `logo-on-blue.svg`, `logo.png`, `icon-192.png`, `icon-512.png`, `web/src/app/icon.svg` et `apple-icon.png`. Les identifiants techniques (`harvest_session`, clés `harvest.*` du navigateur, noms de base) gardent leur nom : les changer déconnecterait les utilisateurs.

Prospection et suivi de leads sur le terrain. Deux projets indépendants :

- `api/` — Fastify, Drizzle, Postgres (auth, RBAC/ABAC, leads, calendrier, import/export)
- `web/` — Next.js (CRM, carte de tournée, calendrier, documentation publique)

## Démarrer

```bash
scripts/db-local.sh start      # Postgres local, port 54329
cd api && npm run dev          # http://localhost:4000
cd web && npm run dev          # http://localhost:3000
```

## Adresses du site

- Publiques : `/` (présentation), `/login`, `/docs`, `/invitation`, `/mot-de-passe-oublie`, `/reinitialiser`.
- Espace connecté : tout est sous `/dashboard` (`/dashboard/leads`, `/dashboard/taches`…), non référencé par les moteurs de recherche. Les adresses sont écrites une seule fois dans [web/src/lib/routes.ts](web/src/lib/routes.ts). Les anciennes adresses (`/leads`, `/taches`…) redirigent vers les nouvelles.

## Hooks Git (Husky)

Installés par `npm install` à la racine (script `prepare`).

| Hook | Ce qu'il fait |
| --- | --- |
| `pre-commit` | refuse tout secret ou fichier `.env` (`scripts/check-secrets.mjs`), lance ESLint sur les fichiers web indexés, puis le contrôle de types de `api/` et `web/` |
| `pre-push` | dépend de la branche poussée (`scripts/pre-push.sh`) : **vers `main`**, types + tests unitaires du web + tests de l'API (la base de test est obligatoire) ; **vers toute autre branche**, types seulement |

### Intégration continue

`.github/workflows/ci.yml` tourne à chaque push et pull request : types, build et tests de l'API (base Postgres de service), types, ESLint, tests et build du web. Le job final **CI** résume le tout.

Pour rendre `main` inviolable, activez dans GitHub (Settings › Branches › règle sur `main`) : *Require a pull request before merging* et *Require status checks to pass* avec le statut **CI**. Husky n'est qu'un garde-fou local, contournable ; cette règle ne l'est pas.

### Branches

- `main` : toujours vert, déployé.
- `feat/<sujet>` : nouvelle fonctionnalité. `test/<sujet>` : ajout ou réparation de tests. `fix/`, `chore/` et `docs/` sont aussi acceptés.
- Tout autre nom est refusé au push. On fusionne dans `main` par pull request ; le push vers `main` déclenche le contrôle complet.

Passer outre exceptionnellement : `git commit --no-verify`, ou `SKIP_PREPUSH=1 git push`.

## Tests

```bash
npm --prefix api test          # nécessite la base de test (scripts/db-local.sh start)
npm --prefix web test          # tests unitaires
npm --prefix web run test:e2e  # tests de bout en bout (Chrome, ports 3100 et 4100, base de test)
```

## Déploiement

Site sur **Vercel**, API sur **Render**, base sur **Supabase**. Les migrations s'appliquent toutes seules à chaque
démarrage de l'API (`npm run start:prod`).

### 1. Supabase

1. Créez un projet, dans une région proche de celle de Render (`render.yaml` : Francfort).
2. *Project Settings › Database › Connection string* : choisissez **Session pooler** (port **5432**).
   - pas la connexion directe : elle est en IPv6 uniquement, et Render gratuit est en IPv4 ;
   - pas le pooler en mode transaction (port 6543) : les migrations ont besoin d'une session (verrou). L'API
     refuse de migrer dessus, avec un message qui l'explique.
3. Remplacez `[YOUR-PASSWORD]` par le mot de passe de la base. Les caractères spéciaux doivent être encodés
   dans l'URL (`@` → `%40`, `/` → `%2F`).

### 2. Render

*New › Blueprint*, choisissez ce dépôt : Render lit `render.yaml` et demande les variables :

| Variable | Valeur |
| --- | --- |
| `DATABASE_URL` | l'URL du Session pooler de Supabase |
| `APP_URLS` | les adresses du site, **l'application en premier** : `https://app.hivation.tech,https://hivation.tech` (la première sert aux liens des e-mails et à la redirection après connexion ; toutes sont autorisées par CORS) |
| `API_URL` | `https://app.hivation.tech/api` (adresse de l'API **vue par le navigateur**, voir ci-dessous) |
| `GOOGLE_*`, `GITHUB_*` | vos clés OAuth, ou vides |
| `RESEND_API_KEY` | clé API [Resend](https://resend.com) pour les e-mails (invitations, mot de passe oublié) ; vide : aucun e-mail, les liens s'affichent à l'écran |
| `MAIL_FROM` | expéditeur, ex. `Hivation <noreply@hivation.tech>`. Le domaine doit être vérifié chez Resend ; sans domaine, l'expéditeur par défaut (`onboarding@resend.dev`) n'écrit qu'à l'adresse de votre compte Resend |

Vérifiez ensuite `https://<votre-service>.onrender.com/health` : `{"status":"ok"}`.

### 3. Vercel (dossier racine du projet : `web`)

| Variable | Valeur |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | `/api` |
| `API_PROXY_TARGET` | `https://<votre-service>.onrender.com` |
| `NEXT_PUBLIC_SITE_URL` | l'adresse de la vitrine, ex. `https://hivation.tech` |
| `NEXT_PUBLIC_APP_URL` | l'adresse de l'application, ex. `https://app.hivation.tech` |

Ajoutez les deux domaines (`hivation.tech` et `app.hivation.tech`) au **même** projet Vercel. Le proxy ([web/src/proxy.ts](web/src/proxy.ts)) envoie `/dashboard`, `/login`, `/invitation`, `/mot-de-passe-oublie`, `/reinitialiser` et `/onboarding` vers `app.`, et la racine de `app.` (ainsi que `/docs`) vers le bon endroit. Chaque domaine relaie `/api` pour son propre cookie de session : on se connecte sur `app.`. Sans `NEXT_PUBLIC_APP_URL`, tout reste sur un seul domaine.

Redéployez : ces variables sont lues à la compilation.

**Pourquoi un relais `/api` ?** Le site et l'API sont sur deux domaines différents. Le cookie de session de l'API serait
alors un cookie « tiers », bloqué par Safari et Firefox. Le site relaie donc `/api/*` vers l'API : le navigateur ne
parle qu'à un seul domaine et le cookie reste un cookie du site. Si vous préférez deux sous-domaines d'un même domaine
(`app.exemple.com` et `api.exemple.com`), le relais est inutile : mettez l'adresse de l'API dans
`NEXT_PUBLIC_API_URL` et dans `API_URL`.

### 4. Connexion Google / GitHub

Dans les consoles, déclarez comme adresse de retour :

- `https://app.hivation.tech/api/auth/google/callback`
- `https://app.hivation.tech/api/auth/github/callback`

### À savoir

- **Plan gratuit de Render** : le service s'endort après 15 minutes. La première requête suivante peut échouer
  (le relais de Vercel n'attend pas une minute) : rechargez. Le plan `starter` supprime ce défaut.
- **Sécurité par ligne** : la migration `enable_rls` active la RLS sur toutes les tables, pour qu'elles ne soient
  pas lisibles par l'API REST que Supabase expose. L'API se connecte avec le rôle propriétaire, qui la contourne.
  Une nouvelle table doit être ajoutée à une migration équivalente (un test le vérifie).
- **Recherche d'adresse et fonds de carte** : ils passent par les services publics d'OpenStreetMap, dont l'usage
  intensif est limité. Prévoyez un fournisseur dédié avant une vraie mise en production.
