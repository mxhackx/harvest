#!/usr/bin/env bash
# Avant un push : types, tests unitaires du web, et tests de l'API si la base de test tourne.
# Pour passer outre exceptionnellement : SKIP_PREPUSH=1 git push   (ou git push --no-verify)
set -euo pipefail
cd "$(dirname "$0")/.."
[ "${SKIP_PREPUSH:-}" = "1" ] && { echo "pre-push ignoré (SKIP_PREPUSH=1)"; exit 0; }

echo "▸ pre-push : contrôle des types (api + web)"
npm run typecheck --silent

echo "▸ pre-push : tests unitaires du web"
npm --prefix web test --silent

# La base de test écoute sur le port 54329 (scripts/db-local.sh start).
if (echo > /dev/tcp/127.0.0.1/54329) 2>/dev/null; then
  echo "▸ pre-push : tests de l'API"
  npm --prefix api test --silent
else
  echo "▸ pre-push : tests de l'API IGNORÉS — base de test injoignable (lancez scripts/db-local.sh start)"
fi
