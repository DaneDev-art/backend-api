#!/usr/bin/env bash
set -euo pipefail

# Variables
DATE=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="/backups/mongo_backup_$DATE.archive.gz"
LOG_FILE="/var/log/mongo_backup.log"

# Fonction pour notifier par email (optionnelle)
notify_email() {
  local subject=$1
  local body=$2
  if [[ -n "${EMAIL_RECIPIENT:-}" ]]; then
    echo -e "$body" | mail -s "$subject" "$EMAIL_RECIPIENT"
  fi
}

# Créer le fichier log s'il n'existe pas
touch "$LOG_FILE"

echo "📦 [$(date)] Sauvegarde MongoDB vers $BACKUP_FILE ..." | tee -a "$LOG_FILE"

# Backup MongoDB
if mongodump --uri="$MONGO_URI" --archive="$BACKUP_FILE" --gzip >>"$LOG_FILE" 2>&1; then
  echo "✅ [$(date)] Backup réussi : $BACKUP_FILE" | tee -a "$LOG_FILE"
  notify_email "MongoDB Backup Réussi" "Backup effectué avec succès : $BACKUP_FILE"
else
  echo "❌ [$(date)] Backup échoué !" | tee -a "$LOG_FILE"
  notify_email "MongoDB Backup Échec" "Échec du backup à $(date)"
  exit 1
fi

# Upload vers S3 uniquement si toutes les variables AWS sont définies
if [[ -n "${AWS_S3_BUCKET:-}" && -n "${AWS_ACCESS_KEY_ID:-}" && -n "${AWS_SECRET_ACCESS_KEY:-}" && -n "${AWS_REGION:-}" ]]; then
  S3_PATH="s3://$AWS_S3_BUCKET/$(date +%Y/%m/%d)/mongo_backup_$DATE.archive.gz"
  echo "☁️ [$(date)] Upload vers $S3_PATH ..." | tee -a "$LOG_FILE"
  if aws s3 cp "$BACKUP_FILE" "$S3_PATH" >>"$LOG_FILE" 2>&1; then
    echo "✅ [$(date)] Upload S3 réussi" | tee -a "$LOG_FILE"
    notify_email "MongoDB Backup S3 Réussi" "Upload vers S3 effectué : $S3_PATH"
  else
    echo "❌ [$(date)] Upload S3 échoué !" | tee -a "$LOG_FILE"
    notify_email "MongoDB Backup S3 Échec" "Échec de l’upload S3 à $(date)"
  fi
else
  echo "⚠️ [$(date)] Variables AWS manquantes : upload S3 ignoré" | tee -a "$LOG_FILE"
fi

# Rotation locale : garder uniquement les 7 derniers fichiers
echo "🧹 [$(date)] Rotation des sauvegardes locales (max 7 fichiers) ..." | tee -a "$LOG_FILE"
ls -1t /backups/mongo_backup_*.archive.gz 2>/dev/null | tail -n +8 | xargs -r rm --
echo "✅ [$(date)] Rotation terminée" | tee -a "$LOG_FILE"
