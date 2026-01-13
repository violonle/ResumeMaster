#!/bin/bash

# =================================================================
# SuperResumeMaster 稳定部署脚本
# 功能：本地构建 -> 压缩传输 -> 远程加载 -> 平滑重启
# =================================================================

# --- 配置区 ---
IMAGE_NAME="letuyang/super-resume-master"
TAG=$(date +%Y%m%d_%H%M%S)
FULL_IMAGE="${IMAGE_NAME}:${TAG}"
LATEST_IMAGE="${IMAGE_NAME}:latest"

SERVER_IP="111.229.124.138"
SERVER_USER="root"
PROJECT_PATH="/www/wwwroot/ResumeMaster"

# --- 逻辑区 ---
set -e # 遇到错误立即停止

echo "🚀 开始稳妥部署流程 [版本: ${TAG}]"

# 0. 检查 Docker 守护进程是否运行
echo "🔍 Step 0: 检查 Docker 运行状态..."
if ! docker info > /dev/null 2>&1; then
    echo "❌ 错误: 无法连接到 Docker 守护进程。"
    echo "💡 请确保您的 Docker Desktop 已经启动并运行。"
    exit 1
fi

# 1. 本地构建 (确保平台一致性)
echo "📦 Step 1: 正在本地构建镜像 (linux/amd64)..."
docker buildx build --platform linux/amd64 -t "${FULL_IMAGE}" -t "${LATEST_IMAGE}" . --load

# 2. 导出并压缩
echo "🚚 Step 2: 正在导出并压缩镜像..."
docker save "${FULL_IMAGE}" | gzip > image_tmp.tar.gz

# 3. 传输到服务器
echo "📤 Step 3: 正在将镜像传输到服务器 (通过 SSH 隧道)..."
scp image_tmp.tar.gz ${SERVER_USER}@${SERVER_IP}:${PROJECT_PATH}/

# 4. 远程加载镜像
echo "📥 Step 4: 正在远程加载镜像并清理临时文件..."
ssh ${SERVER_USER}@${SERVER_IP} << EOF
    cd ${PROJECT_PATH}
    gunzip -c image_tmp.tar.gz | docker load
    rm image_tmp.tar.gz
    
    # 关键：更新 latest 标签指向新加载的镜像
    echo "🏷️ 更新 latest 标签..."
    docker tag ${FULL_IMAGE} ${LATEST_IMAGE}
    
    echo "🔄 正在重启服务..."
    docker-compose -f docker-compose.prod.yml up -d --force-recreate
    
    echo "🧹 清理服务器旧镜像..."
    docker image prune -f
EOF

# 5. 清理本地临时文件
echo "🧹 Step 5: 清理本地构建缓存和临时文件..."
rm image_tmp.tar.gz

echo "✅ 部署完成！"
echo "🔗 访问地址: http://${SERVER_IP}:3000"
echo "💡 提示: 如果这是第一次部署，请确保服务器上已有 docker-compose.prod.yml 和 .env 文件。"
