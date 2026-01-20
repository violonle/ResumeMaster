#!/bin/bash

# =================================================================
# 增量同步脚本：将本地修改的代码直接同步到服务器 Docker 容器中
# 适用场景：修复 Bug、调整样式，无需重新构建庞大的 Docker 镜像
# =================================================================

# --- 配置信息 ---
SERVER_USER="root"
SERVER_IP="111.229.124.138"
SERVER_PATH="/www/wwwroot/ResumeMaster"
CONTAINER_NAME="super-resume-master"
TMP_TAR="update_patch.tar.gz"

echo "🔍 正在打包修改的文件..."

# 1. 打包所有已修改的关键文件
# 包含：前端页面、布局、JS 逻辑、后端控制器和路由
tar -czf $TMP_TAR \
    pages/*.html \
    layouts/*.html \
    js/header-profile.js \
    backend/controllers/recruitmentController.js \
    backend/routes/recruitment.js

if [ $? -ne 0 ]; then
    echo "❌ 打包失败，请检查文件路径是否存在。"
    exit 1
fi

echo "🚀 正在发送补丁到服务器 $SERVER_IP..."

# 2. 发送压缩包到服务器临时目录
scp $TMP_TAR $SERVER_USER@$SERVER_IP:/tmp/

if [ $? -ne 0 ]; then
    echo "❌ 发送失败，请检查网络连接或 SSH 权限。"
    rm $TMP_TAR
    exit 1
fi

echo "📦 正在应用补丁到 Docker 容器 ($CONTAINER_NAME)..."

# 3. 在服务器上执行：将补丁拷贝进容器 -> 解压覆盖 -> 重启容器
ssh $SERVER_USER@$SERVER_IP << EOF
    # 将文件从宿主机拷贝到容器内
    docker cp /tmp/$TMP_TAR $CONTAINER_NAME:/app/
    
    # 在容器内解压并覆盖
    docker exec -u root $CONTAINER_NAME bash -c "tar -xzf /app/$TMP_TAR -C /app/ && rm /app/$TMP_TAR"
    
    # 重启容器以使后端代码生效
    echo "🔄 正在重启容器以应用后端更改..."
    docker restart $CONTAINER_NAME
    
    # 清理服务器临时文件
    rm /tmp/$TMP_TAR
    
    echo "✅ 服务器端处理完成！"
EOF

# 4. 清理本地临时文件
rm $TMP_TAR

echo "------------------------------------------------"
echo "🎉 增量同步成功！请刷新浏览器查看效果。"
echo "------------------------------------------------"
