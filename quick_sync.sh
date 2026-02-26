#!/usr/bin/env bash

set -Eeuo pipefail

SERVER_IP="111.229.124.138"
SERVER_USER="root"
DB_CONTAINER="srm-db"
DB_NAME="superresumemaster"
DB_PASSWORD="Longkou7~!"
REMOTE_PATH="/www/wwwroot/ResumeMaster/mysql_prod_dump_server.sql"
LOCAL_FILE="mysql_prod_dump_server.sql"
SSH_PASS="Longkou7~"

echo "🚀 开始同步数据库..."
echo "📡 服务器: $SERVER_IP"

if [[ ! -f "$LOCAL_FILE" ]]; then
    echo "❌ 本地文件不存在: $LOCAL_FILE"
    exit 1
fi

echo "📤 上传文件到服务器..."
sshpass -p "$SSH_PASS" scp "$LOCAL_FILE" "$SERVER_USER@$SERVER_IP:$REMOTE_PATH"

if [[ $? -ne 0 ]]; then
    echo "❌ 上传失败"
    exit 1
fi

echo "📦 复制到 Docker 容器..."
sshpass -p "$SSH_PASS" ssh "$SERVER_USER@$SERVER_IP" \
    "docker cp $REMOTE_PATH $DB_CONTAINER:/tmp/dump.sql"

echo "🔧 在容器内分割并执行..."
sshpass -p "$SSH_PASS" ssh "$SERVER_USER@$SERVER_IP" << 'SCRIPT'
    set -e
    CONTAINER="srm-db"
    DB="superresumemaster"
    PASS="Longkou7~!"
    
    # 分割文件
    mkdir -p /tmp/sql_parts
    split -l 500 /tmp/dump.sql /tmp/sql_parts/part_
    
    PART_COUNT=$(ls /tmp/sql_parts/part_* 2>/dev/null | wc -l)
    echo "   分割为 $PART_COUNT 个部分"
    
    FAILED=0
    for part in /tmp/sql_parts/part_*; do
        PART_NUM=$(basename "$part")
        echo -n "   执行 $PART_NUM... "
        if docker exec -i "$CONTAINER" mysql -u root -p"$PASS" "$DB" < "$part" 2>/dev/null; then
            echo "✓"
        else
            echo "✗"
            FAILED=$((FAILED + 1))
        fi
    done
    
    rm -rf /tmp/sql_parts /tmp/dump.sql
    
    if [[ $FAILED -gt 0 ]]; then
        echo "⚠️  $FAILED 个部分失败"
        exit 1
    fi
    
    echo "   ✓ 全部完成"
SCRIPT

if [[ $? -eq 0 ]]; then
    echo "✅ 数据库同步成功！"
    echo ""
    echo "💡 下一步:"
    echo "   1. docker restart srm-app"
    echo "   2. docker logs srm-app --tail 30"
else
    echo "❌ 数据库同步失败"
    exit 1
fi
