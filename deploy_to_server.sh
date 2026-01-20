#!/bin/bash

# =================================================================
# 一键部署脚本：本地构建镜像 -> 打包压缩 -> 上传服务器 -> 部署启动
# =================================================================

set -e

# --- 配置信息 ---
IMAGE_NAME="letuyang/super-resume-master"
TAG="v$(date +%Y%m%d_%H%M%S)"
FULL_IMAGE_NAME="$IMAGE_NAME:$TAG"
SERVER_USER="root"
SERVER_IP="111.229.124.138"
SERVER_PATH="/www/wwwroot/ResumeMaster"
TAR_FILE="deploy_image.tar.gz"

echo "------------------------------------------------"
echo "🚀 开始一键构建与部署流程"
echo "镜像名称: $FULL_IMAGE_NAME"
echo "目标服务器: $SERVER_IP"
echo "------------------------------------------------"

# 1. 本地构建镜像 (针对 Linux AMD64 架构，确保服务器兼容性)
echo "🔨 Step 1: 正在本地构建 Docker 镜像 (AMD64)..."
# 使用 DOCKER_BUILDKIT=1 和 --progress=plain 查看详细日志
export DOCKER_BUILDKIT=1
docker buildx build --platform linux/amd64 -t "$FULL_IMAGE_NAME" -t "$IMAGE_NAME:latest" --load --progress=plain .

# 2. 保存并压缩镜像
echo "💾 Step 2: 正在导出镜像到压缩包..."
docker save "$FULL_IMAGE_NAME" | gzip > "$TAR_FILE"
FILE_SIZE=$(du -h "$TAR_FILE" | cut -f1)
echo "✅ 镜像导出完成，大小: $FILE_SIZE"

# 3. 传输到服务器
echo "📦 Step 3: 正在传输镜像到服务器..."
scp "$TAR_FILE" docker-compose.prod.yml "$SERVER_USER@$SERVER_IP:$SERVER_PATH/"

# 4. 服务器端部署
echo "🚢 Step 4: 正在服务器上启动新版本..."
ssh "$SERVER_USER@$SERVER_IP" << EOF
    cd $SERVER_PATH
    
    echo "   正在加载镜像..."
    gunzip -c $TAR_FILE | docker load
    
    echo "   正在切换容器版本..."
    export IMAGE_TAG=$TAG
    # 使用 docker-compose 强制重新创建容器
    docker-compose -f docker-compose.prod.yml up -d --force-recreate app
    
    echo "   清理旧资源..."
    rm $TAR_FILE
    docker image prune -f
    
    echo "✅ 服务器部署成功！"
EOF

# 5. 清理本地文件
echo "🧹 Step 5: 清理本地临时文件..."
rm "$TAR_FILE"

echo "------------------------------------------------"
echo "🎉 部署完成！"
echo "版本标签: $TAG"
echo "------------------------------------------------"
