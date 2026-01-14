#!/bin/bash

# =================================================================
# 兼容版：同步源码脚本 (屏蔽 macOS 扩展属性)
# =================================================================

SERVER_IP="${SERVER_IP:-111.229.124.138}"
SERVER_USER="${SERVER_USER:-root}"
PROJECT_PATH="${PROJECT_PATH:-/www/wwwroot/ResumeMaster}"
SYNC_FILE="srm_source.tar.gz"

echo "🚀 [Local] 正在打包源代码 (已屏蔽 macOS 扩展属性)..."

# 使用 COPYFILE_DISABLE=1 防止 tar 包含 Apple 扩展属性 (解决 LIBARCHIVE 警告)
# 排除所有本地构建产物、node_modules 以及 macOS 产生的 ._ 文件
COPYFILE_DISABLE=1 tar -czf "$SYNC_FILE" \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='dist' \
    --exclude='.DS_Store' \
    --exclude='._*' \
    --exclude='*.tar.gz' \
    --exclude='*.tar' \
    .

echo "📤 [Local] 同步代码到服务器 (请准备输入密码)..."
scp "$SYNC_FILE" docker-compose.prod.yml scripts/server_start.sh "${SERVER_USER}@${SERVER_IP}:${PROJECT_PATH}/"

if [ $? -eq 0 ]; then
    echo "✅ [Local] 同步成功！"
    rm "$SYNC_FILE"
else
    echo "❌ [Local] 同步失败"
    exit 1
fi
