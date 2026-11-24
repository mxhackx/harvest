#!/usr/bin/env bash
# Test de bout en bout du mode hors-ligne : il demande le site compilé (en développement, Next recharge le code à chaud
# et la lecture hors ligne n'est pas fiable). Compile, démarre le site sur le port des tests, lance le test, puis l'arrête.
set -euo pipefail
cd "$(dirname "$0")/.."
export NEXT_PUBLIC_API_URL=http://localhost:4100 NEXT_PUBLIC_SITE_URL=http://localhost:3100 NEXT_DIST_DIR=.next-offline
rm -rf .next-offline
npx next build > /dev/null
npx next start -p 3100 > /dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true; rm -rf .next-offline' EXIT
for _ in $(seq 1 40); do curl -s -o /dev/null -m 2 http://localhost:3100/login && break; sleep 1; done
E2E_OFFLINE=1 npx playwright test e2e/offline.spec.ts
