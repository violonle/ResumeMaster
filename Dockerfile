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

# --- Stage 2: Build Java DocParser ---
FROM maven:3.9.6-eclipse-temurin-17-alpine AS java-builder
WORKDIR /app/docparser
COPY backend/docparser/pom.xml .
COPY backend/docparser/src ./src
RUN mvn clean package -DskipTests

# --- Stage 3: Final Image ---
FROM node:20-alpine
WORKDIR /app

# 设置环境变量
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=true

# 安装运行后端所需的系统库
# 增加 openjdk17-jre 用于运行 Tika 解析组件
RUN apk add --no-cache python3 make g++ py3-setuptools openjdk17-jre

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

# 4. 从编译阶段复制编译后的文件
COPY --from=admin-builder /app/admin/dist ./admin/dist
COPY --from=java-builder /app/docparser/target/docparser-1.0-SNAPSHOT.jar ./backend/docparser/target/docparser-1.0-SNAPSHOT.jar

# 5. 设置权限
RUN mkdir -p backend/uploads

WORKDIR /app/backend
EXPOSE 3000

# 启动命令
# 生产环境下如果数据库已初始化，可以跳过 npm run db:init 以避免 ER_TOO_MANY_KEYS 错误
CMD ["sh", "-c", "npm start"]
