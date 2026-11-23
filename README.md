# Harvest

Prospection et suivi de leads sur le terrain. Deux projets indépendants :

- `api/` — Fastify, Drizzle, Postgres (auth, RBAC/ABAC, leads, calendrier, import/export)
- `web/` — Next.js (CRM, carte de tournée, calendrier, documentation publique)

## Démarrer

```bash
scripts/db-local.sh start      # Postgres local, port 54329
cd api && npm run dev          # http://localhost:4000
cd web && npm run dev          # http://localhost:3000
```

## Hooks Git (Husky)

Installés par `npm install` à la racine (script `prepare`).

| Hook | Ce qu'il fait |
| --- | --- |
| `pre-commit` | refuse tout secret ou fichier `.env` (`scripts/check-secrets.mjs`), lance ESLint sur les fichiers web indexés, puis le contrôle de types de `api/` et `web/` |
| `pre-push` | contrôle de types, tests unitaires du web, et tests de l'API si la base de test tourne (`scripts/pre-push.sh`) |

Passer outre exceptionnellement : `git commit --no-verify`, ou `SKIP_PREPUSH=1 git push`.

## Tests

```bash
npm --prefix api test          # nécessite la base de test (scripts/db-local.sh start)
npm --prefix web test          # tests unitaires
npm --prefix web run test:e2e  # tests de bout en bout (Chrome, ports 3100 et 4100, base de test)
```
