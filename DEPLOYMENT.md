# SuperResumeMaster 部署指南

## 概述

SuperResumeMaster是一个AI驱动的简历解析与优化专家系统，已从基于localStorage的前端存储改造为使用后端API和数据库的完整系统。

## 系统架构

- **前端**: HTML5 + CSS3 + JavaScript + TailwindCSS
- **后端**: Node.js + Express + MySQL
- **认证**: JWT Token
- **数据存储**: MySQL数据库

## 部署步骤

### 1. 环境要求

- Node.js (v14.0.0 或更高版本)
- MySQL (v5.7 或更高版本)
- npm (随Node.js一起安装)

### 2. 前端部署

前端代码位于项目根目录，可直接部署到任何静态文件服务器：

```bash
# 项目根目录包含所有前端页面和资源
# 部署时只需将整个项目目录上传到静态服务器
```

### 3. 后端部署

#### 3.1 安装依赖

```bash
cd backend
npm install
```

#### 3.2 配置数据库

编辑 `backend/config/database.js` 文件，配置数据库连接信息：

```javascript
module.exports = {
  development: {
    username: 'your_db_username',
    password: 'your_db_password',
    database: 'superresumemaster',
    host: '127.0.0.1',
    dialect: 'mysql'
  },
  production: {
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    dialect: 'mysql'
  }
};
```

#### 3.3 创建数据库

```sql
CREATE DATABASE superresumemaster;
```

#### 3.4 启动后端服务

```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

后端服务默认运行在 `http://localhost:3000`

## API接口列表

### 认证相关
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `GET /api/auth/user` - 获取当前用户信息
- `PUT /api/auth/user` - 更新用户信息
- `POST /api/auth/logout` - 用户登出

### 简历管理
- `GET /api/resumes` - 获取用户所有简历
- `POST /api/resumes` - 上传新简历
- `GET /api/resumes/:id` - 获取特定简历详情
- `PUT /api/resumes/:id` - 更新简历信息
- `DELETE /api/resumes/:id` - 删除简历

### 分析结果
- `GET /api/analysis` - 获取所有分析结果
- `GET /api/analysis/resume/:resumeId` - 获取特定简历的分析结果
- `POST /api/analysis` - 创建新的分析结果
- `GET /api/analysis/latest/:resumeId` - 获取简历最新分析结果

### 职位管理
- `GET /api/jobs` - 获取所有职位
- `POST /api/jobs` - 创建新职位
- `GET /api/jobs/:id` - 获取特定职位详情
- `PUT /api/jobs/:id` - 更新职位信息
- `DELETE /api/jobs/:id` - 删除职位

## 配置说明

### 前端配置

前端页面会自动调用后端API，确保以下配置正确：

1. 所有页面中的API调用路径正确（默认为 `/api`）
2. 错误处理模块已正确引入（`js/error-handler.js`）

### 环境变量

在生产环境中，建议使用以下环境变量：

```bash
DB_HOST=your_database_host
DB_USERNAME=your_database_username
DB_PASSWORD=your_database_password
DB_NAME=your_database_name
JWT_SECRET=your_jwt_secret
PORT=3000
```

## 错误处理

系统已实现完整的错误处理机制：

- 前端：全局错误和成功消息显示
- 后端：数据库错误、验证错误等的处理
- 网络状态监控

## 安全考虑

- JWT Token认证，有效防止未授权访问
- 输入数据验证，防止SQL注入
- 敏感信息不存储在客户端

## 性能优化

- API响应时间优化
- 数据库查询优化
- 前端资源加载优化

## 故障排除

### 常见问题

1. **API调用失败**：检查后端服务是否正常运行
2. **数据库连接失败**：检查数据库配置是否正确
3. **认证失败**：检查JWT Token是否正确传递

### 日志查看

后端服务会输出详细的日志信息，便于排查问题。

## 扩展性

系统设计具有良好的扩展性，可轻松添加新功能模块：

- 新的API端点
- 额外的数据模型
- 新的前端页面

## 维护

- 定期备份数据库
- 监控API性能
- 更新依赖包