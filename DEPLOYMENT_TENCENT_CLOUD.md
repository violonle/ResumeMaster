# SuperResumeMaster 腾讯云部署指南 (Ubuntu 22.04 LTS)

本指南旨在指导您如何将 SuperResumeMaster 完整系统（后端 API、主平台前端、管理后台）部署在自有的腾讯云服务器（CVM 或轻量应用服务器）上。

---

## 1. 系统环境准备

### 1.1 更新系统包
```bash
sudo apt update && sudo apt upgrade -y
```

### 1.2 安装 Node.js (建议使用 v18 或 v20)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
# 验证安装
node -v
npm -v
```

### 1.3 安装 MySQL 数据库
```bash
sudo apt install mysql-server -y
# 启动并设置开机自启
sudo systemctl start mysql
sudo systemctl enable mysql
```

### 1.4 安装 Nginx 与 PM2
```bash
sudo apt install nginx -y
sudo npm install -g pm2
```

---

## 2. 数据库配置

### 2.1 初始化 MySQL
```bash
sudo mysql
```

在 MySQL 命令行中执行：
```sql
-- 创建数据库
CREATE DATABASE superresumemaster CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 创建用户并授权 (请更换 'YourStrongPassword' 为您的强密码)
CREATE USER 'srm_user'@'localhost' IDENTIFIED BY 'YourStrongPassword';
GRANT ALL PRIVILEGES ON superresumemaster.* TO 'srm_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

---

## 3. 项目上传与依赖安装

### 3.1 上传代码
将项目文件上传至服务器目录（例如 `/var/www/SuperResumeMaster`）。

### 3.2 后端依赖安装与配置
```bash
cd /var/www/SuperResumeMaster/backend
npm install

# 创建并编辑环境变量文件
cp .env.example .env
nano .env
```
在 `.env` 中修改以下关键项：
- `DB_HOST=localhost`
- `DB_NAME=superresumemaster`
- `DB_USER=srm_user`
- `DB_PASSWORD=YourStrongPassword`
- `JWT_SECRET=随便写一段长字符串`
- `NODE_ENV=production`
- `PORT=3000`

### 3.3 初始化数据库表
```bash
node scripts/init-db.js
# (可选) 填充演示数据
node scripts/seed-demo.js
```

### 3.4 启动后端服务
```bash
pm2 start server.js --name "srm-backend"
pm2 save
pm2 startup
```

---

## 4. 管理后台 (Admin) 部署

### 4.1 编译 Admin 项目
```bash
cd /var/www/SuperResumeMaster/admin
npm install
npm run build
```
编译完成后，会在 `admin/dist` 目录下生成静态文件。

---

## 5. Nginx 代理配置

### 5.1 创建 Nginx 配置文件
```bash
sudo nano /etc/nginx/sites-available/superresume
```

写入以下配置（请根据您的域名修改）：
```nginx
server {
    listen 80;
    server_name your-domain.com; # 替换为您的域名或公网IP

    # 1. 主平台前端 (根目录静态文件)
    root /var/www/SuperResumeMaster;
    index index.html pages/login.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # 2. 管理后台 (Admin)
    location /admin {
        alias /var/www/SuperResumeMaster/admin/dist;
        try_files $uri $uri/ /admin/index.html;
    }

    # 3. 后端 API 代理
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # 4. 静态资源 (Uploads)
    location /uploads {
        alias /var/www/SuperResumeMaster/backend/uploads;
        expires 7d;
    }
}
```

### 5.2 激活配置并重启 Nginx
```bash
sudo ln -s /etc/nginx/sites-available/superresume /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 6. 安全与优化 (建议)

### 6.1 配置防火墙 (UFW)
```bash
sudo ufw allow 'Nginx Full'
sudo ufw allow 22
sudo ufw enable
```

### 6.2 配置 SSL (HTTPS)
建议使用 Certbot 申请免费的 Let's Encrypt 证书：
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com
```

---

## 7. 常见问题排查

- **日志查看**：
  - 后端：`pm2 logs srm-backend`
  - Nginx 错误：`sudo tail -f /var/log/nginx/error.log`
- **文件权限**：确保 `backend/uploads` 目录对 Node.js 进程有写入权限：
  `sudo chown -R www-data:www-data /var/www/SuperResumeMaster/backend/uploads`
