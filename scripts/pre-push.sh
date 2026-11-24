#!/usr/bin/env bash
# Hook pre-push, selon la branche poussée :
#   - vers main ou staging : contrôle complet (types, tests web, tests API — la base de test est OBLIGATOIRE)
#   - vers une autre branche : contrôle léger (types uniquement)
# Les noms de branche doivent commencer par feat/ ou test/ (ou fix/, chore/, docs/ ; main et staging sont libres).
# Pour passer outre exceptionnellement : SKIP_PREPUSH=1 git push   (ou git push --no-verify)
set -euo pipefail
cd "$(dirname "$0")/.."
[ "${SKIP_PREPUSH:-}" = "1" ] && { echo "pre-push ignoré (SKIP_PREPUSH=1)"; exit 0; }

# Git fournit sur stdin : <ref locale> <sha local> <ref distante> <sha distant>
full=0; bad=""
while read -r _lref lsha rref _rsha; do
  [ -z "${rref:-}" ] && continue
  # Suppression d'une branche distante : rien à vérifier.
  [[ "$lsha" =~ ^0+$ ]] && continue
  branch="${rref#refs/heads/}"
  case "$branch" in
    main|staging) full=1 ;;
    feat/*|test/*|fix/*|chore/*|docs/*) ;;
    *) [[ "$rref" == refs/heads/* ]] && bad="$branch" ;;
  esac
done

if [ -n "$bad" ]; then
  echo "✗ pre-push : la branche « $bad » doit s'appeler feat/…, test/…, fix/…, chore/… ou docs/…"
  exit 1
fi

echo "▸ pre-push : contrôle des types (api + web)"
npm run typecheck --silent

if [ "$full" = 0 ]; then
  echo "✓ pre-push (léger) : types OK. Les tests complets tournent avant un push vers main ou staging."
  exit 0
fi

echo "▸ pre-push (main/staging) : tests unitaires du web"
npm --prefix web test --silent

# La base de test écoute sur le port 54329 (scripts/db-local.sh start).
if ! (echo > /dev/tcp/127.0.0.1/54329) 2>/dev/null; then
  echo "✗ pre-push (main/staging) : base de test injoignable. Lancez « scripts/db-local.sh start » puis réessayez."
  exit 1
fi
echo "▸ pre-push (main/staging) : tests de l'API"
npm --prefix api test --silent
echo "✓ pre-push (main/staging) : tout est vert."
