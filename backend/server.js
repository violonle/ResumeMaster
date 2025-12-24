// 加载环境变量
require('dotenv').config();

const express = require('express');
const logger = require('./utils/logger');
const cors = require('cors');
const bodyParser = require('body-parser');
const { sequelize } = require('./models');

// 路由
const authRoutes = require('./routes/auth');
const resumeRoutes = require('./routes/resumes');
const analysisRoutes = require('./routes/analysis');
const jobRoutes = require('./routes/jobs');
const companyRoutes = require('./routes/company');
const aiAnalysisRoutes = require('./routes/aiAnalysis');
const paymentRoutes = require('./routes/payment');
const subscriptionRoutes = require('./routes/subscription');
const invoiceRoutes = require('./routes/invoice');
const permissionRoutes = require('./routes/permission');
const assistantRoutes = require('./routes/assistant');
const adminAIConfigRoutes = require('./routes/adminAIConfig');
const adminRoutes = require('./routes/admin');
const dashboardRoutes = require('./routes/dashboard');
const recruitmentRoutes = require('./routes/recruitment');
const libraryRoutes = require('./routes/library');
const promptRoutes = require('./routes/prompt');
const { SubscriptionPlan } = require('./models');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const { User, Role, Resume } = require('./models');
const { authenticate } = require('./middleware/auth');
const authController = require('./controllers/authController');
const { ResumeJob, Job } = require('./models');
const smsService = require('./services/smsService');

const app = express();
const PORT = process.env.PORT || 3000;

// 强制校验 JWT 密钥
if (!process.env.JWT_SECRET) {
  logger.error('Missing JWT_SECRET in environment');
  process.exit(1);
}

// 中间件
if ((process.env.NODE_ENV || 'development') === 'production') {
  const whitelist = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  app.use(cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (whitelist.includes(origin)) return cb(null, true);
      cb(new Error('Not allowed by CORS'));
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 204
  }));
} else {
  const origins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : null;
  app.use(cors({
    origin: origins ? origins : true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 204
  }));
}
// 统一开启预检请求处理
app.options('*', cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// 静态文件服务
const path = require('path');
const ROOT_DIR = path.resolve(__dirname, '..');
app.use('/uploads', express.static(path.join(ROOT_DIR, 'uploads')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/pages', express.static(path.join(ROOT_DIR, 'pages')));
app.use('/components', express.static(path.join(ROOT_DIR, 'components')));
app.use('/css', express.static(path.join(ROOT_DIR, 'css')));
app.use('/js', express.static(path.join(ROOT_DIR, 'js')));
app.use('/assets', express.static(path.join(ROOT_DIR, 'assets')));
app.use('/images', express.static(path.join(ROOT_DIR, 'images')));

// 日志中间件
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/resumes', resumeRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/ai', aiAnalysisRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api/admin', adminAIConfigRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/recruitment', recruitmentRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/prompts', promptRoutes);

// 兼容路径：/api/user/stats 映射到认证模块的用户统计
app.get('/api/user/stats', authenticate, authController.getUserStats);

async function ensureDefaultPlans() {
  try {
    const keys = ['free', 'pro', 'enterprise'];
    const rows = await SubscriptionPlan.findAll({ where: { key: { [Op.in]: keys } } });
    const have = new Set(rows.map(r => r.key));
    const defaults = [
      { key: 'free', name: '免费版', i18n_names: { zh: '免费版', en: 'Free' }, features: [], quota: { resume_parses_per_month: 50, concurrent: 1, ai_calls: 5000 }, price: 0, status: 'active' },
      { key: 'pro', name: '专业版', i18n_names: { zh: '专业版', en: 'Pro' }, features: [], quota: { resume_parses_per_month: 1000, concurrent: 3, ai_calls: 100000 }, price: 99, status: 'active' },
      { key: 'enterprise', name: '企业版', i18n_names: { zh: '企业版', en: 'Enterprise' }, features: [], quota: { resume_parses_per_month: 5000, concurrent: 10, ai_calls: 1000000 }, price: 999, status: 'active' }
    ];
    for (const d of defaults) { if (!have.has(d.key)) { try { await SubscriptionPlan.create(d) } catch (_) { } } }
  } catch (_) { }
}

ensureDefaultPlans();

async function ensureDefaultAdmin() {
  try {
    if (!process.env.JWT_SECRET || String(process.env.JWT_SECRET).trim() === '') {
      process.env.JWT_SECRET = 'dev-secret';
    }
    const adminUser = await User.findOne({ where: { username: 'admin' } });
    const ensureRole = async (userId) => {
      let superRole = await Role.findOne({ where: { key: 'SUPER_ADMIN' } });
      if (!superRole) {
        superRole = await Role.create({ key: 'SUPER_ADMIN', name: '超级管理员', description: '系统最高权限', status: 'active' });
      }
      const UserRole = sequelize.modelManager.getModel('UserRole');
      if (UserRole) { try { await UserRole.findOrCreate({ where: { user_id: userId, role_id: superRole.id }, defaults: { user_id: userId, role_id: superRole.id } }) } catch (_) { } }
    };
    if (!adminUser) {
      const hash = await bcrypt.hash('admin123', 10);
      const created = await User.create({ username: 'admin', role: 'admin', is_active: true, password_hash: hash, email: null, phone: null });
      await ensureRole(created.id);
    } else {
      const ph = String(adminUser.password_hash || '');
      const invalid = !ph.startsWith('$2');
      const updates = {};
      if (invalid) { updates.password_hash = await bcrypt.hash('admin123', 10); }
      if (adminUser.role !== 'admin') { updates.role = 'admin'; }
      if (adminUser.is_active !== true) { updates.is_active = true; }
      if (Object.keys(updates).length) { await adminUser.update(updates); }
      await ensureRole(adminUser.id);
    }
  } catch (_) { }
}

ensureDefaultAdmin();

async function ensureDemoResumes() {
  try {
    const phone = '18605355138';
    let user = await User.findOne({ where: { phone } });
    if (!user) {
      const hash = await bcrypt.hash('demo123', 10);
      user = await User.create({ username: 'demo-55138', phone, role: 'user', is_active: true, password_hash: hash });
    }
    const count = await Resume.count({ where: { user_id: user.id } });
    if (count >= 3) return;
    const demos = [
      { file_name: '前端开发工程师_张三.pdf', file_size: 204800, file_type: 'pdf', file_path: 'uploads/resumes/demo_frontend.pdf', status: 'uploaded', parsed_data: { name: '张三', jobTitle: '前端开发工程师', skills: ['React', 'TypeScript', 'CSS'] }, tags: ['前端', 'React', 'JavaScript'] },
      { file_name: '产品经理_李四.docx', file_size: 102400, file_type: 'docx', file_path: 'uploads/resumes/demo_pm.docx', status: 'uploaded', parsed_data: { name: '李四', jobTitle: '产品经理', skills: ['Axure', 'SQL', '数据分析'] }, tags: ['产品', '需求', '数据分析'] },
      { file_name: 'Java后端_王五.txt', file_size: 51200, file_type: 'txt', file_path: 'uploads/resumes/demo_backend.txt', status: 'uploaded', parsed_data: { name: '王五', jobTitle: 'Java后端工程师', skills: ['Java', 'Spring Boot', 'MySQL'] }, tags: ['后端', 'Java', 'Spring'] }
    ];
    for (const d of demos) { await Resume.create({ ...d, user_id: user.id }); }
  } catch (_) { }
}

ensureDemoResumes();

// 测试路由
const testRoutes = require('./routes/test');
app.use('/api/test', testRoutes);

// 根路径
app.get('/', (req, res) => {
  res.json({
    message: 'SuperResumeMaster API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// 健康检查端点
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// 就绪探针：检查数据库与AI服务可用性
app.get('/api/ready', async (req, res) => {
  try {
    await sequelize.authenticate();
    const DomesticAIService = require('./services/domesticAIService');
    const svc = new DomesticAIService();
    const status = await svc.checkServiceStatus();
    const anyAvailable = Object.values(status).some(s => s && s.available);
    res.json({ success: true, data: { db: true, ai: anyAvailable } });
  } catch (e) {
    res.status(503).json({ success: false, error: { code: 'NOT_READY', message: e.message } });
  }
});

// 错误处理中间件
app.use((err, req, res, next) => {
  const traceId = Math.random().toString(36).slice(2);
  logger.error('Unhandled error', { traceId, stack: err.stack });

  // 如果是数据库错误
  if (err.name === 'SequelizeDatabaseError') {
    return res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: '数据库操作失败',
        traceId
      }
    });
  }

  // 如果是验证错误
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: '数据验证失败',
        details: err.errors.map(e => e.message)
      }
    });
  }

  // 通用错误处理
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: '服务器内部错误',
      traceId
    }
  });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: '接口不存在'
    }
  });
});

// 启动服务器
sequelize.sync({ force: false })
  .then(() => {
    console.log('Database synchronized successfully.');
    // 确保 VerificationCode 表存在（如果不存在sequelize.sync会创建，但为了保险起见）
    // 检查并添加 company_id 到相关表
    (async () => {
      try {
        const tables = ['users', 'jobs', 'resumes', 'analysis_results', 'orders', 'invoices', 'recruitment_processes', 'user_activities'];
        for (const table of tables) {
          const [cols] = await sequelize.query(`PRAGMA table_info('${table}')`);
          const hasCompanyId = Array.isArray(cols) && cols.some(c => (c.name || c.cid || '').toString() === 'company_id');
          if (!hasCompanyId) {
            await sequelize.query(`ALTER TABLE ${table} ADD COLUMN company_id INTEGER DEFAULT NULL`);
            console.log(`Added column ${table}.company_id`);
          }
        }
      } catch (e) { console.error('Ensure company_id columns failed:', e.message) }
    })();
    // 修复: 为旧数据库补充缺失的 subscription_plans.i18n_names 列
    (async () => {
      try {
        const [cols] = await sequelize.query("PRAGMA table_info('subscription_plans')");
        const hasI18n = Array.isArray(cols) && cols.some(c => (c.name || c.cid || '').toString() === 'i18n_names');
        if (!hasI18n) {
          await sequelize.query("ALTER TABLE subscription_plans ADD COLUMN i18n_names TEXT DEFAULT '{}' ");
          console.log('Added column subscription_plans.i18n_names');
        }
      } catch (e) { console.error('Ensure subscription_plans.i18n_names failed:', e.message) }
    })();
    // 为 resumes 表补充缺失的 source / is_talent_pool 列
    (async () => {
      try {
        const [cols] = await sequelize.query("PRAGMA table_info('resumes')");
        const hasSource = Array.isArray(cols) && cols.some(c => String(c.name||c.cid||'') === 'source');
        const hasTalent = Array.isArray(cols) && cols.some(c => String(c.name||c.cid||'') === 'is_talent_pool');
        if (!hasSource) {
          await sequelize.query("ALTER TABLE resumes ADD COLUMN source TEXT DEFAULT 'manual'");
          console.log('Added column resumes.source');
        }
        if (!hasTalent) {
          await sequelize.query("ALTER TABLE resumes ADD COLUMN is_talent_pool INTEGER DEFAULT 0");
          console.log('Added column resumes.is_talent_pool');
        }
      } catch (e) { console.error('Ensure resumes extra columns failed:', e.message) }
    })();
    // 初始化默认管理员角色与权限
    (async () => {
      try {
        const Role = sequelize.models.Role;
        const RolePermission = sequelize.models.RolePermission;
        const ensureRole = async (key, name, description, permissions) => {
          let role = await Role.findOne({ where: { key } });
          if (!role) {
            role = await Role.create({ key, name, description, status: 'active' });
          } else {
            await role.update({ name, description, status: 'active' });
          }
          await RolePermission.destroy({ where: { role_id: role.id } });
          if (Array.isArray(permissions) && permissions.length) {
            const rows = permissions.map(p => ({ role_id: role.id, permission_key: p }));
            await RolePermission.bulkCreate(rows);
          }
        };
        const all = [
          { key: 'SUPER_ADMIN', name: '超级管理员', description: '拥有所有权限', permissions: ['*'] },
          {
            key: 'PLATFORM_ADMIN', name: '平台管理员', description: '平台管理权限（不含底层敏感设置）', permissions: [
              'dashboard.view',
              'customers.view', 'customers.manage',
              'companies.view', 'companies.manage',
              'subscriptions.view', 'subscriptions.manage',
              'ai_models.view', 'ai_models.manage',
              'system.logs',
              'finance.view', 'finance.manage',
              'invoices.view', 'invoices.manage'
            ]
          },
          {
            key: 'CUSTOMER_ADMIN', name: '客户管理员', description: '管理账号、企业与订阅', permissions: [
              'customers.view', 'customers.manage',
              'companies.view', 'companies.manage',
              'subscriptions.view', 'subscriptions.manage'
            ]
          },
          {
            key: 'AI_MODELS_ADMIN', name: '大模型管理员', description: '管理大模型提供商与密钥', permissions: [
              'ai_models.view', 'ai_models.manage'
            ]
          }
        ];
        for (const r of all) { await ensureRole(r.key, r.name, r.description, r.permissions); }
        console.log('Default admin roles ensured.');
        if ((process.env.NODE_ENV || 'development') === 'development') {
          const User = sequelize.models.User;
          const UserRole = sequelize.models.UserRole;
          const Role = sequelize.models.Role;
          const bcrypt = require('bcryptjs');
          let admin = await User.findOne({ where: { email: 'admin@resumemaster.com' } });
          if (!admin) {
            const hash = await bcrypt.hash('admin123', 10);
            admin = await User.create({ username: 'admin', email: 'admin@resumemaster.com', password_hash: hash, role: 'admin', is_active: true });
            const superRole = await Role.findOne({ where: { key: 'SUPER_ADMIN' } });
            if (superRole) await UserRole.create({ user_id: admin.id, role_id: superRole.id });
            console.log('Default admin user ensured.');
          }
        }
      } catch (e) {
        console.error('Seed default admin roles failed:', e.message);
      }
    })();
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    // 面试提醒调度：每分钟检查一次
    setInterval(async ()=>{
      try{
        const now = Date.now()
        const upcoming = await ResumeJob.findAll({ where:{ status:'interview' }, limit: 50 })
        for(const rj of upcoming){
          const rn = (()=>{ try{ return JSON.parse(rj.recruiter_notes||'{}') }catch(_){ return {} } })()
          const itv = rn && rn.interview && rn.interview.datetime ? new Date(rn.interview.datetime).getTime() : null
          const notified = rn && rn.interview && rn.interview.notified
          if (itv && !notified && itv <= now){
            const resume = await Resume.findOne({ where:{ id: rj.resume_id } })
            const user = await User.findOne({ where:{ id: rj.user_id } })
            const msg = `提醒：候选人(${resume && resume.file_name})的面试时间已到。`
            console.log('[Interview Notify]', msg)
            // 如果存在手机号，尝试发送短信（示例：使用当前账户手机号）
            if (user && user.phone){ await smsService.sendText(String(user.phone), msg) }
            rn.interview = rn.interview || {}
            rn.interview.notified = true
            await rj.update({ recruiter_notes: JSON.stringify(rn) })
          }
        }
      }catch(e){ console.error('Interview scheduler error:', e.message) }
    }, 60*1000)
  });
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err);
    // 即使同步失败，也启动服务器以进行开发
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log('Note: Server is running without a database connection.');
    });
  });

module.exports = app;
