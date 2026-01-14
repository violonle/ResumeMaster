#!/bin/bash

# =================================================================
# 服务器端：原生构建与启动脚本 (彻底解决架构不匹配问题)
# =================================================================

SYNC_FILE="srm_source.tar.gz"

echo "🚀 [Server] 开始原生构建流程..."

# 1. 解压源码
if [ -f "$SYNC_FILE" ]; then
    echo "📦 [Server] 发现源码包，正在解压..."
    tar -xzf "$SYNC_FILE"
    rm "$SYNC_FILE"
fi

# 2. 修正 .env
echo "⚙️  [Server] 检查并修正配置..."
[ ! -f .env ] && touch .env

# 强制设置 DB_HOST 为 db (这是 docker-compose 中的服务名)
if grep -q "DB_HOST=" .env; then
    sed -i 's/DB_HOST=.*/DB_HOST=db/' .env
else
    echo "DB_HOST=db" >> .env
fi

# 确保其他必要变量存在
grep -q "DB_NAME=" .env || echo "DB_NAME=superresumemaster" >> .env
grep -q "DB_USER=" .env || echo "DB_USER=root" >> .env
grep -q "DB_PASSWORD=" .env || echo "DB_PASSWORD=YourStrongPassword" >> .env
grep -q "JWT_SECRET=" .env || echo "JWT_SECRET=srm_secret_key_2024" >> .env
grep -q "NODE_ENV=" .env || echo "NODE_ENV=production" >> .env

# 3. 核心：在服务器本地进行 Docker 构建
echo "🏗️  [Server] 正在服务器上直接构建镜像 (确保架构匹配)..."
# 注意：我们现在同时启动 db 和 app
docker-compose -f docker-compose.prod.yml build

# 4. 启动
echo "🔄 [Server] 重启服务..."
docker-compose -f docker-compose.prod.yml up -d --force-recreate

echo "🔎 [Server] 检查日志..."
sleep 3
docker logs --tail 20 super-resume-master

echo "✅ [Server] 部署完成！"
