#!/usr/bin/env bash
# Restauration dans une base CIBLE (jamais directement en production sans validation).
# Usage : TARGET_DATABASE_URL=postgres://... scripts/ops/restore.sh fichier.dump[.gpg]
set -euo pipefail
: "${TARGET_DATABASE_URL:?TARGET_DATABASE_URL requis}"
FILE="$1"
if [[ "$FILE" == *.gpg ]]; then gpg --batch --decrypt "$FILE" > "${FILE%.gpg}"; FILE="${FILE%.gpg}"; fi
pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$TARGET_DATABASE_URL" "$FILE"
echo "Restauration terminée dans la base cible."
