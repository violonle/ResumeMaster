#!/bin/bash

# 配置变量
IMAGE_NAME="letuyang/super-resume-master"
SERVER_IP="111.229.124.138"
SERVER_USER="root"
PROJECT_PATH="/www/wwwroot/ResumeMaster"

echo "开始执行部署流程..."

# 1. 同步代码到 GitHub
echo ">>> 正在同步代码到 GitHub..."
git add .
git commit -m "deploy: update features at $(date +'%Y-%m-%d %H:%M:%S')"
git push origin main

# 2. 本地构建镜像
echo ">>> 正在本地构建镜像 (linux/amd64)..."
docker buildx build --platform linux/amd64 -t $IMAGE_NAME:latest . --load

# 3. 核心步骤：通过 SSH 直接将镜像“灌”入服务器
# 这种方式不经过 Docker Hub，直接通过 SSH 加密隧道传输，100% 成功
echo ">>> 正在通过 SSH 将镜像直接传输到服务器 (这可能需要 1-2 分钟)..."
docker save $IMAGE_NAME:latest | ssh $SERVER_USER@$SERVER_IP "docker load"

# 4. 服务器端重启
echo ">>> 正在远程重启服务器容器 (强制重新创建)..."
ssh $SERVER_USER@$SERVER_IP "cd $PROJECT_PATH && docker-compose -f docker-compose.prod.yml up -d --force-recreate"

echo "✅ 部署完成！"