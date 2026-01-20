#!/bin/bash

# =================================================================
# 一键部署脚本：本地构建镜像 -> 打包压缩 -> 上传服务器 -> 部署启动
# =================================================================

set -e

# --- 配置信息 ---
IMAGE_NAME="letuyang/super-resume-master"
TAG="latest"
FULL_IMAGE_NAME="$IMAGE_NAME:$TAG"
SERVER_USER="root"
SERVER_IP="111.229.124.138"
SERVER_PATH="/root/super-resume-master"
TAR_FILE="deploy_image.tar.gz"

echo "------------------------------------------------"
echo "🚀 开始执行【最稳妥】的离线镜像部署流程"
echo "该方案不依赖 Docker Hub，直接通过 SSH 传输镜像文件"
echo "镜像名称: $FULL_IMAGE_NAME"
echo "目标服务器: $SERVER_IP"
echo "------------------------------------------------"

# 1. 本地构建镜像 (针对 Linux AMD64 架构)
echo "🔨 Step 1: 正在本地构建 Docker 镜像 (AMD64)..."
export DOCKER_BUILDKIT=1
docker buildx build --platform linux/amd64 -t "$FULL_IMAGE_NAME" --load --progress=plain .

# 2. 保存并压缩镜像
echo "💾 Step 2: 正在导出镜像到压缩包 (这可能需要几分钟)..."
docker save "$FULL_IMAGE_NAME" | gzip > "$TAR_FILE"
FILE_SIZE=$(du -h "$TAR_FILE" | cut -f1)
echo "✅ 镜像导出完成，大小: $FILE_SIZE"

# 3. 传输到服务器
echo "📦 Step 3: 正在传输镜像和配置文件到服务器..."
# 确保服务器目录存在
ssh "$SERVER_USER@$SERVER_IP" "mkdir -p $SERVER_PATH"
scp "$TAR_FILE" docker-compose.yml "$SERVER_USER@$SERVER_IP:$SERVER_PATH/"

# 4. 服务器端部署
echo "🚢 Step 4: 正在服务器上加载镜像并启动..."
ssh "$SERVER_USER@$SERVER_IP" << EOF
    cd $SERVER_PATH
    
    echo "   正在停止旧容器..."
    docker-compose down || true
    
    echo "   正在加载镜像 (请稍候)..."
    gunzip -c $TAR_FILE | docker load
    
    echo "   正在启动服务..."
    docker-compose up -d
    
    echo "   清理临时文件..."
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
