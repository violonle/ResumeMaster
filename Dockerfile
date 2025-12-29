# --- Stage 1: Build Admin ---
FROM --platform=$BUILDPLATFORM node:20-alpine AS admin-builder

# 为某些依赖安装构建工具
RUN apk add --no-cache python3 make g++

WORKDIR /app/admin

# 先安装依赖 (利用 Docker 缓存)
COPY admin/package*.json ./
# 禁用 postinstall 脚本，避免在依赖安装阶段运行 build:icons（此时源码还没复制进去）
RUN npm install --ignore-scripts

# 复制源代码
COPY admin/ .

# 手动运行 build:icons 和 build
RUN npm run build:icons
RUN npm run build

# --- Stage 2: Final Image ---
FROM node:20-alpine
WORKDIR /app

# 设置环境变量
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=true

# 安装运行后端所需的系统库
# 增加 py3-setuptools 以解决 sqlite3 编译时缺失 distutils 的问题
RUN apk add --no-cache python3 make g++ py3-setuptools

# 1. 复制后端依赖并安装
COPY backend/package*.json ./backend/
RUN cd backend && npm install --production

# 2. 复制后端代码
COPY backend/ ./backend/

# 3. 复制前端静态文件 (主平台)
COPY pages/ ./pages/
COPY css/ ./css/
COPY js/ ./js/
COPY public/ ./public/
COPY components/ ./components/
COPY index.html ./

# 4. 从编译阶段复制 Admin 编译后的文件
COPY --from=admin-builder /app/admin/dist ./admin/dist

# 5. 设置权限
RUN mkdir -p backend/uploads

WORKDIR /app/backend
EXPOSE 3000

# 启动命令
# 增加一个检查，确保数据库迁移或初始化在启动前完成
CMD ["sh", "-c", "npm run db:init && npm start"]
