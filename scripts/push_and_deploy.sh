#!/bin/bash

# =================================================================
# 标准版：本地构建并推送到 Docker Hub
# =================================================================

IMAGE_NAME="letuyang/super-resume-master:latest"

echo "🚀 [Local] 开始构建 linux/arm64 镜像并推送到 Docker Hub..."
# 使用 buildx 同时构建并推送
docker buildx build --platform linux/arm64 -t "${IMAGE_NAME}" . --push

if [ $? -eq 0 ]; then
    echo "✅ [Local] 镜像推送成功！"
    echo "   下一步请在服务器上运行: docker pull ${IMAGE_NAME} && docker-compose -f docker-compose.prod.yml up -d"
else
    echo "❌ [Local] 推送失败。请确保已运行 'docker login'。"
    exit 1
fi

echo "🚀 [Local] 同步代码到 GitHub..."
git add .
git commit -m "chore: update for deployment"
git push origin main
