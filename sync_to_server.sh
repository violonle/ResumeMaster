#!/bin/bash

# 配置信息
SERVER_IP="111.229.124.138"
CONTAINER_NAME="srm-app"

echo "🚀 正在执行极速增量同步 (免 Docker 构建)..."

# 1. 同步前端关键文件 (立即生效)
echo "📄 同步前端资源..."
scp js/header-profile.js root@$SERVER_IP:/tmp/
ssh root@$SERVER_IP "docker cp /tmp/header-profile.js $CONTAINER_NAME:/app/js/header-profile.js"

scp pages/librarypool.html root@$SERVER_IP:/tmp/
ssh root@$SERVER_IP "docker cp /tmp/librarypool.html $CONTAINER_NAME:/app/pages/librarypool.html"

# 2. 同步后端逻辑 (需要重启容器)
echo "⚙️ 同步后端逻辑..."
scp backend/controllers/recruitmentController.js root@$SERVER_IP:/tmp/
ssh root@$SERVER_IP "docker cp /tmp/recruitmentController.js $CONTAINER_NAME:/app/backend/controllers/recruitmentController.js"

scp backend/routes/recruitment.js root@$SERVER_IP:/tmp/
ssh root@$SERVER_IP "docker cp /tmp/recruitment.js $CONTAINER_NAME:/app/backend/routes/recruitment.js"

echo "🔄 正在重启服务器容器以应用更改..."
ssh root@$SERVER_IP "docker restart $CONTAINER_NAME"

echo "✨ 同步完成！请刷新浏览器验证修复效果。"
