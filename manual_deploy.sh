#!/bin/bash
set -e

# Configuration
IMAGE_NAME="letuyang/super-resume-master"
TAG="manual-$(date +%Y%m%d%H%M%S)"
FULL_IMAGE_NAME="$IMAGE_NAME:$TAG"
SERVER_USER="root"
SERVER_IP="111.229.124.138"
SERVER_PATH="/www/wwwroot/ResumeMaster"

echo "🚀 Starting Manual Deployment Process..."
echo "----------------------------------------"
echo "Target Image: $FULL_IMAGE_NAME"
echo "Target Server: $SERVER_IP"
echo "----------------------------------------"

# 1. Build and Push Image
echo "📦 Step 1: Building and Pushing Docker Image (linux/amd64)..."
# Skip login check as it can be flaky with credential helpers
# if ! docker system info | grep -q "Username"; then
#     echo "⚠️  You are not logged into Docker Hub."
#     echo "Please run 'docker login' first."
#     exit 1
# fi

docker buildx build --platform linux/amd64 -t "$FULL_IMAGE_NAME" -t "$IMAGE_NAME:latest" --load .

echo "✅ Image built successfully. Starting push..."
docker push "$FULL_IMAGE_NAME"
docker push "$IMAGE_NAME:latest"

echo "✅ Image built and pushed successfully."

# 2. Prepare Server Environment
echo "📂 Step 2: Preparing Server Configuration..."

# Upload docker-compose.prod.yml
echo "   Uploading docker-compose.prod.yml..."
scp docker-compose.prod.yml "$SERVER_USER@$SERVER_IP:$SERVER_PATH/"

# 3. Deploy on Server
echo "🚀 Step 3: Executing Deployment on Server..."
ssh "$SERVER_USER@$SERVER_IP" << EOF
    set -e
    cd $SERVER_PATH
    
    echo "   Stopping old containers..."
    docker-compose down --remove-orphans || true
    
    echo "   Pruning old images..."
    docker image prune -f -a || true
    
    echo "   Pulling new image: $FULL_IMAGE_NAME"
    docker pull $FULL_IMAGE_NAME
    
    echo "   Starting service..."
    # Explicitly set the IMAGE_TAG env var for docker-compose
    export IMAGE_TAG=$TAG
    # Also ensure basic env vars are present if .env is missing
    export PORT=3000
    export DB_HOST=db
    export NODE_ENV=production
    
    docker-compose up -d --force-recreate
    
    echo "   Checking container status..."
    sleep 5
    docker ps | grep super-resume-master
    
    echo "✅ Deployment commands executed."
EOF

echo "----------------------------------------"
echo "🎉 Deployment Completed!"
echo "----------------------------------------"
echo "Please verify the application at: http://$SERVER_IP:3000 (or your domain)"
echo "You can check logs with: ssh $SERVER_USER@$SERVER_IP 'docker logs -f super-resume-master'"
