#!/bin/bash

# =================================================================
# SuperResumeMaster 自动化部署脚本 (linux/arm64)
# =================================================================

# 1. 提交并推送代码到 Git
echo "Step 1: Pushing code to Git..."
git add .
git commit -m "feat: add email configuration and optimize system settings menu"
git push origin main

if [ $? -ne 0 ]; then
    echo "❌ Git push failed. Please check your network or credentials."
    # exit 1 # 继续执行后续步骤，因为用户可能已经手动推过或者只是想推 Docker
fi

# 2. 构建并推送 Docker 镜像 (linux/arm64)
echo "Step 2: Building and pushing Docker image (linux/arm64)..."
# 确保使用了 buildx
docker buildx build --platform linux/arm64 -t letuyang/super-resume-master:latest --push .

if [ $? -ne 0 ]; then
    echo "❌ Docker build/push failed. Please ensure you are logged in to Docker Hub (docker login)."
    exit 1
fi

# 3. 在服务器上拉取镜像并重启容器
echo "Step 3: Deploying to server..."
SERVER_IP="111.229.124.138"
SERVER_USER="root"
PROJECT_PATH="/www/wwwroot/ResumeMaster"

ssh ${SERVER_USER}@${SERVER_IP} "cd ${PROJECT_PATH} && docker-compose pull && docker-compose up -d"

if [ $? -eq 0 ]; then
    echo "✅ Deployment successful!"
else
    echo "❌ Server deployment failed."
    exit 1
fi
