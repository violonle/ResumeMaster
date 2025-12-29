# SuperResumeMaster 专业版部署指南 (Build-Push-Pull)

这是目前最稳定、最“彻底”的 Docker 部署方式，旨在解决直接在服务器上构建镜像时出现的内存不足、速度慢、环境不一致等报错问题。

## 核心逻辑
1.  **本地构建**: 在性能更强的本地机器（或 CI/CD）上完成镜像构建。
2.  **镜像推送**: 将构建好的镜像推送到 Docker 镜像仓库（如 Docker Hub、阿里云镜像仓库）。
3.  **服务器拉取**: 服务器只负责“拉取镜像”和“运行容器”，不涉及任何源码编译。

---

## 1. 准备工作

### 1.1 准备镜像仓库
*   注册 [Docker Hub](https://hub.docker.com/) 账号（或使用阿里云/腾讯云容器镜像服务）。
*   在本地登录：`docker login`。

### 1.2 准备服务器环境
*   确保服务器已安装 Docker 和 Docker Compose。
*   将项目中的 `docker-compose.prod.yml` 和 `.env` 上传到服务器的部署目录（如 `/www/wwwroot/SuperResumeMaster`）。

---

## 2. 部署步骤

### 2.1 修改部署脚本
打开 `scripts/deploy.sh`，修改以下变量：
*   `IMAGE_NAME`: 你的镜像仓库地址（如 `username/super-resume-master`）。
*   `SERVER_IP`: 服务器公网 IP。
*   `SERVER_USER`: 服务器 SSH 用户名（通常是 `root`）。
*   `PROJECT_PATH`: 服务器上的部署路径。

### 2.2 执行一键部署
在项目根目录下执行：
```bash
./scripts/deploy.sh
```

---

## 3. 为什么这种方式更彻底？

1.  **解决架构冲突**: 使用 `docker buildx --platform linux/amd64` 确保在 Mac M1/M2 (ARM) 上构建的镜像能在 Linux (x86) 服务器上完美运行。
2.  **降低服务器负担**: 服务器不再需要安装 Node.js、编译依赖，避免了因 CPU/内存占满导致的宕机或报错。
3.  **环境完全一致**: 镜像在本地测试过什么样，在服务器上就是什么样，消除了“本地能跑，服务器报错”的情况。
4.  **快速回滚**: 每次部署都会生成带时间戳的 Tag，如果新版本有问题，只需修改 `docker-compose.prod.yml` 中的镜像版本即可快速回滚。

---

## 4. 常见问题 (Troubleshooting)

### 4.1 `buildx` 未安装
如果提示 `docker: 'buildx' is not a docker command`，请升级 Docker Desktop 到最新版本。

### 4.2 SSH 连接失败
请确保你已配置 SSH 免密登录（`ssh-copy-id root@your-server-ip`），否则脚本执行到远程命令阶段会提示输入密码或失败。

### 4.3 数据库迁移
本项目的 `Dockerfile` 启动命令中包含 `npm run db:init`。如果你的更新涉及数据库表结构变更，请确保后端代码有相应的 Migration 逻辑。
