#!/bin/bash

# =================================================================
# SuperResumeMaster 自动化部署脚本 (Build-Push-Pull 模式)
# =================================================================

# 配置项 (请根据实际情况修改)
# Docker Hub 格式: [你的用户名]/[仓库名]
IMAGE_NAME="letuyang/super-resume-master"
TAG=$(date +%Y%m%d%H%M%S)
LATEST_TAG="latest"
SERVER_IP="111.229.124.138"
SERVER_USER="root"
PROJECT_PATH="/www/wwwroot/ResumeMaster"

echo "🚀 开始部署流程..."

# 1. 本地构建镜像 (支持多平台，解决 Mac M1/M2 与服务器架构不一致问题)
echo "📦 正在构建 Docker 镜像 (linux/amd64)..."
docker buildx build --platform linux/amd64 -t $IMAGE_NAME:$TAG -t $IMAGE_NAME:$LATEST_TAG . --push

if [ $? -ne 0 ]; then
    echo "❌ 镜像构建或推送失败，请检查 Docker 登录状态或网络。"
    exit 1
fi

echo "✅ 镜像已推送到仓库: $IMAGE_NAME:$TAG"

# 2. 远程服务器更新
echo "🌐 正在连接远程服务器进行更新..."

ssh $SERVER_USER@$SERVER_IP << EOF
    cd $PROJECT_PATH
    
    # 拉取最新镜像
    echo "📥 拉取最新镜像..."
    docker pull $IMAGE_NAME:$LATEST_TAG
    
    # 使用生产环境配置重启
    echo "🔄 重启容器..."
    # 建议使用 docker-compose.prod.yml
    DOCKER_IMAGE=$IMAGE_NAME:$LATEST_TAG docker-compose -f docker-compose.prod.yml up -d
    
    # 清理旧镜像 (可选)
    echo "🧹 清理过期的镜像..."
    docker image prune -f
    
    echo "🎉 服务器更新完成！"
EOF

echo "✨ 所有部署步骤已完成！"
