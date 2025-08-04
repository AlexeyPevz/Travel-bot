#!/bin/bash

# Database Backup Script
# This script creates automated backups of PostgreSQL database

set -e  # Exit on error

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
DATABASE_URL="${DATABASE_URL}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="backup_${TIMESTAMP}"

# S3 Configuration (optional)
S3_BUCKET="${S3_BUCKET}"
S3_ENDPOINT="${S3_ENDPOINT}"
AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID}"
AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY}"

# Parse database URL
if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL is not set"
    exit 1
fi

# Extract connection details from DATABASE_URL
# Format: postgresql://username:password@host:port/database
DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "Starting backup at $(date)"
echo "Database: $DB_NAME"
echo "Host: $DB_HOST:$DB_PORT"

# Create backup
export PGPASSWORD="$DB_PASS"
BACKUP_FILE="${BACKUP_DIR}/${BACKUP_NAME}.sql.gz"

echo "Creating backup: $BACKUP_FILE"
pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --no-owner \
    --no-privileges \
    --clean \
    --if-exists \
    --verbose \
    | gzip > "$BACKUP_FILE"

# Verify backup
if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file was not created"
    exit 1
fi

BACKUP_SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
echo "Backup completed: $BACKUP_FILE (Size: $BACKUP_SIZE)"

# Create checksum
CHECKSUM_FILE="${BACKUP_FILE}.sha256"
sha256sum "$BACKUP_FILE" > "$CHECKSUM_FILE"
echo "Checksum created: $CHECKSUM_FILE"

# Upload to S3 (if configured)
if [ ! -z "$S3_BUCKET" ]; then
    echo "Uploading to S3: s3://$S3_BUCKET/backups/${BACKUP_NAME}.sql.gz"
    
    # Configure AWS CLI if endpoint is specified
    if [ ! -z "$S3_ENDPOINT" ]; then
        aws configure set default.s3.endpoint_url "$S3_ENDPOINT"
    fi
    
    # Upload backup
    aws s3 cp "$BACKUP_FILE" "s3://${S3_BUCKET}/backups/${BACKUP_NAME}.sql.gz"
    
    # Upload checksum
    aws s3 cp "$CHECKSUM_FILE" "s3://${S3_BUCKET}/backups/${BACKUP_NAME}.sql.gz.sha256"
    
    echo "S3 upload completed"
fi

# Clean up old local backups
echo "Cleaning up old backups (older than $BACKUP_RETENTION_DAYS days)"
find "$BACKUP_DIR" -name "backup_*.sql.gz" -type f -mtime +$BACKUP_RETENTION_DAYS -delete
find "$BACKUP_DIR" -name "backup_*.sql.gz.sha256" -type f -mtime +$BACKUP_RETENTION_DAYS -delete

# Clean up old S3 backups (if configured)
if [ ! -z "$S3_BUCKET" ]; then
    echo "Cleaning up old S3 backups"
    CUTOFF_DATE=$(date -d "$BACKUP_RETENTION_DAYS days ago" +%Y-%m-%d)
    
    aws s3 ls "s3://${S3_BUCKET}/backups/" | while read -r line; do
        FILE_DATE=$(echo $line | awk '{print $1}')
        FILE_NAME=$(echo $line | awk '{print $4}')
        
        if [[ "$FILE_DATE" < "$CUTOFF_DATE" ]]; then
            echo "Deleting old backup: $FILE_NAME"
            aws s3 rm "s3://${S3_BUCKET}/backups/${FILE_NAME}"
        fi
    done
fi

echo "Backup process completed at $(date)"

# Send notification (optional)
if [ ! -z "$WEBHOOK_URL" ]; then
    curl -X POST "$WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d "{\"text\": \"Database backup completed: ${BACKUP_NAME}.sql.gz (${BACKUP_SIZE})\"}"
fi