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
const interviewRoutes = require('./routes/interview');
const { SubscriptionPlan } = require('./models');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const { User, Role, Resume } = require('./models');
const { authenticate } = require('./middleware/auth');
const authController = require('./controllers/authController');
const { ResumeJob, Job } = require('./models');
const smsService = require('./services/smsService');
const autoScreeningService = require('./services/autoScreeningService');
const deepAnalysisService = require('./services/deepAnalysisService');

const app = express();
const PORT = process.env.PORT || 3000;

// 日志中间件 - 移动到最上方以捕获所有请求
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const start = Date.now();
  
  // 记录请求体（如果是登录请求）
  if (req.path.includes('/login')) {
    console.log(`[DEBUG_REQ] ${timestamp} - ${req.method} ${req.url} body:`, JSON.stringify(req.body));
  }
  
  // 响应结束时记录
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${timestamp}] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
  });
  
  next();
});

// 强制校验 JWT 密钥 - 已移除，改为在 startServer 中设置默认值以避免 502
// if (!process.env.JWT_SECRET) {
//   logger.error('Missing JWT_SECRET in environment');
//   process.exit(1);
// }

// 中间件
// CORS 配置
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [];
if (process.env.PORTAL_URL) {
  allowedOrigins.push(process.env.PORTAL_URL);
}

app.use(cors({
  origin: function(origin, callback) {
    // 允许无 origin 的请求（如移动端 APP、Postman、curl）
    if (!origin) return callback(null, true);
    
    // 开发环境或配置了通配符允许所有
    if (process.env.NODE_ENV === 'development' || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    
    // 检查 Origin 是否在白名单中
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      // 如果未配置白名单，默认允许（兼容旧配置），否则拒绝
      if (allowedOrigins.length === 0) {
        return callback(null, true);
      }
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 204
}));

// 统一开启预检请求处理
app.options('*', cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// 静态文件服务
const path = require('path');
const ROOT_DIR = path.resolve(__dirname, '..');
// 后台管理系统静态文件
const adminDistPath = path.join(ROOT_DIR, 'admin/dist');

// 1. 处理后台管理系统的静态文件
app.use('/admin', express.static(adminDistPath));

// 1.1 处理面试页面的静态文件 (提升优先级)
app.get('/i/:id', (req, res) => {
  const { id } = req.params;
  console.log(`[ShortURL] Redirecting from /i/${id} to interview.html?resumeJobId=${id}`);
  res.redirect(`/interview.html?resumeJobId=${id}`);
});

app.get('/interview.html', (req, res, next) => {
  if (process.env.NODE_ENV !== 'production' && req.headers.host?.includes('3000')) {
    console.log(`[DEBUG] Redirecting interview page from 3000 to 5173 for development`);
    const targetUrl = `http://localhost:5173/interview.html${req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''}`;
    return res.redirect(targetUrl);
  }
  next();
});
app.use('/interview.html', express.static(path.join(ROOT_DIR, 'interview.html')));

// 2. 处理后台管理系统的 SPA 路由回退
app.get('/admin/*', (req, res) => {
  // 如果是带后缀的文件且静态文件中间件没处理，说明文件不存在，返回 404
  if (path.extname(req.path)) {
    return res.status(404).end();
  }
  // 否则返回 index.html 支持 SPA 路由
  res.sendFile(path.join(adminDistPath, 'index.html'));
});

// 3. 其他静态资源
 app.use('/uploads', express.static(path.join(ROOT_DIR, 'uploads')));
 app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
 app.use('/pages/Interview', express.static(path.join(ROOT_DIR, 'pages/Interview/dist')));
app.use('/pages/interview', express.static(path.join(ROOT_DIR, 'pages/Interview/dist')));
  // 确保 assets 目录也能被正确访问（针对某些路径解析情况）
  app.use('/assets', express.static(path.join(ROOT_DIR, 'pages/interview/dist/assets')));
 app.use('/pages', express.static(path.join(ROOT_DIR, 'pages')));
 app.use('/components', express.static(path.join(ROOT_DIR, 'components')));
 app.use('/css', express.static(path.join(ROOT_DIR, 'css')));
 app.use('/js', express.static(path.join(ROOT_DIR, 'js')));
 app.use('/assets', express.static(path.join(ROOT_DIR, 'assets')));
 app.use('/images', express.static(path.join(ROOT_DIR, 'images')));
 app.use('/public', express.static(path.join(ROOT_DIR, 'public')));

app.use(express.static(ROOT_DIR));

// 日志中间件
app.use((req, res, next) => {
  // 记录关键页面的访问
  if (req.path.includes('interview') || req.path.includes('Interview')) {
    console.log(`[DEBUG] Interview Access: ${new Date().toISOString()} - ${req.method} ${req.path}`);
  }
  next();
});

// 路由
app.use((req, res, next) => {
  if (req.path.startsWith('/api/admin/prompts')) {
    console.log('🔍 [PROMPT_ROUTE_MATCH] path:', req.path, 'method:', req.method);
  }
  next();
});

app.get('/api/health', async (req, res) => {
  try {
    const dbStatus = await sequelize.authenticate()
      .then(() => 'connected')
      .catch(err => `error: ${err.message}`);
    
    let userCount = 0;
    let adminExists = false;
    try {
      userCount = await User.count();
      const admin = await User.findOne({ where: { username: 'masteradmin' } });
      adminExists = !!admin;
    } catch (e) {
      userCount = `error: ${e.message}`;
    }

    res.json({
      status: 'ok',
      database: dbStatus,
      dialect: sequelize.getDialect(),
      userCount,
      adminExists,
      env: {
        NODE_ENV: process.env.NODE_ENV,
        DB_HOST: process.env.DB_HOST || 'not set',
        PORT: process.env.PORT
      },
      // 临时辅助排查
      debug: {
        has_jwt_secret: !!process.env.JWT_SECRET,
        cors_origin: true
      }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

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
app.use('/api/interview', interviewRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/admin/prompts', promptRoutes);

// 全局错误处理中间件
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  // 临时：在所有环境下都返回详细错误信息以便排查部署问题
  res.status(err.status || 500).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || '服务器内部错误',
      stack: err.stack
    }
  });
});

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

    const Role = sequelize.models.Role;
    const RolePermission = sequelize.models.RolePermission;
    const UserRole = sequelize.models.UserRole || sequelize.modelManager.getModel('UserRole');

    // 1. 确保所有角色存在
    const rolesToEnsure = [
      { key: 'SUPER_ADMIN', name: '超级管理员', description: '系统最高权限', permissions: ['*'] },
      {
        key: 'PLATFORM_ADMIN', name: '平台管理员', description: '平台管理权限', permissions: [
          'dashboard.view', 'customers.view', 'customers.manage', 'companies.view', 'companies.manage',
          'subscriptions.view', 'subscriptions.manage', 'ai_models.view', 'ai_models.manage',
          'system.logs', 'finance.view', 'finance.manage', 'invoices.view', 'invoices.manage'
        ]
      }
    ];

    for (const r of rolesToEnsure) {
      let role = await Role.findOne({ where: { key: r.key } });
      if (!role) {
        role = await Role.create({ key: r.key, name: r.name, description: r.description, status: 'active' });
      }
      if (r.permissions) {
        await RolePermission.destroy({ where: { role_id: role.id } });
        const rows = r.permissions.map(p => ({ role_id: role.id, permission_key: p }));
        await RolePermission.bulkCreate(rows);
      }
    }

    // 2. 确保管理员账号存在
    const adminUser = await User.findOne({ where: { username: 'masteradmin' } });
    const superRole = await Role.findOne({ where: { key: 'SUPER_ADMIN' } });

    if (!adminUser) {
      const hash = await bcrypt.hash('Longkou7', 10);
      const created = await User.create({
        username: 'masteradmin',
        role: 'admin',
        is_active: true,
        password_hash: hash,
        email: 'admin@resumemaster.com'
      });
      if (UserRole && superRole) {
        await UserRole.findOrCreate({
          where: { user_id: created.id, role_id: superRole.id },
          defaults: { user_id: created.id, role_id: superRole.id }
        });
      }
      console.log('✅ Default admin user created.');
    } else {
      // 确保角色关联
      if (UserRole && superRole) {
        await UserRole.findOrCreate({
          where: { user_id: adminUser.id, role_id: superRole.id },
          defaults: { user_id: adminUser.id, role_id: superRole.id }
        });
      }
      
      // 修复无效密码 (非 bcrypt 格式)
      if (!adminUser.password_hash.startsWith('$2')) {
        const hash = await bcrypt.hash('Longkou7', 10);
        await adminUser.update({ password_hash: hash });
        console.log('✅ Default admin password reset.');
      }
    }
  } catch (err) {
    console.error('❌ ensureDefaultAdmin failed:', err.message);
  }
}

async function ensureDemoResumes() {
  try {
    if (String(process.env.ENABLE_DEMO_SEED || '').toLowerCase() !== 'true') return;
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

// 测试路由
const testRoutes = require('./routes/test');
app.use('/api/test', testRoutes);

// 根路径
app.get('/', (req, res) => {
  res.json({
    message: 'SuperResumeMaster API',
    version: require('./package.json').version,
    timestamp: new Date().toISOString()
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
// 404 处理
app.use((req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 404 Not Found: ${req.method} ${req.originalUrl || req.url}`);
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `接口不存在: ${req.method} ${req.originalUrl || req.url}`
    }
  });
});

const promptService = require('./services/promptService');

// 启动服务器
const startServer = async () => {
  try {
    // 数据库连接重试机制
    const maxRetries = 20; // 增加重试次数
    const retryDelay = 5000;
    
    console.log(`[Startup] Starting server initialization...`);
    console.log(`[Startup] Environment: ${process.env.NODE_ENV}`);
    console.log(`[Startup] Database Host: ${process.env.DB_HOST}`);
    
    let dbConnected = false;

    for (let i = 0; i < maxRetries; i++) {
      try {
        console.log(`[Startup] Database connection attempt ${i + 1}/${maxRetries}...`);
        if (process.env.NODE_ENV === 'production') {
          await sequelize.authenticate();
          console.log('[Startup] Database connection established successfully (Production).');
        } else {
          // 非生产环境可以尝试同步，但禁用 alter 以避免 ER_TOO_MANY_KEYS 错误
          await sequelize.sync({ force: false, alter: false });
          console.log('[Startup] Database synchronized (Development).');
        }
        try {
          const { ensurePostgresViews } = require('./scripts/bootstrap-postgres-views');
          await ensurePostgresViews(sequelize);
        } catch (e) {
          console.warn('[Startup] Ensure Postgres views failed:', e.message);
        }
        dbConnected = true;
        break; // 连接成功，跳出循环
      } catch (err) {
        console.error(`[Startup] Database connection attempt ${i + 1}/${maxRetries} failed:`, err.message);
        if (i === maxRetries - 1) {
             console.error('[Startup] All database connection attempts failed.');
             // 这里不抛出错误，而是继续尝试启动 HTTP 服务，以便至少能返回 503 而不是 502
             // throw err; 
        }
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
    
    // 初始化数据
    try {
      await ensureDefaultAdmin();
      await ensureDefaultPlans();
      await ensureDemoResumes();
      await promptService.ensureDefaultPrompts();
      console.log('Initial data verification completed.');
      
      // 启动自动快评计划任务
      autoScreeningService.start();
      
      // 启动自动深度解析轮询任务 (每 10 分钟一次)
      deepAnalysisService.start();
    } catch (e) {
      console.error('Initial data setup failed:', e.message);
    }

    // 安全地补充缺失列
    try {
      const dialect = sequelize.getDialect();
      const checkAndAddColumn = async (table, column, definition) => {
        try {
          if (dialect === 'mysql') {
            const [results] = await sequelize.query(
              `SELECT COLUMN_NAME FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = '${table}' AND COLUMN_NAME = '${column}'`
            );
            if (results.length === 0) {
              await sequelize.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
              console.log(`✅ [MySQL] Added missing column: ${table}.${column}`);
            }
          } else if (dialect === 'sqlite') {
            const [columns] = await sequelize.query(`PRAGMA table_info(${table})`);
            const exists = columns.some(c => c.name === column);
            if (!exists) {
              await sequelize.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
              console.log(`✅ [SQLite] Added missing column: ${table}.${column}`);
            }
          } else if (dialect === 'postgres') {
            const [results] = await sequelize.query(
              `SELECT column_name FROM information_schema.columns WHERE table_name = '${table}' AND column_name = '${column}'`
            );
            if (results.length === 0) {
              let def = definition;
              if (definition.includes('JSON')) def = 'JSONB';
              await sequelize.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
              console.log(`✅ [Postgres] Added missing column: ${table}.${column}`);
            }
          }
        } catch (e) {
          console.warn(`⚠️ Safe column check failed for ${table}.${column}:`, e.message);
        }
      };

      const tables = ['users', 'jobs', 'resumes', 'analysis_results', 'orders', 'invoices', 'recruitment_processes', 'user_activities', 'deep_analysis_records'];
      for (const table of tables) {
        await checkAndAddColumn(table, 'company_id', 'INTEGER DEFAULT NULL');
      }
      
      const jsonDef = dialect === 'mysql' || dialect === 'postgres' ? 'JSON' : 'TEXT';
      await checkAndAddColumn('subscription_plans', 'i18n_names', jsonDef);
      await checkAndAddColumn('resumes', 'source', 'TEXT');
      await checkAndAddColumn('resumes', 'is_talent_pool', 'INTEGER DEFAULT 0');
      await checkAndAddColumn('resumes', 'score', 'INTEGER DEFAULT 0');
      await checkAndAddColumn('users', 'real_name', 'VARCHAR(100)');
      await checkAndAddColumn('jobs', 'enable_auto_screening', dialect === 'mysql' || dialect === 'postgres' ? 'BOOLEAN DEFAULT TRUE' : 'INTEGER DEFAULT 1');
      await checkAndAddColumn('jobs', 'auto_reject_score', 'INTEGER DEFAULT 60');
      await checkAndAddColumn('jobs', 'notify_high_score', dialect === 'mysql' || dialect === 'postgres' ? 'BOOLEAN DEFAULT TRUE' : 'INTEGER DEFAULT 1');
      await checkAndAddColumn('jobs', 'high_score_threshold', 'INTEGER DEFAULT 85');
      await checkAndAddColumn('jobs', 'enable_deep_analysis', dialect === 'mysql' || dialect === 'postgres' ? 'BOOLEAN DEFAULT FALSE' : 'INTEGER DEFAULT 0');
      await checkAndAddColumn('resume_jobs', 'deep_analysis_status', dialect === 'mysql' ? "ENUM('none', 'pending', 'processing', 'completed', 'failed') DEFAULT 'none'" : "TEXT DEFAULT 'none'");
      await checkAndAddColumn('resume_jobs', 'deep_analysis_trigger', dialect === 'mysql' ? "ENUM('manual', 'auto_immediate', 'auto_polling') DEFAULT 'manual'" : "TEXT DEFAULT 'manual'");
      await checkAndAddColumn('resume_jobs', 'deep_analysis_retry_count', "INTEGER DEFAULT 0");
      await checkAndAddColumn('resume_jobs', 'deep_analysis_error', "TEXT");
      await checkAndAddColumn('jobs', 'weight_preference', dialect === 'mysql' ? "ENUM('balanced', 'skills', 'experience', 'education') DEFAULT 'balanced'" : "TEXT DEFAULT 'balanced'");
      
      await checkAndAddColumn('resumes', 'auto_rejected', dialect === 'mysql' || dialect === 'postgres' ? 'BOOLEAN DEFAULT FALSE' : 'INTEGER DEFAULT 0');
      await checkAndAddColumn('resumes', 'rejection_reason', 'VARCHAR(255) DEFAULT NULL');
      await checkAndAddColumn('companies', 'settings', jsonDef);
      await checkAndAddColumn('companies', 'logo_url', 'VARCHAR(500) DEFAULT NULL');
      await checkAndAddColumn('interview_sessions', 'expires_at', 'DATETIME DEFAULT NULL');

      // MySQL 特有的 ENUM 更新
      if (dialect === 'mysql') {
        try {
          await sequelize.query(`
            ALTER TABLE resumes MODIFY COLUMN recruitment_status 
            ENUM('投递', '快评', '面试', 'Offer', '入职', '放弃', '淘汰') 
            DEFAULT '投递'
          `);
        } catch (e) { }
      }
    } catch (e) {
      console.error('⚠️ Safe column check failed:', e.message);
    }

    const HOST = process.env.HOST || '0.0.0.0';
    const http = require('http');
    const server = http.createServer(app);
    
    // 初始化 Socket.io
    const socketService = require('./services/socketService');
    socketService.init(server);
    
    // 启动异步解析 Worker
    require('./workers/analysisWorker');
    console.log('✅ Deep Analysis Worker started.');

    server.listen(PORT, HOST, () => {
      console.log(`Server is running on http://${HOST}:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

      // 面试提醒调度：每分钟检查一次
      setInterval(async () => {
        try {
          const now = Date.now()
          const upcoming = await ResumeJob.findAll({ where: { status: 'interview' }, limit: 50 })
          for (const rj of upcoming) {
            const rn = (() => { try { return JSON.parse(rj.recruiter_notes || '{}') } catch (_) { return {} } })()
            const itv = rn && rn.interview && rn.interview.datetime ? new Date(rn.interview.datetime).getTime() : null
            const notified = rn && rn.interview && rn.interview.notified
            if (itv && !notified && itv <= now) {
              const resume = await Resume.findOne({ where: { id: rj.resume_id } })
              const user = await User.findOne({ where: { id: rj.user_id } })
              const msg = `提醒：候选人(${resume && resume.file_name})的面试时间已到。`
              console.log('[Interview Notify]', msg)
              if (user && user.phone) { await smsService.sendText(String(user.phone), msg, smsService.SCENARIOS.REMINDER) }
              rn.interview = rn.interview || {}
              rn.interview.notified = true
              await rj.update({ recruiter_notes: JSON.stringify(rn) })
            }
          }
        } catch (e) { console.error('Interview scheduler error:', e.message) }
      }, 60 * 1000);

      // 启动自动快评服务：每分钟执行一次
      try {
        autoScreeningService.start(60 * 1000);
      } catch (e) {
        console.error('Failed to start AutoScreeningService:', e.message);
      }

      // 启动自动深度解析轮询任务 (每 10 分钟一次)
      try {
        deepAnalysisService.start(10 * 60 * 1000);
      } catch (e) {
        console.error('Failed to start DeepAnalysisService:', e.message);
      }
    });
  } catch (err) {
    console.error('Unable to connect to the database:', err);
    if (process.env.NODE_ENV !== 'production') {
      process.exit(1);
    }
  }
};

startServer();

module.exports = app;
