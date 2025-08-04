#!/bin/bash

# Database Restore Script
# This script restores PostgreSQL database from backup

set -e  # Exit on error

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups}"
DATABASE_URL="${DATABASE_URL}"
S3_BUCKET="${S3_BUCKET}"
S3_ENDPOINT="${S3_ENDPOINT}"

# Check if backup file is provided
if [ -z "$1" ]; then
    echo "Usage: $0 <backup_file_or_name>"
    echo "Example: $0 backup_20240101_120000.sql.gz"
    echo ""
    echo "Available local backups:"
    ls -la "$BACKUP_DIR"/*.sql.gz 2>/dev/null || echo "No local backups found"
    
    if [ ! -z "$S3_BUCKET" ]; then
        echo ""
        echo "Available S3 backups:"
        aws s3 ls "s3://${S3_BUCKET}/backups/" | grep ".sql.gz$"
    fi
    exit 1
fi

BACKUP_NAME="$1"

# Parse database URL
if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL is not set"
    exit 1
fi

# Extract connection details
DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

export PGPASSWORD="$DB_PASS"

# Determine backup file path
if [ -f "$BACKUP_NAME" ]; then
    # Full path provided
    BACKUP_FILE="$BACKUP_NAME"
elif [ -f "$BACKUP_DIR/$BACKUP_NAME" ]; then
    # File in backup directory
    BACKUP_FILE="$BACKUP_DIR/$BACKUP_NAME"
else
    # Try to download from S3
    if [ ! -z "$S3_BUCKET" ]; then
        echo "Backup not found locally, checking S3..."
        
        # Configure AWS CLI if endpoint is specified
        if [ ! -z "$S3_ENDPOINT" ]; then
            aws configure set default.s3.endpoint_url "$S3_ENDPOINT"
        fi
        
        # Download from S3
        BACKUP_FILE="$BACKUP_DIR/$BACKUP_NAME"
        echo "Downloading from S3: s3://$S3_BUCKET/backups/$BACKUP_NAME"
        aws s3 cp "s3://$S3_BUCKET/backups/$BACKUP_NAME" "$BACKUP_FILE"
        
        # Download checksum
        if aws s3 ls "s3://$S3_BUCKET/backups/$BACKUP_NAME.sha256" &>/dev/null; then
            aws s3 cp "s3://$S3_BUCKET/backups/$BACKUP_NAME.sha256" "$BACKUP_FILE.sha256"
        fi
    else
        echo "Error: Backup file not found: $BACKUP_NAME"
        exit 1
    fi
fi

echo "Restore process starting at $(date)"
echo "Database: $DB_NAME"
echo "Host: $DB_HOST:$DB_PORT"
echo "Backup file: $BACKUP_FILE"

# Verify checksum if available
if [ -f "$BACKUP_FILE.sha256" ]; then
    echo "Verifying backup integrity..."
    sha256sum -c "$BACKUP_FILE.sha256"
    if [ $? -ne 0 ]; then
        echo "Error: Backup file checksum verification failed"
        exit 1
    fi
    echo "Checksum verified successfully"
fi

# Confirm restore
echo ""
echo "WARNING: This will restore the database from backup."
echo "All current data will be replaced!"
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled"
    exit 0
fi

# Create backup of current database before restore
if [ "$SKIP_CURRENT_BACKUP" != "true" ]; then
    echo "Creating backup of current database..."
    CURRENT_BACKUP="$BACKUP_DIR/pre_restore_$(date +%Y%m%d_%H%M%S).sql.gz"
    pg_dump \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --no-owner \
        --no-privileges \
        --verbose \
        | gzip > "$CURRENT_BACKUP" || echo "Warning: Failed to backup current database"
fi

# Restore database
echo "Restoring database from backup..."
gunzip -c "$BACKUP_FILE" | psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --single-transaction \
    --set ON_ERROR_STOP=on

if [ $? -eq 0 ]; then
    echo "Database restored successfully at $(date)"
    
    # Send notification (optional)
    if [ ! -z "$WEBHOOK_URL" ]; then
        curl -X POST "$WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{\"text\": \"Database restored successfully from: ${BACKUP_NAME}\"}"
    fi
else
    echo "Error: Database restore failed"
    exit 1
fi