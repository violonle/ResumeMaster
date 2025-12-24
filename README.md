# 争湃·简历大师 - SuperResumeMaster

## 项目概述

争湃·简历大师是一个AI驱动的简历解析与优化专家系统，旨在帮助用户深度分析简历，提供专业评估与建议，助力用户在竞争激烈的职场中脱颖而出。

## 项目架构

### 前端架构
- **技术栈**: HTML5 + CSS3 + JavaScript + TailwindCSS
- **设计风格**: 现代化玻璃拟态设计，深色主题，紫色渐变配色
- **响应式设计**: 支持移动端和桌面端
- **双版本支持**: 移动端版本和PC端专用版本
- **核心模块**:
  - `js/resume-parser.js`: 简历解析器，支持多种文件格式
  - `js/resume-data.js`: 数据管理器，通过API调用处理数据操作
  - `js/ai-analyzer.js`: AI分析器，模拟智能简历分析
  - `js/error-handler.js`: 错误处理模块，提供统一的错误显示和加载状态管理
  - `css/responsive.css`: 响应式样式，移动端适配
  - `components/mobile-nav.html`: 移动端导航组件

### 后端架构
- **技术栈**: Node.js + Express + MySQL + Sequelize
- **端口**: 3000 (可配置)
- **数据库**: MySQL
- **认证机制**: JWT Token

## 功能模块

### 1. 欢迎页面
- **移动端版本** (welcome.html): 项目介绍和品牌展示
- **PC端版本** (welcome-pc.html): 桌面端优化布局，顶部导航栏
- 功能特性展示（简历解析、能力评估、对比分析）
- 引导用户开始使用

### 2. 职位管理
- **移动端版本** (user-profile.html): 移动端职位中心
- **PC端版本** (user-profile-pc.html): 桌面端职位中心
- 职位管理  (job-management.html)
- 统计数据展示

### 3. 简历上传
- **移动端版本** (pages/upload.html): 移动端优化的上传界面
- **PC端版本** (resume-upload-pc.html): 桌面端大屏幕布局
- 支持多种格式：PDF、DOCX、HTML
- 拖拽上传功能
- 招聘平台导入（BOSS直聘、智联招聘、猎聘网）
- 分析选项配置
- 集成AI分析器和数据管理器
- 实时上传进度显示
- 自动跳转到分析结果页面

### 4. 简历分析
- **移动端版本** (pages/analysis.html): 移动端分析结果展示
- **PC端版本** (resume-analysis-pc.html): 桌面端详细分析报告
- AI驱动的简历深度解析
- 专业评估和建议
- 雷达图能力分析
- 动态加载分析结果
- 多维度评分展示
- 核心优势和改进建议
- 技能详细分析和可视化

### 5. 简历采集 (resume-crawler.html)
- 从招聘平台批量采集简历
- 自动化数据处理

### 6. 简历库 
- **移动端版本** (resume-library.html): 移动端简历管理
- **PC端版本** (resume-library-pc.html): 桌面端网格布局管理
- 简历存储和管理
- 分类和搜索功能
- 职位分类展示

### 7. 简历对比
- **移动端版本** (resume-compare-upload.html): 移动端对比上传
- **PC端版本** (resume-compare-upload-pc.html): 桌面端对比界面
- 结果页面 (resume-compare-results.html)
- 多份简历对比分析
- 权重配置功能

### 8. AI助理 (ai-assistant.html)
- 智能对话助手
- 简历优化建议

### 9. 用户管理
- **移动端版本** (user-profile.html): 移动端个人中心
- **PC端版本** (user-profile-pc.html): 桌面端个人中心
- 管理面板 (admin-panel.html)
- 企业认证 (business-verification.html)
- 统计数据展示
- 会员订阅管理  

## 数据存储架构升级

### 重大更新
本项目已从基于浏览器localStorage的前端存储架构，升级为基于后端API和数据库的完整系统架构。

### 升级内容
- **数据持久化**: 用户数据和简历信息现在存储在MySQL数据库中
- **多用户支持**: 系统现在支持多个用户，每个用户的数据完全隔离
- **API接口**: 提供完整的RESTful API接口，便于扩展和集成
- **认证安全**: 使用JWT Token进行用户认证，提高系统安全性
- **错误处理**: 实现了完整的错误处理和用户反馈机制
- **加载状态**: 添加了统一的加载状态显示，提升用户体验

## API接口

### 认证接口 (/api/auth)
- `POST /register` - 用户注册
- `POST /login` - 用户登录
- `GET /user` - 获取当前用户信息
- `PUT /user` - 更新用户信息
- `POST /logout` - 用户登出

### 简历接口 (/api/resumes)
- `GET /` - 获取用户所有简历
- `POST /` - 上传新简历
- `GET /:id` - 获取特定简历详情
- `PUT /:id` - 更新简历信息
- `DELETE /:id` - 删除简历

### 分析接口 (/api/analysis)
- `GET /` - 获取所有分析结果
- `GET /resume/:resumeId` - 获取特定简历的分析结果
- `POST /` - 创建新的分析结果
- `GET /latest/:resumeId` - 获取简历最新分析结果

### 职位接口 (/api/jobs)
- `GET /` - 获取所有职位
- `POST /` - 创建新职位
- `GET /:id` - 获取特定职位详情
- `PUT /:id` - 更新职位信息
- `DELETE /:id` - 删除职位

## 部署说明

### 前端部署
前端代码可直接部署到任何静态文件服务器，无需特殊配置。

### 后端部署
1. 安装Node.js和MySQL
2. 配置数据库连接信息
3. 安装依赖：`npm install`
4. 启动服务：`npm start`

详细部署说明请查看 [DEPLOYMENT.md](DEPLOYMENT.md) 文件。

## 更新日志

### 2025年11月 - v2.0.0
**架构升级**
- 🏗️ 重构为前后端分离架构
- 🗄️ 从localStorage升级为MySQL数据库存储
- 🔐 实现JWT Token用户认证系统
- 🌐 提供完整的RESTful API接口
- 🛡️ 添加统一错误处理和加载状态显示
- 📈 提升系统可扩展性和安全性

### 2024年1月20日 - v1.0.1
**UI优化更新**
- 🔧 修复导航条高度过高问题
- 📱 优化移动端和桌面端导航条高度统一为56px（h-14）
- 🎨 调整页面顶部间距，确保内容不被导航条遮挡
- 📋 涉及文件：所有页面导航条、移动端导航组件、响应式CSS
- ✅ 提升用户体验，解决页面内容被遮挡问题

### 2024年12月 - v1.0.0
**初始版本发布**
- 🚀 完成基础功能开发
- 📊 实现简历解析、分析、对比功能
- 🎯 支持移动端和桌面端响应式设计
- 👤 集成用户管理和权限系统

---

**开发团队**: ResumeHelper Team  
**最后更新**: 2025年11月  
**技术支持**: 如有问题请联系开发团队