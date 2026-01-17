# 使用 Buildkit 提供的 ARG
ARG TARGETPLATFORM
ARG BUILDPLATFORM

# --- Stage 1: Build Admin ---
FROM --platform=$BUILDPLATFORM node:20-alpine AS admin-builder
RUN apk add --no-cache python3 make g++
WORKDIR /app/admin
COPY admin/package*.json ./
RUN npm install --ignore-scripts
COPY admin/ .
RUN npm run build:icons
RUN npm run build

# --- Stage 2: Build Tika DocParser ---
FROM --platform=$BUILDPLATFORM maven:3.9-eclipse-temurin-17 AS tika-builder
WORKDIR /app/tika
COPY backend/docparser/pom.xml .
COPY backend/docparser/src ./src
RUN mvn clean package -DskipTests && \
    mv target/docparser-1.0-SNAPSHOT.jar target/docparser.jar

# --- Stage 3: Build Interview ---
FROM --platform=$BUILDPLATFORM node:20-alpine AS interview-builder
WORKDIR /app
COPY pages/Interview/package*.json ./
RUN npm install
# 按照用户要求，将 client-api 放在 /client-api，依赖在 /app/node_modules
COPY client-api/ /client-api/
# 修复构建依赖：复制 js 和 css 目录到容器根路径，满足 vite alias 解析
COPY js/ /js/
COPY css/ /css/

COPY pages/Interview/ .
# 创建软链接，确保 /client-api/request.ts 能找到 /app/node_modules
RUN ln -s /app/node_modules /node_modules
RUN npm run build

# --- Stage 4: Final Image ---
FROM --platform=$TARGETPLATFORM node:20-alpine
WORKDIR /app

# 安装运行时环境
RUN apk add --no-cache python3 make g++ py3-setuptools openjdk17-jre

# 1. 复制并安装后端依赖
COPY backend/package*.json ./backend/
RUN cd backend && npm install --production

# 2. 复制后端核心代码
COPY backend/ ./backend/

# 3. 复制前端基础静态资源
COPY css/ ./css/
COPY js/ ./js/
COPY public/ ./public/
COPY components/ ./components/
COPY index.html ./
COPY pages/ ./pages/

# 4. 强制覆盖构建产物 (确保最新的覆盖旧的)
COPY --from=admin-builder /app/admin/dist ./admin/dist
# 将 JAR 包复制到 tikaService 期望的路径
COPY --from=tika-builder /app/tika/target/docparser.jar ./backend/docparser/docparser.jar
COPY --from=interview-builder /app/dist ./pages/Interview/dist

# 5. 设置权限
RUN mkdir -p backend/uploads && \
    chmod -R 755 pages/Interview/dist && \
    chmod +x backend/docparser/docparser.jar

WORKDIR /app/backend
EXPOSE 3000

# 环境变量
ENV NODE_ENV=production
ENV TIKA_JAR_PATH=/app/backend/docparser/docparser.jar

# 启动命令：增加自检
CMD ["sh", "-c", "echo '--- 启动前自检 ---' && \
    ls -l server.js && \
    ls -l docparser/docparser.jar || echo '警告: Tika JAR 缺失' && \
    ls -l ../pages/Interview/dist/index.html || echo '警告: AI面试页面缺失' && \
    echo '--- 启动应用 ---' && \
    node server.js"]
