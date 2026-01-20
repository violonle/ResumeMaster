#!/bin/bash
set -e

# Configuration
IMAGE_NAME="letuyang/super-resume-master"
DB_IMAGE="mysql:8.0"
TAG="direct-$(date +%Y%m%d%H%M%S)"
FULL_IMAGE_NAME="$IMAGE_NAME:$TAG"
SERVER_USER="root"
SERVER_IP="111.229.124.138"
SERVER_PATH="/www/wwwroot/ResumeMaster"
TAR_FILE="deploy_bundle.tar.gz"

echo "🚀 Starting Full Offline Deployment (App + Database)..."
echo "----------------------------------------"
echo "Target App Image: $FULL_IMAGE_NAME"
echo "Target DB Image:  $DB_IMAGE"
echo "Target Server:    $SERVER_IP"
echo "----------------------------------------"

# Check if bundle already exists
if [ -f "$TAR_FILE" ]; then
    echo "⚠️  Found existing deployment bundle: $TAR_FILE"
    read -p "   Do you want to use this existing file and skip build/download? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "⏭️  Skipping build and compression steps..."
        SKIP_BUILD=true
    fi
fi

if [ "$SKIP_BUILD" != "true" ]; then
    # 0. Pull Database Image (to ensure we have it for offline deploy)
    echo "📥 Step 0: Ensuring Database Image ($DB_IMAGE) is available locally..."
    # Try to pull specifically for linux/amd64 to match server architecture
    docker pull --platform linux/amd64 $DB_IMAGE

    # 1. Build App
    echo "🔨 Step 1: Building App image for Linux/AMD64..."
    # Build and load into local Docker daemon
    docker buildx build --platform linux/amd64 -t "$FULL_IMAGE_NAME" -t "$IMAGE_NAME:latest" --load .

    # 2. Save & Compress (Both App and DB)
    echo "💾 Step 2: Saving App and DB images to $TAR_FILE..."
    echo "   This may take a moment..."
    # Save both images into one tarball
    docker save "$FULL_IMAGE_NAME" "$DB_IMAGE" | gzip > "$TAR_FILE"

    FILE_SIZE=$(du -h "$TAR_FILE" | cut -f1)
    echo "✅ Bundle created. Size: $FILE_SIZE"
fi

# 3. Transfer
echo "bw Step 3: Transferring bundle to server (SCP)..."
echo "   This bypasses Docker Hub completely for both App and MySQL."
scp "$TAR_FILE" "$SERVER_USER@$SERVER_IP:$SERVER_PATH/"
scp docker-compose.prod.yml "$SERVER_USER@$SERVER_IP:$SERVER_PATH/"

# 4. Deploy
echo "🚀 Step 4: executing deployment on server..."
ssh "$SERVER_USER@$SERVER_IP" << EOF
    set -e
    cd $SERVER_PATH
    
    echo "   Loading images from bundle..."
    gunzip -c $TAR_FILE | docker load
    
    echo "   Stopping old containers..."
    # Ensure variables are exported for docker-compose
    export IMAGE_TAG=$TAG
    export PORT=3000
    export DB_HOST=db
    export NODE_ENV=production
    
    docker-compose down --remove-orphans || true
    
    echo "   Starting services..."
    # --no-build ensures we don't try to build anything
    # Since we loaded mysql:8.0, it should be found locally
    docker-compose up -d --force-recreate
    
    echo "   Cleaning up archive..."
    rm $TAR_FILE
    
    echo "   Checking container status..."
    sleep 5
    docker ps
    
    echo "✅ Deployment successful!"
EOF

echo "----------------------------------------"
echo "🎉 Full Offline Deployment Completed!"
echo "----------------------------------------"
echo "Cleaning up local bundle..."
rm "$TAR_FILE"
