#!/bin/bash

# Configuration
IMAGE_NAME="letuyang/super-resume-master"
TAG="latest"
FULL_IMAGE_NAME="$IMAGE_NAME:$TAG"

echo "🚀 Step 1: 正在构建适配服务器架构 (Linux AMD64) 的镜像..."

# 确保 buildx 已启用并尝试更新 builder 配置
docker buildx use default || docker buildx create --use --name mybuilder

# 构建并直接推送到云端仓库
# 使用 --platform linux/amd64 确保在服务器上能跑
# 使用 --push 直接推送到 Docker Hub
echo "📦 正在构建并推送 $FULL_IMAGE_NAME..."
echo "💡 如果此步卡住或报错 EOF，说明镜像站也失效了，请联系我更换镜像源。"

export DOCKER_BUILDKIT=1
docker buildx build \
  --platform linux/amd64 \
  -t "$FULL_IMAGE_NAME" \
  --build-arg DOCKER_MIRROR="docker.m.daocloud.io" \
  --push \
  --progress=plain \
  .

if [ $? -eq 0 ]; then
    echo "✅ 镜像构建并推送成功！"
    echo "------------------------------------------------"
    echo "现在请在你的服务器上执行以下命令进行更新："
    echo ""
    echo "  cd /www/wwwroot/ResumeMaster"
    echo "  docker pull $FULL_IMAGE_NAME"
    echo "  docker-compose up -d app"
    echo "  docker image prune -f  # (可选) 清理旧镜像"
    echo "------------------------------------------------"
else
    echo "❌ 镜像构建或推送失败，请检查 Docker Hub 登录状态或网络连接。"
    exit 1
fi
