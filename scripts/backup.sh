#!/usr/bin/env bash
set -euo pipefail

# config
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M")
BACKUP_DIR="/var/backups/mongodb"
MONGO_URI="${MONGO_URI:-mongodb://localhost:27017/mydb}"
S3_BUCKET="${AWS_S3_BUCKET}"
AWS_REGION="${AWS_REGION:-eu-west-1}"

mkdir -p "$BACKUP_DIR"
TMP="$BACKUP_DIR/dump_$TIMESTAMP"
mkdir -p "$TMP"

echo "Starting mongodump..."
mongodump --uri="$MONGO_URI" --archive="$TMP/dump.archive" --gzip

echo "Archiving..."
tar -czf "$BACKUP_DIR/mongo_backup_$TIMESTAMP.tar.gz" -C "$BACKUP_DIR" "dump_$TIMESTAMP"

echo "Uploading to S3..."
aws s3 cp "$BACKUP_DIR/mongo_backup_$TIMESTAMP.tar.gz" "s3://$S3_BUCKET/mongo_backups/mongo_backup_$TIMESTAMP.tar.gz" --region "$AWS_REGION"

echo "Cleaning local tmp..."
rm -rf "$TMP"

# Optional: prune old backups in S3 (or use lifecycle rules on bucket)
echo "Backup complete: $TIMESTAMP"
