#!/usr/bin/env bash
set -euo pipefail

# Charger les variables depuis .env
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

FILE="${1:-}" # chemin local ou s3://.../file.tar.gz

if [ -z "$FILE" ]; then
  echo "❌ Usage: ./restore.sh <backup-file.tar.gz | s3://bucket/file.tar.gz>"
  exit 1
fi

# Si le fichier vient de S3 → téléchargement
if [[ "$FILE" =~ ^s3:// ]]; then
  echo "📥 Téléchargement depuis S3: $FILE"
  aws s3 cp "$FILE" /tmp/restore.tar.gz
  FILE="/tmp/restore.tar.gz"
fi

TMP="/tmp/mongo_restore"
mkdir -p "$TMP"

echo "📂 Extraction de l’archive..."
tar -xzf "$FILE" -C "$TMP"

# Cherche le dump dans l’archive
ARCHIVE=$(find "$TMP" -type f -name "dump.archive" -print -quit)

if [ -z "$ARCHIVE" ]; then
  echo "❌ Aucun fichier dump.archive trouvé dans $FILE"
  exit 1
fi

echo "♻️ Restauration dans MongoDB ($MONGO_URI)..."
mongorestore --uri="$MONGO_URI" --archive="$ARCHIVE" --gzip --drop

echo "✅ Restore complete"
