#!/usr/bin/env bash
# Sauvegarde PostgreSQL (format custom, compressé). Usage : scripts/ops/backup.sh [dossier]
# Chiffrement : si BACKUP_GPG_RECIPIENT est défini, le fichier est chiffré avec gpg.
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL requis}"
DIR="${1:-./backups}"
mkdir -p "$DIR"
FILE="$DIR/cartes-$(date -u +%Y%m%dT%H%M%SZ).dump"
pg_dump --format=custom --no-owner --no-privileges "$DATABASE_URL" > "$FILE"
if [ -n "${BACKUP_GPG_RECIPIENT:-}" ]; then
  gpg --batch --yes --encrypt --recipient "$BACKUP_GPG_RECIPIENT" "$FILE" && rm "$FILE" && FILE="$FILE.gpg"
fi
echo "$FILE"
