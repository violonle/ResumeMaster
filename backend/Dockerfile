FROM node:18-alpine

WORKDIR /app

# 安装必要的构建工具（如果某些依赖需要编译）
RUN apk add --no-cache python3 make g++

# 复制 package.json 和 lock 文件
COPY package*.json ./

# 安装依赖
RUN npm install --production

# 复制后端代码
COPY . .

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["npm", "start"]
