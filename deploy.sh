#!/bin/bash

#=====================================================
# SuperResumeMaster 生产环境部署脚本
# 用于在宝塔面板 Docker 管理器中执行
#=====================================================

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  SuperResumeMaster 部署脚本${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 配置变量
PROJECT_DIR="/www/wwwroot/ResumeMaster"
# 自动查找最新的镜像文件
IMAGE_FILE=$(ls -t $PROJECT_DIR/super-resume-master-*.tar.gz 2>/dev/null | head -1)
CONTAINER_NAME="srm-app"
DB_CONTAINER_NAME="srm-db"
IMAGE_NAME="super-resume-master:latest"

# 步骤 1: 检查文件
echo -e "${YELLOW}📁 步骤 1: 检查部署文件${NC}"
if [ ! -f "$IMAGE_FILE" ]; then
    echo -e "${RED}❌ 错误: 找不到镜像文件 $IMAGE_FILE${NC}"
    echo "请确保已上传 super-resume-master-latest.tar.gz 到 $PROJECT_DIR"
    exit 1
fi
echo -e "${GREEN}✅ 镜像文件已找到${NC}"
echo ""

# 步骤 2: 停止并删除现有容器
echo -e "${YELLOW}🛑 步骤 2: 清理现有容器${NC}"
echo "停止现有容器..."
docker stop $CONTAINER_NAME $DB_CONTAINER_NAME 2>/dev/null || true
echo "删除现有容器..."
docker rm $CONTAINER_NAME $DB_CONTAINER_NAME 2>/dev/null || true
echo -e "${GREEN}✅ 清理完成${NC}"
echo ""

# 步骤 3: 加载 Docker 镜像
echo -e "${YELLOW}📦 步骤 3: 加载 Docker 镜像${NC}"
echo "正在加载镜像（这可能需要几分钟）..."
gunzip -c $IMAGE_FILE | docker load
echo -e "${GREEN}✅ 镜像加载成功${NC}"
echo ""

# 步骤 4: 创建目录和配置
echo -e "${YELLOW}📁 步骤 4: 创建配置目录${NC}"
mkdir -p $PROJECT_DIR/{uploads,logs}
echo -e "${GREEN}✅ 目录创建完成${NC}"
echo ""

# 步骤 5: 创建环境变量文件
echo -e "${YELLOW}⚙️  步骤 5: 创建环境变量${NC}"
if [ ! -f "$PROJECT_DIR/.env" ]; then
    cat > $PROJECT_DIR/.env << 'EOF'
# 数据库配置
DB_HOST=db
DB_PORT=3306
DB_NAME=superresumemaster
DB_USER=root
DB_PASSWORD=YourStrongPassword123!

# JWT配置
JWT_SECRET=your_production_jwt_secret_key_change_this
JWT_EXPIRES_IN=24h

# 服务器配置
NODE_ENV=production
PORT=3000

# 文件上传配置
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10485760

# 允许的来源
ALLOWED_ORIGINS=*

# AI服务配置（需要手动添加你的API Key）
# SILICONFLOW_API_KEY=
# GLM_API_KEY=
# QWEN_API_KEY=
# DEEPSEEK_API_KEY=
# MODELSCOPE_API_KEY=

# 微信支付配置（可选）
# WECHAT_APP_ID=
# WECHAT_MCH_ID=
# WECHAT_API_KEY=

# 支付宝支付配置（可选）
# ALIPAY_APP_ID=
# ALIPAY_PRIVATE_KEY=
# ALIPAY_PUBLIC_KEY=
EOF
    echo -e "${YELLOW}⚠️  请编辑 .env 文件设置你的配置信息！${NC}"
else
    echo -e "${YELLOW}⚠️  .env 文件已存在，跳过创建${NC}"
fi
echo ""

# 步骤 6: 启动服务
echo -e "${YELLOW}🚀 步骤 6: 启动服务${NC}"
cd $PROJECT_DIR
docker-compose up -d
echo ""

# 步骤 7: 等待服务启动
echo -e "${YELLOW}⏳ 步骤 7: 等待服务启动${NC}"
echo "等待 MySQL 数据库启动..."
for i in {1..30}; do
    if docker exec $DB_CONTAINER_NAME mysqladmin ping -h localhost -u root -p$DB_PASSWORD &>/dev/null; then
        echo -e "${GREEN}✅ MySQL 已就绪${NC}"
        break
    fi
    echo -n "."
    sleep 2
done
echo ""

# 步骤 8: 检查服务状态
echo -e "${YELLOW}🔍 步骤 8: 检查服务状态${NC}"
sleep 5
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

# 步骤 9: 查看日志
echo -e "${YELLOW}📋 步骤 9: 查看应用日志（最近20行）${NC}"
docker logs --tail 20 $CONTAINER_NAME
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  部署完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "🌐 访问地址: http://你的服务器IP:3000"
echo ""
echo "📝 后续操作:"
echo "   1. 访问 http://你的服务器IP:3000 测试网站"
echo "   2. 编辑 .env 文件配置你的 API Key"
echo "   3. 在宝塔面板中配置反向代理（可选）"
echo "   4. 配置域名解析（可选）"
echo ""
echo "🔧 常用命令:"
echo "   查看日志: docker logs -f $CONTAINER_NAME"
echo "   重启服务: docker-compose restart"
echo "   停止服务: docker-compose down"
echo ""
