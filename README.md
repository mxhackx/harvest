# Hivation

> **Changer le nom du produit** : une seule ligne par application. Site : `name` dans [web/src/lib/brand.ts](web/src/lib/brand.ts) (interface, titres, référencement, documentation). API : `BRAND_NAME` dans [api/src/brand.ts](api/src/brand.ts) (e-mails, expéditeur par défaut). Le logo se remplace à part : `web/public/logo.svg`, `logo.png`, `icon-192.png`, `icon-512.png`, `web/src/app/favicon.ico`, `icon.png` et `apple-icon.png`. Les identifiants techniques (`harvest_session`, clés `harvest.*` du navigateur, noms de base) gardent leur nom : les changer déconnecterait les utilisateurs.

Prospection et suivi de leads sur le terrain. Deux projets indépendants :

- `api/` — Fastify, Drizzle, Postgres (auth, RBAC/ABAC, leads, calendrier, import/export)
- `web/` — Next.js (CRM, carte de tournée, calendrier, documentation publique)

## Cahier des charges

La vision, les modules et les exigences du produit sont dans [docs/cahier-des-charges.md](docs/cahier-des-charges.md). Le plan du module CMS (document de travail) est dans [docs/cahier-des-charges-cms.md](docs/cahier-des-charges-cms.md).

## Variables d'environnement (Doppler)

Les valeurs vivent dans [Doppler](https://www.doppler.com), en deux projets : `hivation-api` et `hivation-web`, chacun avec les configs `dev`, `stg` et `prd`. `doppler.yaml` relie chaque dossier à son projet. Aucun fichier `.env` n'est nécessaire. Toutes les variables, obligatoires et facultatives, sont décrites dans [api/.env.example](api/.env.example) et [web/.env.example](web/.env.example). Sans accès à Doppler, copiez ces fichiers en `api/.env` et `web/.env.local` (les variables de Doppler passent devant).

Première fois :

```bash
doppler login
doppler projects create hivation-api
doppler projects create hivation-web
doppler setup                                        # à la racine, lit doppler.yaml
# les valeurs se saisissent dans le tableau de bord Doppler (jamais dans Git)
```

Ensuite : `npm run dev` dans `api/` et dans `web/` (il passe par Doppler ; `npm run dev:local` s’en passe et lit les fichiers `.env`) ; `npm run db:migrate:doppler` dans `api/`.

| Projet | Variables |
| --- | --- |
| `hivation-api` | `DATABASE_URL`, `APP_URLS`, `API_URL`, `PORT`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `RESEND_API_KEY`, `MAIL_FROM`, `SUPPORT_EMAIL`, `ROUTING_URL`, `GEOCODING`, `GEOCODER_URL` |
| `hivation-web` | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_DOCS_URL`, `NEXT_PUBLIC_CMS_URL`, `API_PROXY_TARGET` |

**Production.** Remplissez `prd` avec les valeurs **de production** relevées sur Render et Vercel (jamais avec vos fichiers locaux), puis activez les synchronisations Doppler → Render (`hivation-api`) et Doppler → Vercel (`hivation-web`). Comparez les listes avant d'activer : une variable oubliée dans Doppler peut manquer en ligne. Les `NEXT_PUBLIC_*` sont lues à la compilation (redéployer après changement) et visibles dans le navigateur : n'y mettez aucun secret.

## Démarrer

```bash
scripts/db-local.sh start                      # Postgres local, port 54329
cd api && npm run db:migrate:doppler           # applique les migrations
cd api && npm run dev                  # http://localhost:4000
cd web && npm run dev                  # http://localhost:3000
```

## Adresses du site

- Publiques : `/` (présentation), `/login`, `/docs`, `/invitation`, `/forgot-password`, `/reset-password`.
- Espace connecté : tout est sous `/dashboard`, non référencé par les moteurs de recherche. Chaque module a son préfixe : `/dashboard/crm/…` (`leads`, `contacts`, `tasks`, `templates`, `pipeline`, `reports`) et `/dashboard/erp/…` (`team`). Seuls l'accueil (`/dashboard`) et le calendrier (`/dashboard/calendar`) n'en ont pas. Taper `/dashboard/crm` ou `/dashboard/erp` seul mène à la première page du module. Toutes les adresses sont en anglais et écrites une seule fois dans [web/src/lib/routes.ts](web/src/lib/routes.ts).
- Anciennes adresses (françaises, ou sans `/crm`, comme `/taches`, `/dashboard/leads`, `/reinitialiser`, `/docs/equipe`…) : elles redirigent vers les nouvelles, sous-pages et paramètres compris (les e-mails déjà envoyés restent valides), et les pages épinglées dans le navigateur sont réécrites à la lecture. La liste est dans [web/src/lib/legacy-routes.ts](web/src/lib/legacy-routes.ts).

## Tâches de fond (API)

Le serveur lance des tâches périodiques ([api/src/jobs.ts](api/src/jobs.ts)), jamais pendant les tests : la **purge de la corbeille** toutes les 6 h (les leads supprimés depuis plus de 30 jours sont effacés pour de bon) la **purge du journal d'audit** (conservé un an) et les **rappels** toutes les 5 min (notification et e-mail Resend, une heure avant l'échéance d'une tâche ou d'un rendez-vous ; chaque échéance n'est rappelée qu'une fois, `reminded_at`). Une erreur est journalisée sans arrêter l'API.

## Vagues et régions

Le produit tourne autour des **vagues** : une région couverte pendant une période, avec un objectif de visites et un bilan.
- **Régions** (`regions`) : un centre et un rayon. `leads.region_id` est *déduit* de la position du lead ([api/src/waves/geo.ts](api/src/waves/geo.ts), haversine) à la création, à la modification, à l'import, à la localisation en arrière-plan, et recalculé pour toute l'entreprise quand une région change.
- **Vagues** (`waves`) : région, période, objectif. Phase calculée (à venir, en cours, en retard, clôturée) ; bilan (visités, convertis, à repasser) calculé en direct par [api/src/waves/stats.ts](api/src/waves/stats.ts), figé à la clôture.
- Droits `wave:create|update|delete` (CEO et Manager) ; tout membre lit. Interface : section *Vagues* du menu (vagues, régions, carte). Documentation utilisateur : `/docs/waves`.

## Workflows (IA)

`/dashboard/ai/workflows` : éditeur de chaînes (React Flow). La table `workflows` stocke le dessin en JSON, validé par `api/src/workflows/graph.ts` (un déclencheur, chaîne linéaire, plafond d'autonomie par action, cahier des charges §12). **Aucun moteur d'exécution pour l'instant.** Test navigateur : `web/e2e/workflows.spec.ts`.

## CMS

`/cms` : éditeur de sites façon Figma, sur `cms.hivation.tech` (`NEXT_PUBLIC_CMS_URL`, à mettre aussi dans `APP_URLS`). **Produit séparé du CRM**, même compte : `cms_accounts` (espace ouvert à la demande) et `cms_sites` (un propriétaire, `version` contre l'écrasement). La forme d'un site est vérifiée à chaque enregistrement ([api/src/cms/site-schema.ts](api/src/cms/site-schema.ts)). Publication prévue sur `*.sites.hivation.tech`.

**Origine des écritures.** L'API refuse toute requête de modification venant d'un navigateur dont l'adresse n'est pas dans `APP_URLS` ([api/src/plugins/origin.ts](api/src/plugins/origin.ts)) : les sites publiés, sur un sous-domaine, ne pourront pas agir au nom d'un utilisateur. **Ajoutez à `APP_URLS` chaque adresse web de la plateforme**, sinon ses actions seront refusées ; n'y mettez jamais une adresse de site client.

- `lib/cms/model.ts` : pages, arbre de nœuds, variables, styles, modèles, contrôles. Un composant importé (React Bits, Bento) ou une IA doit produire ce modèle.
- `lib/cms/style.ts` : **la seule** traduction propriétés → CSS, partagée par le canevas et l’export ; elle filtre couleurs et liens.
- `lib/cms/export.ts` : projet Next.js (pages, `/api/contact`, schéma Drizzle), zippé dans le navigateur. Le texte saisi y reste une donnée.

Les composants animés (avec leur propre code et leurs dépendances) demanderont un nouveau type de nœud, rendu sur le canevas et copié dans l’export.

## Pièces jointes

Images et PDF des leads (50 Mo au plus), dans un bucket Supabase **privé** (`attachments`). Variables de l'API : `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (absentes : fonction désactivée). Le navigateur envoie directement au stockage par une adresse signée ; l'API vérifie ensuite le type réel (premiers octets) et la taille, et ne délivre que des liens d'une minute ([api/src/routes/attachments.ts](api/src/routes/attachments.ts)). Les fichiers d'un lead effacé sont retirés toutes les 6 h.

## Composants (registre et marketplace)

`registry/` est un **site statique à part** (projet Vercel avec *Root Directory* = `registry`, domaine `ui.hivation.tech`) : la marketplace et son API (`/r/registry.json`, `/r/<nom>.json`). Un composant est une **donnée** (arbre de nœuds), jamais du code ; uniquement des composants maison ou sous licence MIT (avec leur mention). La catégorie « shadcn/ui » ([registry/src/shadcn.ts](registry/src/shadcn.ts)) reprend leur allure avec des nœuds, pas leur code React.

- Ajouter un composant : [registry/src/components.ts](registry/src/components.ts), puis `npm run registry:build` dans `web/` et commiter `registry/public` (un test vérifie qu'il est à jour).
- En local : `npm run registry:dev` dans `web/` (http://localhost:3001).
- Le CMS lit `NEXT_PUBLIC_REGISTRY_URL` et revérifie tout ce qu'il reçoit ([web/src/lib/cms/library.ts](web/src/lib/cms/library.ts)).

## E-mails depuis le CRM

`POST /leads/:id/emails` envoie via Resend (`MAIL_FROM` comme expéditeur, l'adresse de la personne en `reply_to`), garde une ligne dans `email_log` et une entrée « E-mail à … » dans le fil du lead. Le CRM n'a pas de boîte de réception : les réponses arrivent chez l'expéditeur, donc aucune boîte mail n'est à créer pour l'envoi. Plafond de 100 envois par personne et par jour. Les lignes sont incluses dans l'export RGPD d'un contact et effacées avec lui.

## Tournées (itinéraires)

`POST /tours/plan` calcule une tournée (ordre optimisé ou donné, tronçons, horaires, tracé) ; `/tours` enregistre les tournées personnelles. Les itinéraires routiers viennent d'**OSRM** ([api/src/routing/plan.ts](api/src/routing/plan.ts)) : `ROUTING_URL` (par défaut le serveur de démonstration public, à usage léger — **hébergez le vôtre en production** ; `off` coupe tout appel). Les coordonnées des prospects d'une tournée sont envoyées à ce service. Sans réponse, l'itinéraire est estimé en ligne droite (+30 %, 35 km/h) et marqué `approximate`. Seuls les prospects en présentiel (`visit_mode = onsite`) et localisés peuvent être des étapes.

## Mode hors-ligne

Le service worker [web/public/sw.js](web/public/sw.js) garde une copie des pages `/dashboard`, du code de l'application, des fonds de carte vus et des lectures de l'API listées dans [web/src/lib/offline-rules.ts](web/src/lib/offline-rules.ts) (une copie par entreprise). Hors connexion, deux gestes seulement se mettent en attente dans IndexedDB ([web/src/lib/offline.ts](web/src/lib/offline.ts)) : `PATCH /leads/:id` avec `visited` ou `status`, et `POST /leads/:id/activities` ; ils sont rejoués dans l'ordre au retour du réseau (réessai toutes les 5 s). Le reste échoue avec un message. La copie est effacée à la déconnexion. Le test de bout en bout demande le site compilé : `npm --prefix web run test:e2e:offline`.

## Documentation (centre d'aide)

Les pages `/docs` suivent le modèle d'un centre d'aide : recherche (Ctrl+K), **deux parties** — *Guide utilisateur* (usage) et *API et intégrations* (webhooks, formats de fichiers) —, des **collections**, fil d'Ariane, « Cet article vous a-t-il aidé ? » et articles liés. Le rangement est dans `COLLECTIONS` de [web/src/lib/docs.ts](web/src/lib/docs.ts) : une nouvelle page doit y être ajoutée (un test le vérifie). La bulle de contact en bas à droite envoie `POST /public/contact` ; les avis vont dans `doc_feedback`.

## Journal d'audit

Chaque action réussie qui modifie des données (POST, PATCH, PUT, DELETE d'un membre connecté) ajoute une ligne à `audit_log` : qui, quelle route, quel objet (nom conservé même après suppression). Jamais le contenu des requêtes (mots de passe, jetons). Le hook est dans [api/src/audit/record.ts](api/src/audit/record.ts) ; pour qu'une route garde le nom de l'objet touché, elle pose `req.auditLabel`. Lecture : `GET /audit` (droit `audit:read`, réservé au CEO) et page *ERP › Journal d'audit*. La phrase affichée pour chaque route est dans [web/src/lib/audit.ts](web/src/lib/audit.ts) : à compléter quand on ajoute une route.

## Page d’accueil

`web/src/app/page.tsx`, toujours sombre (classe `.landing` dans `globals.css`, qui porte aussi les effets). Les effets au défilement sont dans `components/landing/effects.tsx` ; ils respectent « réduire les animations » et le texte reste lisible sans JavaScript. Les aperçus (`screens.tsx`) et les mini-scènes des cartes (`scenes.tsx`) sont des maquettes avec des données d’exemple.

## Styles

Polices, tailles et couleurs sont définies une seule fois, dans [web/src/app/globals.css](web/src/app/globals.css) (bloc `@theme`). Les composants utilisent les classes qui en découlent (`font-display`, `text-heading`, `bg-accent`…) ou `var(--…)` : aucune valeur de style écrite en dur. Exceptions : le code qui ne lit pas le CSS (cartes MapLibre via `cssVar()`, aperçu de partage et `themeColor` via `THEME`) passe par [web/src/lib/theme.ts](web/src/lib/theme.ts), et un test vérifie que ces copies suivent `globals.css`. Les couleurs d'étapes du pipeline et du logo Google sont des données, pas du style.

Police des titres : Plus Jakarta Sans (`font-display`), texte : Inter.

**Mode sombre** : les mêmes jetons ont des valeurs sombres dans `:root[data-theme="dark"]` (même fichier). Le choix (clair, sombre, auto) se fait dans le menu du compte et est gardé dans le navigateur (`hivation.theme`) ; un petit script du layout l'applique avant l'affichage, pour éviter un éclair clair. Les fonds de carte OpenStreetMap restent clairs.

## Hooks Git (Husky)

Installés par `npm install` à la racine (script `prepare`).

| Hook | Ce qu'il fait |
| --- | --- |
| `pre-commit` | refuse tout secret ou fichier `.env` (`scripts/check-secrets.mjs`), lance ESLint sur les fichiers web indexés, puis le contrôle de types de `api/` et `web/` |
| `pre-push` | dépend de la branche poussée (`scripts/pre-push.sh`) : **vers `main` ou `staging`**, types + tests unitaires du web + tests de l'API (la base de test est obligatoire) ; **vers toute autre branche**, types seulement |

### Intégration continue

`.github/workflows/ci.yml` tourne à chaque push et pull request : types, build et tests de l'API (base Postgres de service), types, ESLint, tests et build du web. Le job final **CI** résume le tout.

Pour rendre `main` inviolable, activez dans GitHub (Settings › Branches › règle sur `main`) : *Require a pull request before merging* et *Require status checks to pass* avec le statut **CI**. Husky n'est qu'un garde-fou local, contournable ; cette règle ne l'est pas.

### Branches

- **Sur GitHub, seulement deux branches :** `main` (toujours vert, déployé, jamais de push direct) et `staging` (intégration).
- **Tout le reste reste en local.** Une fonctionnalité = une branche locale `feat/<sujet>` (ou `fix/`, `chore/`, `docs/`, `test/`). On ne la pousse pas : on la fusionne dans `staging` (`git merge --no-ff`), on pousse `staging`, puis on **supprime la branche locale** (`git branch -d`).
- Mise en ligne : une pull request `staging` vers `main`, après avoir vérifié que `staging` contient `origin/main` (sinon, fusionner `origin/main` dans `staging`).
- Le push vers `staging` (comme vers `main`) lance le contrôle complet : types, tests unitaires du web, tests de l'API (base de test obligatoire). Un nom de branche doit commencer par `feat/`, `test/`, `fix/`, `chore/` ou `docs/` ; `main` et `staging` sont libres.

Passer outre exceptionnellement : `git commit --no-verify`, ou `SKIP_PREPUSH=1 git push`.

## Sécurité

- **Isolation entre entreprises** : [api/src/test/isolation.test.ts](api/src/test/isolation.test.ts) fait essayer par l'entreprise B de lire, modifier, supprimer et rattacher les données de A, sur chaque route, puis rejoue les requêtes avec A (témoin). **Toute nouvelle route doit y être décrite**, sinon le test échoue.
- **Analyse automatique** : `.github/workflows/security.yml` lance Semgrep et `npm audit` (PR, `main`, `staging`, et chaque lundi). Faux positif : `// nosemgrep: <règle>` avec la raison.
- **Dépendances** : `.github/dependabot.yml` propose des mises à jour vers `staging`, après 7 jours.

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
| `APP_URLS` | les adresses du site, **l'application en premier** : `https://app.hivation.tech,https://www.hivation.tech,https://docs.hivation.tech` (la première sert aux liens des e-mails et à la redirection après connexion ; toutes sont autorisées par CORS) |
| `API_URL` | `https://api.hivation.tech` (adresse de l'API **vue par le navigateur**, voir ci-dessous) |
| `GOOGLE_*`, `GITHUB_*` | vos clés OAuth, ou vides |
| `RESEND_API_KEY` | clé API [Resend](https://resend.com) pour les e-mails (invitations, mot de passe oublié) ; vide : aucun e-mail, les liens s'affichent à l'écran |
| `SUPPORT_EMAIL` | adresse qui reçoit les messages de la bulle de contact de la documentation (facultatif : sans elle, ils sont seulement gardés dans la table `contact_messages`) |
| `MAIL_FROM` | expéditeur, ex. `Hivation <noreply@hivation.tech>`. Le domaine doit être vérifié chez Resend ; sans domaine, l'expéditeur par défaut (`onboarding@resend.dev`) n'écrit qu'à l'adresse de votre compte Resend |

Vérifiez ensuite `https://<votre-service>.onrender.com/health` : `{"status":"ok"}`.

### 3. Vercel (dossier racine du projet : `web`)

| Variable | Valeur |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | `https://api.hivation.tech` (domaine de l'API sur Render ; pas de relais `/api` nécessaire, voir ci-dessous) |
| `NEXT_PUBLIC_SITE_URL` | l'adresse de la vitrine : `https://www.hivation.tech` (`hivation.tech` redirige vers `www` dans Vercel) |
| `NEXT_PUBLIC_APP_URL` | l'adresse de l'application, ex. `https://app.hivation.tech` |
| `NEXT_PUBLIC_DOCS_URL` | l'adresse de la documentation, ex. `https://docs.hivation.tech` (facultatif : sans elle, la doc reste sur la vitrine) |

Ajoutez les domaines `www.hivation.tech` (principal, `hivation.tech` y redirige) et `app.hivation.tech` au **même** projet Vercel. Le proxy ([web/src/proxy.ts](web/src/proxy.ts)) envoie `/dashboard`, `/login`, `/invitation`, `/forgot-password`, `/reset-password` et `/onboarding` vers `app.`, et la racine de `app.` (ainsi que `/docs`) vers le bon endroit.

**Documentation sur `docs.`** Dans cet ordre : ajoutez `docs.hivation.tech` au même projet Vercel (avec l'enregistrement DNS qu'il indique) ; ajoutez `https://docs.hivation.tech` **à la fin** de `APP_URLS` sur Render, sinon la bulle de contact et les avis de la doc sont bloqués par CORS ; puis définissez `NEXT_PUBLIC_DOCS_URL` et redéployez Vercel. `/docs` redirige alors vers `docs.`, et la racine de `docs.` ouvre le centre d'aide. On se connecte sur `app.`, et le navigateur reste sur `app.hivation.tech` (jamais sur `www`). Sans `NEXT_PUBLIC_APP_URL`, tout reste sur un seul domaine.

Redéployez : ces variables sont lues à la compilation.

**Relais `/api` (seulement si l'API n'est pas sur un sous-domaine de votre domaine).** Avec `api.hivation.tech`, `app.hivation.tech` et `www.hivation.tech`, le cookie reste « du même site » et le relais est inutile. Sinon, le site et l'API sont sur deux domaines différents (réglage : `NEXT_PUBLIC_API_URL=/api` et `API_PROXY_TARGET`). Le cookie de session de l'API serait
alors un cookie « tiers », bloqué par Safari et Firefox. Le site relaie donc `/api/*` vers l'API : le navigateur ne
parle qu'à un seul domaine et le cookie reste un cookie du site. Si vous préférez deux sous-domaines d'un même domaine
(`app.exemple.com` et `api.exemple.com`), le relais est inutile : mettez l'adresse de l'API dans
`NEXT_PUBLIC_API_URL` et dans `API_URL`.

### 4. Connexion Google / GitHub

Dans les consoles, déclarez comme adresse de retour :

- `https://api.hivation.tech/auth/google/callback`
- `https://api.hivation.tech/auth/github/callback`

### À savoir

- **Plan gratuit de Render** : le service s'endort après 15 minutes. La première requête suivante peut échouer
  (le relais de Vercel n'attend pas une minute) : rechargez. Le plan `starter` supprime ce défaut.
- **Sécurité par ligne** : la migration `enable_rls` active la RLS sur toutes les tables, pour qu'elles ne soient
  pas lisibles par l'API REST que Supabase expose. L'API se connecte avec le rôle propriétaire, qui la contourne.
  Une nouvelle table doit être ajoutée à une migration équivalente (un test le vérifie).
- **Recherche d'adresse et fonds de carte** : ils passent par les services publics d'OpenStreetMap, dont l'usage
  intensif est limité. Prévoyez un fournisseur dédié avant une vraie mise en production.
