FROM node:18-alpine

# 设置为生产环境
ENV NODE_ENV=production

WORKDIR /app

# 安装必要的构建工具和运行时依赖
# 添加 postgresql-client 以便在容器内进行数据库检查（可选）
RUN apk add --no-cache python3 make g++ postgresql-client mariadb-client

# 复制 package.json 和 lock 文件
COPY package*.json ./

# 安装依赖 (仅生产环境依赖)
# 注意：由于 sqlite3 已移至 devDependencies，这里不会安装它
RUN npm install --omit=dev

# 复制后端代码
COPY . .

# 创建上传目录并设置权限
RUN mkdir -p uploads/resumes uploads/avatars && \
    chmod -R 755 uploads

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["npm", "start"]
