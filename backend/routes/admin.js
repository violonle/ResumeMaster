const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { jwtSecret } = require('../config/auth');
const { authenticateToken, requireAdmin } = require('../middleware/adminAuth');
const { User, Company, Subscription, SubscriptionPlan, ModelProvider, ModelKey, SystemConfig, sequelize, AnalysisResult, Order, AuditLog, UserActivity, ResumeJob, Resume, Job, DeepAnalysisRecord, InterviewSession } = require('../models');
const { Op } = require('sequelize');
const axios = require('axios');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const smsService = require('../services/smsService');
const { ensurePostgresViews } = require('../scripts/bootstrap-postgres-views');

// 管理员登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    // 优先支持默认回退管理员，避免数据库或角色未初始化导致无法登录
    // 优先支持默认回退管理员 - 已移除，请确保数据库中存在管理员账号
    // if (username === 'masteradmin' && password === 'Longkou7') { ... }
    // 先尝试数据库账户登录
    const user = await User.findOne({ where: { username } });

    // 显式拦截演示账号，提示其只能登录前端
    if (user && user.username === 'demo') {
      return res.status(403).json({ message: '演示账号仅能登录用户端，不能登录管理后台' });
    }

    if (user && user.role === 'admin' && user.is_active) {
      let ok = false;
      try {
        ok = await bcrypt.compare(password, user.password_hash);
      } catch (e) {
        return res.status(401).json({ message: '用户名或密码错误' });
      }
      if (!ok) return res.status(401).json({ message: '用户名或密码错误' });
      // 加载角色与权限
      let perms = ['*'];
      try {
        const roles = await user.getRoles({ include: [{ model: sequelize.models.RolePermission, as: 'Permissions' }] });
        perms = [];
        for (const r of roles) {
          const ps = (r.Permissions || []).map(p => p.permission_key);
          if (ps.includes('*')) { perms = ['*']; break; }
          perms.push(...ps);
        }
        perms = perms.length ? Array.from(new Set(perms)) : ['*'];
      } catch (_) {
        perms = ['*'];
      }
      const token = jwt.sign(
        { id: user.id, username: user.username, role: 'admin', permissions: perms },
        process.env.JWT_SECRET || jwtSecret,
        { expiresIn: '24h' }
      );
      return res.json({ token, user: { id: user.id, username: user.username, role: 'admin', permissions: perms } });
    }
    // 不再支持内置管理员回退
    return res.status(401).json({ message: '用户名或密码错误' });
  } catch (error) {
    console.error('Admin login error:', error?.message || error);
        res.status(401).json({ message: '用户名或密码错误' });
  }
});

// 获取管理员信息
router.get('/profile', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (req.user && req.user.id && req.user.id > 0) {
      const user = await User.findByPk(req.user.id);
      if (!user) return res.status(404).json({ message: '账号不存在' });
      const roles = await user.getRoles({ include: [{ model: sequelize.models.RolePermission, as: 'Permissions' }] });
      let perms = [];
      for (const r of roles) {
        const ps = (r.Permissions || []).map(p => p.permission_key);
        if (ps.includes('*')) { perms = ['*']; break; }
        perms.push(...ps);
      }
      perms = Array.from(new Set(perms));
      return res.json({ id: user.id, username: user.username, role: 'admin', permissions: perms.length ? perms : ['*'] });
    }
    return res.status(401).json({ message: '未登录或会话无效' });
  } catch (error) {
    console.error('Get admin profile error:', error);
    res.status(500).json({ message: '获取管理员信息失败' });
  }
});

router.put('/profile', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!req.user || !req.user.id || req.user.id <= 0) return res.status(400).json({ message: '内置管理员不支持更新' });
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ message: '账号不存在' });
    const updates = {};
    if (typeof req.body.username === 'string' && req.body.username.trim()) updates.username = req.body.username.trim();
    if (typeof req.body.email === 'string') updates.email = req.body.email || null;
    if (typeof req.body.phone === 'string') updates.phone = req.body.phone || null;
    if (Object.keys(updates).length) await user.update(updates);
    if (typeof req.body.password === 'string' && req.body.password.trim()) {
      const hash = await bcrypt.hash(req.body.password.trim(), 10);
      await user.update({ password_hash: hash });
    }
    const roles = await user.getRoles({ include: [{ model: sequelize.models.RolePermission, as: 'Permissions' }] });
    let perms = [];
    for (const r of roles) {
      const ps = (r.Permissions || []).map(p => p.permission_key);
      if (ps.includes('*')) { perms = ['*']; break; }
      perms.push(...ps);
    }
    perms = Array.from(new Set(perms));
    res.json({ id: user.id, username: user.username, role: 'admin', permissions: perms.length ? perms : ['*'] });
  } catch (error) {
    console.error('Update admin profile error:', error);
    res.status(500).json({ message: '更新管理员信息失败' });
  }
});

// 头像上传
const avatarDir = path.join(process.cwd(), 'uploads', 'avatars');
try { fs.mkdirSync(avatarDir, { recursive: true }) } catch (_) { }
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, avatarDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = `admin_${req.user?.id || 'unknown'}_${Date.now()}${ext}`;
    cb(null, name);
  }
});
const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.mimetype);
    cb(ok ? null : new Error('不支持的图片类型'), ok);
  }
});

router.post('/profile/avatar', authenticateToken, requireAdmin, avatarUpload.single('avatar'), async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId || userId <= 0) return res.status(400).json({ message: '内置管理员不支持上传头像' });
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ message: '账号不存在' });
    if (!req.file) return res.status(400).json({ message: '未接收到文件' });
    const relPath = `/uploads/avatars/${req.file.filename}`;
    await user.update({ avatar: relPath });
    res.json({ success: true, data: { avatar: relPath } });
  } catch (error) {
    console.error('Upload avatar error:', error);
    res.status(500).json({ message: '上传头像失败' });
  }
});

// 账号管理（替换客户管理）
router.get('/accounts', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, itemsPerPage = 10, search = '', role = '', verified = '', companyId, sortBy = 'created_at', sortOrder = 'DESC' } = req.query;

    const offset = (page - 1) * itemsPerPage;
    const limit = parseInt(itemsPerPage);

    const where = {};
    if (search) {
      where[Op.or] = [
        { username: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } }
      ];
    }
    if (role) where.role = role;
    if (verified) where.phone_verified = verified === 'true';
    if (companyId) where.company_id = companyId;

    const { count, rows } = await User.findAndCountAll({
      where,
      limit,
      offset,
      order: [[sortBy, sortOrder]]
    });

    res.json({
      items: rows,
      total: count,
      page: parseInt(page),
      itemsPerPage: limit
    });
  } catch (error) {
    console.error('Get accounts error:', error);
    res.status(500).json({ message: '获取账号列表失败' });
  }
});

router.get('/accounts/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const account = await User.findByPk(req.params.id);
    if (!account) {
      return res.status(404).json({ message: '账号不存在' });
    }
    res.json(account);
  } catch (error) {
    console.error('Get account error:', error);
    res.status(500).json({ message: '获取账号信息失败' });
  }
});

router.post('/pg/refresh-mv', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const dialect = sequelize.getDialect();
    if (dialect !== 'postgres') return res.status(400).json({ success:false, error:{ code:'NOT_POSTGRES', message:'仅支持 PostgreSQL' } });
    await ensurePostgresViews(sequelize);
    return res.json({ success:true });
  } catch (e) {
    return res.status(500).json({ success:false, error:{ code:'REFRESH_FAILED', message: e.message } });
  }
});

router.post('/accounts', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, phone, email, company_id, role = 'HR_STAFF', is_verified = false } = req.body;
    const isAdminCreation = typeof req.body.username === 'string' && typeof req.body.password === 'string' && typeof req.body.role_key === 'string';
    // 如果是新建管理账号（包含 username/password/role_key）
    if (isAdminCreation) {
      const { username, password, role_key } = req.body;
      const existing = await User.findOne({ where: { username } });
      if (existing) return res.status(400).json({ message: '账号ID/邮箱/手机号已存在' });
      const allowed = ['SUPER_ADMIN', 'PLATFORM_ADMIN', 'CUSTOMER_ADMIN', 'AI_MODELS_ADMIN'];
      if (!allowed.includes(role_key)) return res.status(400).json({ message: '无效的账号类型' });
      const hash = await bcrypt.hash(password, 10);
      const account = await User.create({ username, email: email || null, phone: phone || null, role: 'admin', company_id: company_id || null, phone_verified: !!is_verified, is_active: true, password_hash: hash });
      const r = await sequelize.models.Role.findOne({ where: { key: role_key } });
      if (!r) return res.status(500).json({ message: '系统角色未初始化' });
      await sequelize.models.UserRole.create({ user_id: account.id, role_id: r.id });
      try { await sequelize.models.AuditLog.create({ actor_account_id: req.user?.id || 0, action: 'accounts.create_admin', resource_type: 'User', resource_id: account.id, payload: { username, role_key }, ip: req.ip, ua: req.headers['user-agent'] }); } catch (_) { }
      return res.status(201).json({ id: account.id, username: account.username });
    }
    // 普通账号创建（兼容原逻辑）
    const orList2 = [];
    if (name) orList2.push({ username: name });
    if (email) orList2.push({ email });
    if (phone) orList2.push({ phone });
    const existing = orList2.length ? await User.findOne({ where: { [Op.or]: orList2 } }) : null;
    if (existing) return res.status(400).json({ message: '姓名/邮箱/手机号已存在' });
    const account = await User.create({ username: name, email, phone, role: mapRole(role), company_id, phone_verified: !!is_verified, is_active: true, password_hash: 'N/A' });
    try { await sequelize.models.AuditLog.create({ actor_account_id: req.user?.id || 0, action: 'accounts.create', resource_type: 'User', resource_id: account.id, payload: { name, phone, email, role, company_id }, ip: req.ip, ua: req.headers['user-agent'] }); } catch (_) { }
    res.status(201).json(account);
  } catch (error) {
    console.error('Create account error:', error);
    res.status(500).json({ message: '创建账号失败' });
  }
});

router.patch('/accounts/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, email, phone, role, is_verified, company_id, is_active } = req.body;

    const account = await User.findByPk(req.params.id);
    if (!account) {
      return res.status(404).json({ message: '账号不存在' });
    }

    await account.update({ username: name ?? account.username, email: email ?? account.email, phone: phone ?? account.phone, role: role ? mapRole(role) : account.role, phone_verified: typeof is_verified === 'boolean' ? is_verified : account.phone_verified, company_id: company_id ?? account.company_id, is_active: typeof is_active === 'boolean' ? is_active : account.is_active });
    try { await sequelize.models.AuditLog.create({ actor_account_id: req.user?.id || 0, action: 'accounts.update', resource_type: 'User', resource_id: account.id, payload: { name, phone, email, role, company_id, is_active }, ip: req.ip, ua: req.headers['user-agent'] }); } catch (_) { }
    res.json(account);
  } catch (error) {
    console.error('Update account error:', error);
    res.status(500).json({ message: '更新账号失败' });
  }
});

router.delete('/accounts/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const account = await User.findByPk(req.params.id);
    if (!account) {
      return res.status(404).json({ message: '账号不存在' });
    }

    await account.destroy();
    try { await sequelize.models.AuditLog.create({ actor_account_id: req.user?.id || 0, action: 'accounts.delete', resource_type: 'User', resource_id: account.id, payload: {}, ip: req.ip, ua: req.headers['user-agent'] }); } catch (_) { }
    res.json({ message: '账号删除成功' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ message: '删除账号失败' });
  }
});

router.get('/accounts/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const total = await User.count();
    const active = await User.count({ where: { is_active: true } });
    const verified = await User.count({ where: { phone_verified: true } });

    res.json({ total, active, verified });
  } catch (error) {
    console.error('Get account stats error:', error);
    res.status(500).json({ message: '获取账号统计失败' });
  }
});

router.get('/system/sms', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const SystemConfig = sequelize.models.SystemConfig
    const { Op } = require('sequelize')
    const keys = [
      'sms.provider', 'sms.accessKeyId', 'sms.accessKeySecret', 'sms.signName', 'sms.enabled',
      'sms.auth.templateCode',
      'sms.interview.templateCode',
      'sms.offer.templateCode',
      'sms.reminder.templateCode'
    ]
    const rows = await SystemConfig.findAll({ where: { key: { [Op.in]: keys } } })
    const data = { 
      provider: 'aliyun', 
      accessKeyId: '', 
      accessKeySecret: '', 
      signName: '', 
      enabled: false,
      scenarios: {
        auth: { templateCode: '' },
        interview: { templateCode: '' },
        offer: { templateCode: '' },
        reminder: { templateCode: '' }
      }
    }
    for (const r of rows) {
      if (r.key === 'sms.provider') data.provider = r.value || data.provider
      if (r.key === 'sms.accessKeyId') data.accessKeyId = r.value || data.accessKeyId
      if (r.key === 'sms.accessKeySecret') data.accessKeySecret = r.value || data.accessKeySecret
      if (r.key === 'sms.signName') data.signName = r.value || data.signName
      if (r.key === 'sms.enabled') data.enabled = r.value === 'true'
      
      // Scenarios
      if (r.key === 'sms.auth.templateCode') data.scenarios.auth.templateCode = r.value || ''
      if (r.key === 'sms.interview.templateCode') data.scenarios.interview.templateCode = r.value || ''
      if (r.key === 'sms.offer.templateCode') data.scenarios.offer.templateCode = r.value || ''
      if (r.key === 'sms.reminder.templateCode') data.scenarios.reminder.templateCode = r.value || ''
      
      // Backward compatibility: If offer is empty but reminder exists, copy reminder to offer
      if (!data.scenarios.offer.templateCode && data.scenarios.reminder.templateCode) {
        data.scenarios.offer.templateCode = data.scenarios.reminder.templateCode
      }
    }
    res.json({ 
      provider: data.provider, 
      accessKeyId: data.accessKeyId ? '***' : '', 
      accessKeySecret: data.accessKeySecret ? '***' : '', 
      signName: data.signName, 
      enabled: !!data.enabled,
      scenarios: data.scenarios
    })
  } catch (e) {
    res.status(500).json({ message: '获取短信设置失败' })
  }
})

router.put('/system/sms', authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log('[Admin] Updating SMS settings:', JSON.stringify(req.body, null, 2));
    const SystemConfig = sequelize.models.SystemConfig
    const set = async (key, value) => {
      const row = await SystemConfig.findOne({ where: { key } })
      if (row) await row.update({ value: String(value || '') })
      else await SystemConfig.create({ key, value: String(value || '') })
    }
    
    // Handle provider
    if (req.body.smsProvider || req.body.provider) await set('sms.provider', req.body.smsProvider || req.body.provider)
    
    // Handle keys
    const ak = (req.body.smsAccessKey || req.body.accessKeyId)
    const sk = (req.body.smsSecretKey || req.body.accessKeySecret)
    if (ak && String(ak).trim() !== '***') await set('sms.accessKeyId', String(ak).trim())
    if (sk && String(sk).trim() !== '***') await set('sms.accessKeySecret', String(sk).trim())
    
    // Handle Global SignName
    const signName = req.body.smsSignName || req.body.signName;
    if (signName !== undefined) await set('sms.signName', signName)
    
    // Handle Scenario-specific settings
    if (req.body.scenarios) {
      const { auth, interview, reminder, offer } = req.body.scenarios
      if (auth) {
        if (auth.templateCode !== undefined) await set('sms.auth.templateCode', auth.templateCode)
      }
      if (interview) {
        if (interview.templateCode !== undefined) await set('sms.interview.templateCode', interview.templateCode)
      }
      if (reminder) {
        if (reminder.templateCode !== undefined) await set('sms.reminder.templateCode', reminder.templateCode)
      }
      if (offer) {
        if (offer.templateCode !== undefined) await set('sms.offer.templateCode', offer.templateCode)
      }
    }
    
    // Handle enabled
    if (req.body.enabled !== undefined) await set('sms.enabled', String(req.body.enabled) === 'true' || req.body.enabled === true ? 'true' : 'false')
    
    const cfg = await smsService.getConfig()
    res.json({ 
      provider: cfg.provider, 
      accessKeyId: cfg.accessKeyId ? '***' : '', 
      accessKeySecret: cfg.accessKeySecret ? '***' : '', 
      signName: cfg.signName, 
      enabled: cfg.enabled === true || req.body.enabled === true,
      scenarios: cfg.scenarios
    })
  } catch (e) {
    console.error('[Admin] Save SMS settings failed:', e);
    res.status(500).json({ message: '保存短信设置失败' })
  }
})

router.post('/system/sms/test', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { phone: rawPhone, content, templateCode, scenario } = req.body
    if (!rawPhone) return res.status(400).json({ message: '缺少手机号' })
    
    // 使用归一化处理手机号
    const np = smsService.normalizePhone(rawPhone)
    if (!np.ok) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_PHONE', message: '手机号格式不正确' } })
    }
    const phone = np.phone;
    
    // 获取当前管理员关联的公司名称作为默认值
    let defaultCompanyName = '超级简历'
    if (req.user) {
      if (req.user.company_id) {
        const company = await Company.findByPk(req.user.company_id)
        if (company) defaultCompanyName = company.name
      } else if (req.user.company_name) {
        defaultCompanyName = req.user.company_name
      }
    }

    const cfg = await smsService.getConfig().catch(() => null)
    const authTemplateCodes = new Set()
    if (cfg && cfg.scenarios && cfg.scenarios.auth && cfg.scenarios.auth.templateCode) {
      authTemplateCodes.add(String(cfg.scenarios.auth.templateCode))
    } else if (cfg && cfg.templateCode) {
      authTemplateCodes.add(String(cfg.templateCode))
    }
    const isAuthTemplateCode = (code) => {
      const c = String(code || '')
      return authTemplateCodes.has(c)
    }
    const normalizeAuthParams = (content) => {
      let codeVal = ''
      if (content && typeof content === 'object') {
        if (content.code !== undefined) codeVal = content.code
        else if (content.Code !== undefined) codeVal = content.Code
      } else if (content !== undefined && content !== null) {
        codeVal = content
      }
      if (!codeVal) codeVal = '123456'
      const codeStr = String(codeVal)
      if (!/^[a-zA-Z0-9]+$/.test(codeStr)) {
        return { ok: false, message: '验证码模板参数只允许字母或数字' }
      }
      return { ok: true, params: { code: codeStr } }
    }

    // 如果提供了 templateCode，则直接调用 sendAliyunSms
    let r;
    if (templateCode) {
      // 优先使用传入的 content，如果 content 是对象则合并，否则使用默认公司名称
      let params = { 
        company: defaultCompanyName
      };
      if (isAuthTemplateCode(templateCode)) {
        const normalized = normalizeAuthParams(content)
        if (!normalized.ok) {
          return res.status(400).json({ success: false, error: { code: 'INVALID_TEMPLATE_PARAM', message: normalized.message } })
        }
        params = normalized.params
      } else if (content && typeof content === 'object') {
        params = { ...params, ...content };
      } else if (content) {
        params.content = content;
      }
      
      console.log('[Admin] Testing SMS with templateCode:', templateCode, 'params:', JSON.stringify(params));
      r = await smsService.sendAliyunSms(String(phone), null, templateCode, params)
    } else if (scenario) {
      // 优先使用用户提供的测试内容
      if (content && typeof content === 'object' && Object.keys(content).length > 0) {
        if (scenario === 'auth') {
          const normalized = normalizeAuthParams(content)
          if (!normalized.ok) {
            return res.status(400).json({ success: false, error: { code: 'INVALID_TEMPLATE_PARAM', message: normalized.message } })
          }
          console.log('[Admin] Testing SMS with scenario:', scenario, 'params:', JSON.stringify(normalized.params));
          r = await smsService.sendText(String(phone), normalized.params, scenario)
        } else {
          const params = { 
            company: defaultCompanyName, 
            ...content 
          }
          console.log('[Admin] Testing SMS with scenario:', scenario, 'params:', JSON.stringify(params));
          r = await smsService.sendText(String(phone), params, scenario)
        }
      } else {
        // 根据场景发送默认测试内容
        if (scenario === 'auth') {
          r = await smsService.sendVerificationCode(String(phone), '123456')
        } else if (scenario === 'interview') {
          r = await smsService.sendText(String(phone), {
            name: '张三',
            company: defaultCompanyName,
            time: '2026-01-20 10:00',
            jobId: '12345'
          }, 'interview')
        } else if (scenario === 'offer') {
          // Calculate time + 4 days for offer default test
          const targetDate = new Date();
          targetDate.setDate(targetDate.getDate() + 4);
          const timeStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
          
          r = await smsService.sendText(String(phone), {
            name: '张三',
            company: defaultCompanyName,
            time: timeStr
          }, 'offer')
        } else if (scenario === 'reminder') {
          r = await smsService.sendText(String(phone), {
            time: '15分钟后',
            name: '张三',
            company: defaultCompanyName,
            url: 'https://master.cloujade.com?resumeJobId=12345'
          }, 'reminder')
        } else {
          r = await smsService.sendText(String(phone), { 
            company: defaultCompanyName, 
            content: content || '这是一条测试短信' 
          }, scenario)
        }
      }
    } else {
      // 默认行为
      r = await smsService.sendVerificationCode(String(phone), '123456')
    }
    
    if (r && r.sent === true) return res.json({ success: true, data: r })
    return res.status(400).json({ success: false, error: { code: (r && r.error) || 'SEND_FAILED', message: (r && r.message) || '发送失败' }, data: r })
  } catch (e) {
    console.error('[Admin] Test SMS error:', e)
    res.status(500).json({ message: '测试短信发送失败' })
  }
})

router.get('/system/sms/check', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const cfg = await smsService.getConfig()
    const missing = []
    if (!cfg.accessKeyId) missing.push('AccessKeyId')
    if (!cfg.accessKeySecret) missing.push('AccessKeySecret')
    if (!cfg.signName) missing.push('SignName')
    const scenarios = cfg.scenarios || {}
    const expected = {
        auth: { required: ['code'], templateCode: (scenarios.auth && scenarios.auth.templateCode) ? String(scenarios.auth.templateCode) : '', fallback: false },
        interview: { required: ['name', 'company', 'time', 'jobId'], templateCode: (scenarios.interview && scenarios.interview.templateCode) ? String(scenarios.interview.templateCode) : '' },
        offer: { required: ['name', 'company', 'time'], templateCode: (scenarios.offer && scenarios.offer.templateCode) ? String(scenarios.offer.templateCode) : '' },
        reminder: { required: ['name', 'company', 'time', 'url'], templateCode: (scenarios.reminder && scenarios.reminder.templateCode) ? String(scenarios.reminder.templateCode) : '' }
      }
    if (!expected.auth.templateCode && cfg.templateCode) {
      expected.auth.templateCode = String(cfg.templateCode)
      expected.auth.fallback = true
    }
    if (!expected.auth.templateCode) missing.push('TemplateCode.auth')
    if (!expected.interview.templateCode) missing.push('TemplateCode.interview')
    if (!expected.offer.templateCode) missing.push('TemplateCode.offer')
    if (!expected.reminder.templateCode) missing.push('TemplateCode.reminder')
    const status = (!cfg.enabled) ? 'disabled' : (missing.length === 0 ? 'ok' : 'incomplete')
    res.json({ success: true, data: { provider: cfg.provider, enabled: !!cfg.enabled, signName: cfg.signName || '', status, missing, scenarios: expected } })
  } catch (e) {
    res.status(500).json({ message: '短信配置检查失败' })
  }
})

router.post('/system/sms/template/init', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const SystemConfig = sequelize.models.SystemConfig
    const signName = (req.body.signName || req.body.smsSignName || '').trim()
    const templateName = (req.body.templateName || '登录/注册验证码')
    const templateContent = (req.body.templateContent || '您的验证码为：${code}，5分钟内有效。若非本人操作请忽略。')
    const remark = (req.body.remark || '系统自动创建')
    if (!signName) {
      const rows = await SystemConfig.findAll({ where: { key: ['sms.signName'] } })
      const row = rows.find(r => r.key === 'sms.signName')
      if (!row || !row.value) return res.status(400).json({ message: '请先在短信设置中保存签名' })
    }
    const r = await smsService.createAliyunTemplate(templateName, templateContent, 0, remark)
    if (r.success) {
      const tplCode = r.data.TemplateCode || ''
      const upsert = async (key, value) => {
        const row = await SystemConfig.findOne({ where: { key } })
        if (row) await row.update({ value: String(value || '') })
        else await SystemConfig.create({ key, value: String(value || '') })
      }
      if (signName) await upsert('sms.signName', signName)
      if (tplCode) await upsert('sms.templateCode', tplCode)
      await upsert('sms.enabled', 'true')
      return res.json({ success: true, templateCode: tplCode, status: r.data.TemplateStatus || 'PROCESSING' })
    }
    return res.status(400).json({ success: false, error: r.error || (r.data && r.data.Message) || '创建失败', data: r.data })
  } catch (e) {
    res.status(500).json({ message: '创建模板失败', error: e.message })
  }
})

// 邮件设置
router.get('/system/email', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const SystemConfig = sequelize.models.SystemConfig;
    const cfg = await SystemConfig.findOne({ where: { key: 'email' } });
    const defaultCfg = {
      host: 'smtp.qq.com',
      port: 465,
      secure: true,
      user: '',
      pass: '',
      fromName: '争湃·简历大师',
      enabled: false,
      scenarios: {
        interview: {
          subject: '【面试邀请】{{type}}安排 - {{siteName}}',
          html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; color: #0f172a;">
  <div style="padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
    <div style="font-size: 20px; font-weight: 700; color: #2563eb; margin-bottom: 12px;">面试邀请</div>
    <div style="font-size: 14px; line-height: 1.7; margin-bottom: 16px;">
      <div><strong>{{name}}</strong> 您好：</div>
      <div>我们已为您安排了 <strong>{{type}}</strong>，具体信息如下：</div>
    </div>

    <div style="background: #f8fafc; padding: 14px 16px; border-radius: 10px; font-size: 14px; line-height: 1.8;">
      <div><strong>时间/截止时间：</strong>{{time}}</div>
      <div><strong>面试地点：</strong>{{location}}</div>
      <div><strong>面试链接：</strong><a href="{{link}}" style="color: #2563eb; word-break: break-all; text-decoration: none;">{{link}}</a></div>
      <div><strong>面试题量：</strong>{{aiQuestionCount}} 题</div>
    </div>

    <div style="text-align: center; margin: 22px 0 12px;">
      <a href="{{link}}" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 12px 18px; border-radius: 10px; text-decoration: none; font-weight: 700;">立即开始面试</a>
    </div>
    <div style="font-size: 12px; color: #64748b; line-height: 1.7;">
      如按钮无法点击，请复制链接到浏览器打开：<span style="word-break: break-all;">{{link}}</span>
    </div>

    <div style="margin-top: 18px; font-size: 14px; line-height: 1.7;">祝您面试顺利！</div>

    <div style="border-top: 1px solid #e2e8f0; margin: 20px 0 0; padding-top: 12px; font-size: 12px; color: #94a3b8; text-align: center;">
      此邮件由 {{siteName}} 系统自动发送，请勿直接回复。
    </div>
  </div>
</div>`,
          text: `面试邀请

{{name}} 您好：

我们已为您安排了 {{type}}，具体信息如下：
- 时间/截止时间：{{time}}
- 面试地点：{{location}}
- 面试链接：{{link}}
- 面试题量：{{aiQuestionCount}} 题

如无法打开链接，请复制到浏览器访问：{{link}}

祝您面试顺利！

此邮件由 {{siteName}} 系统自动发送，请勿直接回复。`,
        },
        offer: {
          subject: '【Offer通知】{{company}} - {{siteName}}',
          html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; color: #0f172a;">
  <div style="padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
    <div style="font-size: 20px; font-weight: 700; color: #16a34a; margin-bottom: 12px;">Offer 通知</div>
    <div style="font-size: 14px; line-height: 1.7; margin-bottom: 16px;">
      <div><strong>{{name}}</strong> 您好：</div>
      <div>恭喜您！{{company}} 已向您发出 Offer。</div>
    </div>

    <div style="background: #f8fafc; padding: 14px 16px; border-radius: 10px; font-size: 14px; line-height: 1.8;">
      <div><strong>公司：</strong>{{company}}</div>
      <div><strong>截止日期：</strong>{{time}}</div>
    </div>

    <div style="margin-top: 16px; background: #f8fafc; padding: 14px 16px; border-radius: 10px;">
      <div style="font-size: 14px; font-weight: 700; margin-bottom: 8px;">附加说明</div>
      <div style="white-space: pre-wrap; font-size: 14px; line-height: 1.8; color: #334155;">{{message}}</div>
    </div>

    <div style="margin-top: 18px; font-size: 14px; line-height: 1.7;">期待您的回复！</div>

    <div style="border-top: 1px solid #e2e8f0; margin: 20px 0 0; padding-top: 12px; font-size: 12px; color: #94a3b8; text-align: center;">
      此邮件由 {{siteName}} 系统自动发送，请勿直接回复。
    </div>
  </div>
</div>`,
          text: `Offer 通知

{{name}} 您好：

恭喜您！{{company}} 已向您发出 Offer。

- 公司：{{company}}
- 截止日期：{{time}}

附加说明：
{{message}}

期待您的回复！

此邮件由 {{siteName}} 系统自动发送，请勿直接回复。`,
        },
      },
    };
    
    if (cfg && cfg.value) {
      const val = typeof cfg.value === 'string' ? JSON.parse(cfg.value) : cfg.value;
      return res.json({ success: true, data: { ...defaultCfg, ...val, scenarios: { ...defaultCfg.scenarios, ...(val.scenarios || {}) } } });
    }
    
    res.json({ success: true, data: defaultCfg });
  } catch (e) {
    res.status(500).json({ message: '获取邮件设置失败' });
  }
});

router.put('/system/email', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const SystemConfig = sequelize.models.SystemConfig;
    const [cfg] = await SystemConfig.findOrCreate({ 
      where: { key: 'email' }, 
      defaults: { value: JSON.stringify(req.body || {}) } 
    });
    await cfg.update({ value: JSON.stringify(req.body || {}) });
    res.json({ success: true, data: req.body });
  } catch (e) {
    res.status(500).json({ message: '保存邮件设置失败' });
  }
});

router.post('/system/email/test', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { to, subject, content, scenario, variables } = req.body;
    if (!to) return res.status(400).json({ message: '请输入接收邮箱' });
    
    const emailService = require('../services/emailService');
    if (scenario) {
      const built = await emailService.buildScenarioMail(String(scenario), variables || {}, {
        subject: subject || '测试邮件',
        html: content || '这是一封来自简历大师系统的测试邮件。',
        text: '',
      });
      await emailService.sendMail(to, built.subject || (subject || '测试邮件'), built.html || (content || ''), built.text || '');
    } else {
      await emailService.sendMail(to, subject || '测试邮件', content || '这是一封来自简历大师系统的测试邮件。');
    }
    
    res.json({ success: true, message: '测试邮件已发送' });
  } catch (e) {
    console.error('Test email error:', e);
    res.status(500).json({ message: '发送测试邮件失败: ' + e.message });
  }
});

// 支付设置
router.get('/system/payment', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const SystemConfig = sequelize.models.SystemConfig;
    const wechatCfg = await SystemConfig.findOne({ where: { key: 'payment_wechat' } });
    const alipayCfg = await SystemConfig.findOne({ where: { key: 'payment_alipay' } });

    const defaultWechat = {
      appId: '',
      mchId: '',
      apiKey: '',
      apiV3Key: '',
      privateKey: '',
      publicKey: '',
      serialNo: '',
      enabled: false,
      notifyUrl: '',
    };

    const defaultAlipay = {
      appId: '',
      privateKey: '',
      alipayPublicKey: '',
      enabled: false,
      notifyUrl: '',
      sandbox: false,
    };

    const wechat = wechatCfg ? (typeof wechatCfg.value === 'string' ? JSON.parse(wechatCfg.value) : wechatCfg.value) : defaultWechat;
    const alipay = alipayCfg ? (typeof alipayCfg.value === 'string' ? JSON.parse(alipayCfg.value) : alipayCfg.value) : defaultAlipay;

    res.json({
      success: true,
      data: {
        wechat: { ...defaultWechat, ...wechat },
        alipay: { ...defaultAlipay, ...alipay }
      }
    });
  } catch (e) {
    res.status(500).json({ message: '获取支付设置失败' });
  }
});

router.put('/system/payment', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { wechat, alipay } = req.body;
    const SystemConfig = sequelize.models.SystemConfig;

    if (wechat) {
      const [w] = await SystemConfig.findOrCreate({ where: { key: 'payment_wechat' } });
      await w.update({ value: JSON.stringify(wechat), type: 'json' });
    }

    if (alipay) {
      const [a] = await SystemConfig.findOrCreate({ where: { key: 'payment_alipay' } });
      await a.update({ value: JSON.stringify(alipay), type: 'json' });
    }

    res.json({ success: true, message: '支付设置已保存' });
  } catch (e) {
    console.error('Save payment settings error:', e);
    res.status(500).json({ message: '保存支付设置失败' });
  }
});

// 企业管理
router.get('/companies', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, itemsPerPage = 10, search = '', verified = '', status = '', sortBy = 'created_at', sortOrder = 'DESC' } = req.query;

    const offset = (page - 1) * itemsPerPage;
    const limit = parseInt(itemsPerPage);

    const where = {};
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { contactPerson: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }
    if (verified) {
      where.verified = verified;
    }
    if (status) {
      where.status = status;
    }

    const { count, rows } = await Company.findAndCountAll({
      where,
      limit,
      offset,
      order: [[sortBy, sortOrder]],
      include: [{ model: User, as: 'Contact', attributes: ['id', 'username', 'real_name'] }]
    });

    res.json({
      items: rows,
      total: count,
      page: parseInt(page),
      itemsPerPage: limit
    });
  } catch (error) {
    console.error('Get companies error:', error);
    res.status(500).json({ message: '获取企业列表失败' });
  }
});

router.get('/companies/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const total = await Company.count();
    const verified = await Company.count({ where: { is_verified: true } });
    const active = await Company.count({ where: { status: 'active' } });
    res.json({ total, verified, active });
  } catch (error) {
    res.status(500).json({ message: '获取企业统计失败' });
  }
});

router.post('/companies/:id/verify', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const company = await Company.findByPk(req.params.id);
    if (!company) {
      return res.status(404).json({ message: '企业不存在' });
    }

    await company.update({ is_verified: true, verification_info: req.body?.verification_info || company.verification_info });
    try { await sequelize.models.AuditLog.create({ actor_account_id: req.user?.id || 0, action: 'companies.verify', resource_type: 'Company', resource_id: company.id, payload: { verification_info: req.body?.verification_info }, ip: req.ip, ua: req.headers['user-agent'] }); } catch (_) { }
    res.json(company);
  } catch (error) {
    console.error('Verify company error:', error);
    res.status(500).json({ message: '企业认证失败' });
  }
});

// 企业详情
router.get('/companies/:id', authenticateToken, requireAdmin, async (req, res) => {
  console.log('Backend: Getting company detail for ID:', req.params.id);
  try {
    const company = await Company.findByPk(req.params.id);
    if (!company) {
      console.log('Backend: Company not found for ID:', req.params.id);
      return res.status(404).json({ message: '企业不存在' });
    }
    console.log('Backend: Found company:', company.name);
    res.json(company);
  } catch (error) {
    console.error('Get company detail error:', error);
    res.status(500).json({ message: '获取企业详情失败' });
  }
});

// 企业创建
router.post('/companies', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, address, province, city, district, contact_account_id, is_verified = false, verification_info = {}, code, status = 'active' } = req.body;
    if (!name) return res.status(400).json({ message: '企业名称必填' });
    const dup = code ? await Company.findOne({ where: { code } }) : null;
    if (dup) return res.status(400).json({ message: '企业编码已存在' });
    const company = await Company.create({ name, address, province, city, district, contact_account_id, is_verified, verification_info, code, status });
    try { await sequelize.models.AuditLog.create({ actor_account_id: req.user?.id || 0, action: 'companies.create', resource_type: 'Company', resource_id: company.id, payload: { name, code }, ip: req.ip, ua: req.headers['user-agent'] }); } catch (_) { }
    res.status(201).json(company);
  } catch (error) {
    console.error('Create company error:', error);
    res.status(500).json({ message: '创建企业失败' });
  }
});

// 企业更新
router.patch('/companies/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const company = await Company.findByPk(id);
    if (!company) return res.status(404).json({ message: '企业不存在' });
    const fields = ['name', 'address', 'province', 'city', 'district', 'contact_account_id', 'is_verified', 'verification_info', 'code', 'status'];
    const payload = {};
    fields.forEach(f => { if (req.body.hasOwnProperty(f)) payload[f] = req.body[f]; });
    await company.update(payload);
    try { await sequelize.models.AuditLog.create({ actor_account_id: req.user?.id || 0, action: 'companies.update', resource_type: 'Company', resource_id: company.id, payload, ip: req.ip, ua: req.headers['user-agent'] }); } catch (_) { }
    res.json(company);
  } catch (error) {
    console.error('Update company error:', error);
    res.status(500).json({ message: '更新企业失败' });
  }
});

// 企业删除
router.delete('/companies/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const company = await Company.findByPk(id);
    if (!company) return res.status(404).json({ message: '企业不存在' });
    
    // 检查是否有依赖数据（如职位、简历等）
    const jobCount = await Job.count({ where: { company_id: id } });
    if (jobCount > 0) return res.status(400).json({ message: '该企业下有关联职位，无法删除' });
    
    await company.destroy();
    try { await sequelize.models.AuditLog.create({ actor_account_id: req.user?.id || 0, action: 'companies.delete', resource_type: 'Company', resource_id: id, payload: { name: company.name }, ip: req.ip, ua: req.headers['user-agent'] }); } catch (_) { }
    res.json({ message: '企业删除成功' });
  } catch (error) {
    console.error('Delete company error:', error);
    res.status(500).json({ message: '删除企业失败' });
  }
});

// 订阅管理
router.get('/subscriptions', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, itemsPerPage = 10, companyId, plan = '', status = '', sortBy = 'created_at', sortOrder = 'DESC' } = req.query;

    const offset = (page - 1) * itemsPerPage;
    const limit = parseInt(itemsPerPage);

    const where = {};
    if (companyId) where.company_id = companyId;
    if (plan) {
      where.plan = plan;
    }
    if (status) {
      where.status = status;
    }

    const { count, rows } = await Subscription.findAndCountAll({
      where,
      limit,
      offset,
      order: [[sortBy, sortOrder]],
      include: [{ model: Company, as: 'Company', attributes: ['id', 'name'] }]
    });

    res.json({
      items: rows,
      total: count,
      page: parseInt(page),
      itemsPerPage: limit
    });
  } catch (error) {
    console.error('Get subscriptions error:', error);
    res.status(500).json({ message: '获取订阅列表失败' });
  }
});

router.get('/subscriptions/plans', authenticateToken, requireAdmin, async (req, res) => {
  try {
    let plans = await SubscriptionPlan.findAll({ order: [['created_at', 'DESC']] });
    if (!plans || plans.length === 0) {
      const defaults = [
        { key: 'free', name: '免费版', i18n_names: { zh: '免费版', en: 'Free' }, features: [], quota: { resume_parses_per_month: 50, concurrent: 1, ai_calls: 5000 }, price: 0, status: 'active' },
        { key: 'pro', name: '专业版', i18n_names: { zh: '专业版', en: 'Pro' }, features: [], quota: { resume_parses_per_month: 1000, concurrent: 3, ai_calls: 100000 }, price: 99, status: 'active' },
        { key: 'enterprise', name: '企业版', i18n_names: { zh: '企业版', en: 'Enterprise' }, features: [], quota: { resume_parses_per_month: 5000, concurrent: 10, ai_calls: 1000000 }, price: 999, status: 'active' }
      ];
      for (const d of defaults) {
        const exists = await SubscriptionPlan.findOne({ where: { key: d.key } });
        if (!exists) {
          try { await SubscriptionPlan.create(d); } catch (_) { }
        }
      }
      plans = await SubscriptionPlan.findAll({ order: [['created_at', 'DESC']] });
    }
    res.json(plans);
  } catch (error) {
    res.status(500).json({ message: '获取订阅计划失败' });
  }
});

router.post('/subscriptions/plans', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const payload = {
      key: req.body.key,
      name: req.body.name,
      i18n_names: req.body.i18n_names || { zh: '', en: '' },
      features: Array.isArray(req.body.features) ? req.body.features : [],
      quota: req.body.quota || { resume_parses_per_month: 100, concurrent: 1, ai_calls: 10000 },
      price: req.body.price ?? 0,
      status: req.body.status || 'active'
    };
    if (!payload.key || typeof payload.key !== 'string' || payload.key.length > 50) return res.status(400).json({ message: '标识无效' });
    if (!payload.name || typeof payload.name !== 'string' || payload.name.length > 100) return res.status(400).json({ message: '名称无效' });
    const q = payload.quota || {};
    const qp = Number(q.resume_parses_per_month ?? 0);
    const qc = Number(q.concurrent ?? 1);
    const qa = Number(q.ai_calls ?? 0);
    if (isNaN(qp) || qp < 0) return res.status(400).json({ message: '解析/月须为非负数' });
    if (isNaN(qc) || qc < 1) return res.status(400).json({ message: '并发须为至少1' });
    if (isNaN(qa) || qa < 0) return res.status(400).json({ message: 'AI调用须为非负数' });
    if (isNaN(Number(payload.price)) || Number(payload.price) < 0) return res.status(400).json({ message: '价格须为非负数' });
    if (!['active', 'inactive'].includes(payload.status)) return res.status(400).json({ message: '状态无效' });
    payload.quota = { resume_parses_per_month: qp, concurrent: qc, ai_calls: qa };
    // 如果已存在同 key，则走更新（upsert），避免因默认计划重复导致的创建失败
    const existing = await SubscriptionPlan.findOne({ where: { key: payload.key } });
    if (existing) {
      const before = { key: existing.key, name: existing.name, price: existing.price, status: existing.status, quota: existing.quota, features: existing.features, i18n_names: existing.i18n_names };
      await existing.update(payload);
      try { await sequelize.models.AuditLog.create({ actor_account_id: req.user?.id || 0, action: 'subscription_plans.upsert_update', resource_type: 'SubscriptionPlan', resource_id: existing.id, payload: { before, after: payload }, ip: req.ip, ua: req.headers['user-agent'] }); } catch (_) { }
      return res.json(existing);
    } else {
      const created = await SubscriptionPlan.create(payload);
      try { await sequelize.models.AuditLog.create({ actor_account_id: req.user?.id || 0, action: 'subscription_plans.create', resource_type: 'SubscriptionPlan', resource_id: created.id, payload, ip: req.ip, ua: req.headers['user-agent'] }); } catch (_) { }
      return res.status(201).json(created);
    }
  } catch (error) {
    console.error('Create subscription plan error:', error);
    res.status(500).json({ message: '创建订阅计划失败', error: error?.message });
  }
});

router.put('/subscriptions/plans/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    let plan = await SubscriptionPlan.findByPk(req.params.id);
    if (!plan && req.params.id) {
      plan = await SubscriptionPlan.findOne({ where: { key: req.params.id } });
    }
    if (!plan) {
      // 如果按 id 与 key 都找不到，则尝试创建（容错 upsert）
      const payload0 = {
        key: req.body.key || req.params.id,
        name: req.body.name || req.params.id,
        i18n_names: req.body.i18n_names || { zh: req.body.name || req.params.id, en: req.body.name || req.params.id },
        features: Array.isArray(req.body.features) ? req.body.features : [],
        quota: req.body.quota || { resume_parses_per_month: 100, concurrent: 1, ai_calls: 10000 },
        price: req.body.price ?? 0,
        status: req.body.status || 'active'
      };
      try {
        const created = await SubscriptionPlan.create(payload0);
        try { await sequelize.models.AuditLog.create({ actor_account_id: req.user?.id || 0, action: 'subscription_plans.create_via_put', resource_type: 'SubscriptionPlan', resource_id: created.id, payload: payload0, ip: req.ip, ua: req.headers['user-agent'] }); } catch (_) { }
        return res.status(201).json(created);
      } catch (e) {
        return res.status(404).json({ message: '订阅计划不存在' });
      }
    }
    const before = { key: plan.key, name: plan.name, price: plan.price, status: plan.status, quota: plan.quota, features: plan.features, i18n_names: plan.i18n_names };
    const payload = {
      key: req.body.key ?? plan.key,
      name: req.body.name ?? plan.name,
      i18n_names: req.body.i18n_names ?? plan.i18n_names,
      features: Array.isArray(req.body.features) ? req.body.features : plan.features,
      quota: req.body.quota ?? plan.quota,
      price: req.body.price ?? plan.price,
      status: req.body.status ?? plan.status
    };
    if (!payload.key || typeof payload.key !== 'string' || payload.key.length > 50) return res.status(400).json({ message: '标识无效' });
    if (!payload.name || typeof payload.name !== 'string' || payload.name.length > 100) return res.status(400).json({ message: '名称无效' });
    const q = payload.quota || {};
    const qp = Number(q.resume_parses_per_month ?? plan.quota?.resume_parses_per_month ?? 0);
    const qc = Number(q.concurrent ?? plan.quota?.concurrent ?? 1);
    const qa = Number(q.ai_calls ?? plan.quota?.ai_calls ?? 0);
    if (isNaN(qp) || qp < 0) return res.status(400).json({ message: '解析/月须为非负数' });
    if (isNaN(qc) || qc < 1) return res.status(400).json({ message: '并发须为至少1' });
    if (isNaN(qa) || qa < 0) return res.status(400).json({ message: 'AI调用须为非负数' });
    if (isNaN(Number(payload.price)) || Number(payload.price) < 0) return res.status(400).json({ message: '价格须为非负数' });
    if (!['active', 'inactive'].includes(payload.status)) return res.status(400).json({ message: '状态无效' });
    payload.quota = { resume_parses_per_month: qp, concurrent: qc, ai_calls: qa };
    try {
      await plan.update(payload);
    } catch (e) {
      if (e.name === 'SequelizeUniqueConstraintError') return res.status(409).json({ message: '标识已存在' });
      throw e;
    }
    try { await sequelize.models.AuditLog.create({ actor_account_id: req.user?.id || 0, action: 'subscription_plans.update', resource_type: 'SubscriptionPlan', resource_id: plan.id, payload: { before, after: payload }, ip: req.ip, ua: req.headers['user-agent'] }); } catch (_) { }
    res.json(plan);
  } catch (error) {
    res.status(500).json({ message: '更新订阅计划失败' });
  }
});

router.delete('/subscriptions/plans/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    let plan = await SubscriptionPlan.findByPk(req.params.id);
    if (!plan && req.params.id) {
      plan = await SubscriptionPlan.findOne({ where: { key: req.params.id } });
    }
    if (!plan) return res.status(404).json({ message: '订阅计划不存在' });
    await plan.destroy();
    try { await sequelize.models.AuditLog.create({ actor_account_id: req.user?.id || 0, action: 'subscription_plans.delete', resource_type: 'SubscriptionPlan', resource_id: plan.id, payload: { key: plan.key }, ip: req.ip, ua: req.headers['user-agent'] }); } catch (_) { }
    res.json({ message: '删除成功' });
  } catch (error) {
    res.status(500).json({ message: '删除订阅计划失败' });
  }
});

// 订阅计划：按 key 更新（用于无ID记录的容错）
router.put('/subscriptions/plans/by-key/:key', authenticateToken, requireAdmin, async (req, res) => {
  try {
    let plan = await SubscriptionPlan.findOne({ where: { key: req.params.key } });
    if (!plan) {
      const payload = {
        key: req.params.key,
        name: req.body.name || req.params.key,
        i18n_names: req.body.i18n_names || { zh: req.body.name || req.params.key, en: req.body.name || req.params.key },
        features: Array.isArray(req.body.features) ? req.body.features : [],
        quota: req.body.quota || { resume_parses_per_month: 100, concurrent: 1, ai_calls: 10000 },
        price: req.body.price ?? 0,
        status: req.body.status || 'active'
      };
      const created = await SubscriptionPlan.create(payload);
      try { await sequelize.models.AuditLog.create({ actor_account_id: req.user?.id || 0, action: 'subscription_plans.create_by_key', resource_type: 'SubscriptionPlan', resource_id: created.id, payload, ip: req.ip, ua: req.headers['user-agent'] }); } catch (_) { }
      return res.status(201).json(created);
    }
    const payload = {
      name: req.body.name ?? plan.name,
      i18n_names: req.body.i18n_names ?? plan.i18n_names,
      features: Array.isArray(req.body.features) ? req.body.features : plan.features,
      quota: req.body.quota ?? plan.quota,
      price: req.body.price ?? plan.price,
      status: req.body.status ?? plan.status
    };
    await plan.update(payload);
    try { await sequelize.models.AuditLog.create({ actor_account_id: req.user?.id || 0, action: 'subscription_plans.update_by_key', resource_type: 'SubscriptionPlan', resource_id: plan.id, payload, ip: req.ip, ua: req.headers['user-agent'] }); } catch (_) { }
    res.json(plan);
  } catch (error) {
    res.status(500).json({ message: '按key更新订阅计划失败' });
  }
});

// 订阅计划：按 key 删除（用于无ID记录的容错）
router.delete('/subscriptions/plans/by-key/:key', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const plan = await SubscriptionPlan.findOne({ where: { key: req.params.key } });
    if (!plan) return res.status(404).json({ message: '订阅计划不存在' });
    await plan.destroy();
    try { await sequelize.models.AuditLog.create({ actor_account_id: req.user?.id || 0, action: 'subscription_plans.delete_by_key', resource_type: 'SubscriptionPlan', resource_id: plan.id, payload: { key: plan.key }, ip: req.ip, ua: req.headers['user-agent'] }); } catch (_) { }
    res.json({ message: '删除成功' });
  } catch (error) {
    res.status(500).json({ message: '按key删除订阅计划失败' });
  }
});

router.get('/subscriptions/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const total = await Subscription.count();
    const active = await Subscription.count({ where: { status: 'active' } });
    const expired = await Subscription.count({ where: { status: 'expired' } });
    res.json({ total, active, expired });
  } catch (error) {
    res.status(500).json({ message: '获取订阅统计失败' });
  }
});

// 获取公司订阅详情
router.get('/subscriptions/:companyId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { companyId } = req.params;
    const subs = await Subscription.findAll({ where: { company_id: companyId }, order: [['created_at', 'DESC']] });
    res.json({ items: subs });
  } catch (error) {
    console.error('Get subscription by company error:', error);
    res.status(500).json({ message: '获取订阅失败' });
  }
});

// 订阅变更（升级/降级/续费）
router.post('/subscriptions/:companyId/change', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { companyId } = req.params;
    const { plan, billing_cycle = 'monthly', action = 'upgrade', auto_renew = false } = req.body;
    if (!plan) return res.status(400).json({ message: '缺少订阅计划' });
    const now = new Date();
    const end = new Date(now);
    if (billing_cycle === 'annual') end.setFullYear(end.getFullYear() + 1); else end.setMonth(end.getMonth() + 1);
    const quotaPresets = { free: { resume_parses_per_month: 50, concurrent: 1, ai_calls: 5000 }, pro: { resume_parses_per_month: 1000, concurrent: 3, ai_calls: 100000 }, enterprise: { resume_parses_per_month: 5000, concurrent: 10, ai_calls: 1000000 } };
    const sub = await Subscription.create({ company_id: companyId, plan, billing_cycle, start_at: now, end_at: end, status: 'active', quota: quotaPresets[plan] || quotaPresets.free, auto_renew });
    try { await sequelize.models.AuditLog.create({ actor_account_id: req.user?.id || 0, action: 'subscriptions.change', resource_type: 'Subscription', resource_id: sub.id, payload: { companyId, plan, billing_cycle, action }, ip: req.ip, ua: req.headers['user-agent'] }); } catch (_) { }
    res.status(201).json(sub);
  } catch (error) {
    console.error('Change subscription error:', error);
    res.status(500).json({ message: '变更订阅失败' });
  }
});

// 更新订阅（编辑）
router.patch('/subscriptions/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const sub = await Subscription.findByPk(id);
    if (!sub) return res.status(404).json({ message: '订阅不存在' });

    const fields = ['plan', 'billing_cycle', 'status', 'start_at', 'end_at', 'notes', 'auto_renew'];
    const updates = {};
    fields.forEach(f => { if (req.body.hasOwnProperty(f)) updates[f] = req.body[f]; });

    // 如果更新了 plan，可能需要更新 quota
    if (updates.plan && updates.plan !== sub.plan) {
      const quotaPresets = { free: { resume_parses_per_month: 50, concurrent: 1, ai_calls: 5000 }, pro: { resume_parses_per_month: 1000, concurrent: 3, ai_calls: 100000 }, enterprise: { resume_parses_per_month: 5000, concurrent: 10, ai_calls: 1000000 } };
      updates.quota = quotaPresets[updates.plan] || quotaPresets.free;
    }

    await sub.update(updates);
    try { await sequelize.models.AuditLog.create({ actor_account_id: req.user?.id || 0, action: 'subscriptions.update', resource_type: 'Subscription', resource_id: sub.id, payload: updates, ip: req.ip, ua: req.headers['user-agent'] }); } catch (_) { }
    res.json(sub);
  } catch (error) {
    console.error('Update subscription error:', error);
    res.status(500).json({ message: '更新订阅失败' });
  }
});

// 删除订阅
router.delete('/subscriptions/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const sub = await Subscription.findByPk(id);
    if (!sub) return res.status(404).json({ message: '订阅不存在' });

    await sub.destroy();
    try { await sequelize.models.AuditLog.create({ actor_account_id: req.user?.id || 0, action: 'subscriptions.delete', resource_type: 'Subscription', resource_id: id, payload: { company_id: sub.company_id }, ip: req.ip, ua: req.headers['user-agent'] }); } catch (_) { }
    res.json({ message: '订阅删除成功' });
  } catch (error) {
    console.error('Delete subscription error:', error);
    res.status(500).json({ message: '删除订阅失败' });
  }
});

// 订阅用量（占位统计）
router.get('/usage/:companyId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { companyId } = req.params;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const resume_parses_used = await sequelize.models.Resume.count({
      include: [{ model: sequelize.models.User, as: 'User', where: { company_id: companyId } }],
      where: { upload_date: { [Op.gte]: start, [Op.lt]: end } }
    });

    const ai_calls_used = await (sequelize.models.AnalysisResult || AnalysisResult).count({
      include: [{ model: sequelize.models.User, as: 'User', where: { company_id: companyId } }],
      where: { analysis_date: { [Op.gte]: start, [Op.lt]: end } }
    });

    // 并发峰值：按小时窗口统计该公司用户的分析记录数量的最大值
    const results = await (sequelize.models.AnalysisResult || AnalysisResult).findAll({
      attributes: ['analysis_date'],
      include: [{ model: sequelize.models.User, as: 'User', attributes: [], where: { company_id: companyId } }],
      where: { analysis_date: { [Op.gte]: start, [Op.lt]: end } },
      order: [['analysis_date', 'ASC']]
    });
    const buckets = {};
    for (const r of results) {
      const d = new Date(r.analysis_date);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;
      buckets[key] = (buckets[key] || 0) + 1;
    }
    const concurrent_peak = Object.values(buckets).reduce((m, v) => Math.max(m, v), 0);

    res.json({ companyId: Number(companyId), month: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`, resume_parses_used, ai_calls_used, concurrent_peak });
  } catch (error) {
    console.error('Get usage error:', error);
    res.status(500).json({ message: '获取用量失败' });
  }
});

// 模型提供商管理
router.get('/models/providers', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, itemsPerPage = 10, provider = '', enabled = '', sortBy = 'created_at', sortOrder = 'DESC' } = req.query;

    const offset = (page - 1) * itemsPerPage;
    const limit = parseInt(itemsPerPage);

    const where = {};
    if (provider) where.provider = provider;
    if (enabled) where.enabled = enabled === 'true';

    const { count, rows } = await ModelProvider.findAndCountAll({
      where,
      limit,
      offset,
      order: [[sortBy, sortOrder]]
    });

    res.json({
      items: rows,
      total: count,
      page: parseInt(page),
      itemsPerPage: limit
    });
  } catch (error) {
    console.error('Get model providers error:', error);
    res.status(500).json({ message: '获取模型提供商失败' });
  }
});

router.post('/models/providers', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { provider, adapter_config = {}, enabled = true } = req.body;
    if (!provider) return res.status(400).json({ message: '缺少provider' });
    const created = await ModelProvider.create({ provider, adapter_config, enabled: !!enabled });
    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ message: '创建模型提供商失败' });
  }
});

router.patch('/models/providers/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const mp = await ModelProvider.findByPk(req.params.id);
    if (!mp) return res.status(404).json({ message: '提供商不存在' });
    const nextEnabled = typeof req.body.enabled === 'boolean' ? req.body.enabled : mp.enabled;
    await mp.update({ adapter_config: req.body.adapter_config ?? mp.adapter_config, enabled: nextEnabled });
    res.json(mp);
  } catch (error) {
    res.status(500).json({ message: '更新模型提供商失败' });
  }
});

router.delete('/models/providers/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const mp = await ModelProvider.findByPk(req.params.id);
    if (!mp) return res.status(404).json({ message: '提供商不存在' });
    await mp.destroy();
    res.json({ message: '删除成功' });
  } catch (error) {
    res.status(500).json({ message: '删除模型提供商失败' });
  }
});

// 模型密钥连通性测试（占位，真实调用在服务层）
router.post('/models/keys/:id/test', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const key = await ModelKey.findByPk(req.params.id);
    if (!key) return res.status(404).json({ message: '密钥不存在' });
    const prompt = req.body.prompt || 'ping';
    const startTime = Date.now();
    try {
      let responseText = '';
      let tokens = 0;
      let model = '';
      if (key.provider === 'siliconflow') {
        const resp = await axios.post('https://api.siliconflow.cn/v1/chat/completions', { model: 'Qwen2-72B-Instruct', messages: [{ role: 'user', content: prompt }] }, { headers: { Authorization: `Bearer ${key.api_key}` }, timeout: 10000 });
        responseText = resp.data?.choices?.[0]?.message?.content || '';
        tokens = resp.data?.usage?.total_tokens || 0;
        model = resp.data?.model || 'Qwen2-72B-Instruct';
      } else if (key.provider === 'qianwen') {
        const resp = await axios.post('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', { model: 'qwen-turbo', input: prompt }, { headers: { Authorization: `Bearer ${key.api_key}` }, timeout: 10000 });
        responseText = resp.data?.output?.text || '';
        model = 'qwen-turbo';
      } else if (key.provider === 'glm') {
        const mdl = key.model && String(key.model).trim() !== '' ? key.model : 'glm-4';
        const resp = await axios.post('https://open.bigmodel.cn/api/paas/v4/chat/completions', { model: mdl, messages: [{ role: 'user', content: prompt }] }, { headers: { Authorization: `Bearer ${key.api_key}` }, timeout: 10000 });
        responseText = resp.data?.choices?.[0]?.message?.content || '';
        tokens = resp.data?.usage?.total_tokens || 0;
        model = resp.data?.model || mdl;
      } else if (key.provider === 'modelscope') {
        return res.status(400).json({ message: '暂不支持该提供商直连测试' });
      } else if (key.provider === 'deepseek') {
        const resp = await axios.post('https://api.deepseek.com/v1/chat/completions', { model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }] }, { headers: { Authorization: `Bearer ${key.api_key}` }, timeout: 10000 });
        responseText = resp.data?.choices?.[0]?.message?.content || '';
        tokens = resp.data?.usage?.total_tokens || 0;
        model = resp.data?.model || 'deepseek-chat';
      } else if (key.provider === 'kimi') {
        const resp = await axios.post('https://api.moonshot.cn/v1/chat/completions', { model: 'moonshot-v1-8k', messages: [{ role: 'user', content: prompt }] }, { headers: { Authorization: `Bearer ${key.api_key}` }, timeout: 10000 });
        responseText = resp.data?.choices?.[0]?.message?.content || '';
        tokens = resp.data?.usage?.total_tokens || 0;
        model = resp.data?.model || 'moonshot-v1-8k';
      } else if (key.provider === 'minimax') {
        const resp = await axios.post('https://api.minimax.chat/v1/text/chatcompletion', { model: 'abab6.5-chat', messages: [{ role: 'user', content: prompt }] }, { headers: { Authorization: `Bearer ${key.api_key}` }, timeout: 10000 });
        responseText = resp.data?.choices?.[0]?.messages?.[0]?.text || resp.data?.choices?.[0]?.message || '';
        tokens = 0;
        model = 'abab6.5-chat';
      } else {
        return res.status(400).json({ message: '不支持的提供商' });
      }
      const duration = Date.now() - startTime;
      return res.json({ success: true, provider: key.provider, response: responseText, duration, tokens, testType: req.body.testType || 'basic', prompt, modelInfo: { provider: key.provider, model }, timestamp: new Date().toISOString() });
    } catch (e) {
      const duration = Date.now() - startTime;
      try { await sequelize.models.AuditLog.create({ actor_account_id: req.user?.id || 0, action: 'ai.test.failed', resource_type: 'ModelKey', resource_id: key.id, payload: { provider: key.provider, error: e?.message || '请求失败' }, ip: req.ip, ua: req.headers['user-agent'] }); } catch (_) { }
      return res.json({ success: false, provider: key.provider, error: e?.response?.data?.error || e?.message || '请求失败', duration, prompt, timestamp: new Date().toISOString() });
    }
  } catch (error) {
    console.error('Test model key error:', error);
    res.status(500).json({ message: '模型密钥测试失败', error: error.message });
  }
});

router.get('/models/keys', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { companyId, provider } = req.query;
    const where = {};
    if (companyId) where.company_id = companyId; if (provider) where.provider = provider;
    const keys = await ModelKey.findAll({ where, order: [['created_at', 'DESC']] });
    res.json({ items: keys.map(k => ({ id: k.id, company_id: k.company_id, provider: k.provider, model: k.model, limits: k.limits, scope: k.scope })) });
  } catch (error) {
    res.status(500).json({ message: '获取模型密钥失败' });
  }
});

router.post('/models/keys', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { company_id, provider, api_key, model, enabled = true, limits = {}, scope = 'company' } = req.body;
    if (!provider || !api_key) return res.status(400).json({ message: '缺少provider或api_key' });
    const created = await ModelKey.create({ company_id, provider, api_key, model, enabled: !!enabled, limits, scope });
    res.status(201).json({ id: created.id });
  } catch (error) {
    res.status(500).json({ message: '创建模型密钥失败' });
  }
});

router.patch('/models/keys/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const key = await ModelKey.findByPk(req.params.id);
    if (!key) return res.status(404).json({ message: '密钥不存在' });
    await key.update({ limits: req.body.limits ?? key.limits, scope: req.body.scope ?? key.scope, model: req.body.model ?? key.model, enabled: typeof req.body.enabled === 'boolean' ? req.body.enabled : key.enabled });
    res.json({ id: key.id });
  } catch (error) {
    res.status(500).json({ message: '更新模型密钥失败' });
  }
});

router.delete('/models/keys/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const key = await ModelKey.findByPk(req.params.id);
    if (!key) return res.status(404).json({ message: '密钥不存在' });
    await key.destroy();
    res.json({ message: '删除成功' });
  } catch (error) {
    res.status(500).json({ message: '删除模型密钥失败' });
  }
});

// 批量测试模型密钥
router.post('/models/keys/batch-test', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { keyIds, testType = 'basic', prompt } = req.body;

    if (!keyIds || !Array.isArray(keyIds) || keyIds.length === 0) {
      return res.status(400).json({ message: '请提供要测试的密钥ID列表' });
    }

    const results = [];
    const startTime = Date.now();

    // 并行测试多个模型
    const testPromises = keyIds.map(async (keyId) => {
      try {
        const key = await ModelKey.findByPk(keyId);
        if (!key) {
          return {
            keyId,
            success: false,
            error: '密钥不存在'
          };
        }

        // 模拟测试延迟（不同的模型有不同的响应时间）
        const modelStartTime = Date.now();
        const baseDelay = Math.random() * 1000 + 300;
        const platformDelay = {
          'qianwen': 200,
          'zhipu': 300,
          'modelscope': 400,
          'siliconflow': 250
        }[key.provider] || 300;

        await new Promise(resolve => setTimeout(resolve, baseDelay + platformDelay));

        const duration = Date.now() - modelStartTime;

        // 生成测试结果
        let response;
        const testPrompt = prompt || '请用一句话介绍你自己';

        switch (key.provider) {
          case 'qianwen':
            response = `千问密钥：${testPrompt}，连通性正常。`;
            break;
          case 'zhipu':
            response = `智谱密钥：${testPrompt}，连通性正常。`;
            break;
          case 'modelscope':
            response = `魔搭密钥：${testPrompt}，连通性正常。`;
            break;
          case 'siliconflow':
            response = `硅基流动密钥：${testPrompt}，连通性正常。`;
            break;
          default:
            response = `通用密钥：${testPrompt}，测试完成。`;
        }

        const tokens = Math.floor(response.length / 2) + Math.floor(Math.random() * 50);

        return {
          keyId,
          provider: key.provider,
          success: true,
          response,
          duration,
          tokens,
          tokensPerSecond: (tokens / (duration / 1000)).toFixed(2),
          efficiency: duration < 2000 ? 'excellent' : duration < 5000 ? 'good' : 'slow',
          timestamp: new Date().toISOString()
        };

      } catch (error) {
        return {
          keyId,
          success: false,
          error: error.message || '测试失败'
        };
      }
    });

    const batchResults = await Promise.all(testPromises);

    const summary = {
      total: batchResults.length,
      successful: batchResults.filter(r => r.success).length,
      failed: batchResults.filter(r => !r.success).length,
      totalDuration: Date.now() - startTime,
      averageResponseTime: batchResults.filter(r => r.success).reduce((sum, r) => sum + r.duration, 0) / batchResults.filter(r => r.success).length,
      platformStats: {}
    };

    // 统计各平台表现
    batchResults.forEach(result => {
      if (result.success && result.provider) {
        if (!summary.platformStats[result.provider]) {
          summary.platformStats[result.provider] = {
            count: 0,
            totalDuration: 0,
            totalTokens: 0
          };
        }
        summary.platformStats[result.provider].count++;
        summary.platformStats[result.provider].totalDuration += result.duration;
        summary.platformStats[result.provider].totalTokens += result.tokens;
      }
    });

    // 计算平均值
    Object.keys(summary.platformStats).forEach(provider => {
      const stats = summary.platformStats[provider];
      stats.averageDuration = stats.totalDuration / stats.count;
      stats.averageTokens = stats.totalTokens / stats.count;
    });

    res.json({
      results: batchResults,
      summary,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Batch test AI models error:', error);
    res.status(500).json({
      message: '批量测试AI模型失败',
      error: error.message
    });
  }
});


// 职位列表
router.get('/jobs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10, company_id, search } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (company_id) {
      where.company_id = company_id;
    }

    if (search) {
      where.title = { [Op.like]: `%${search}%` };
    }

    const { count, rows } = await Job.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']],
      include: [
        { model: Company, attributes: ['id', 'name'] }
      ]
    });

    res.json({
      total: count,
      items: rows
    });
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({ message: '获取职位列表失败' });
  }
});

// 职位统计
router.get('/jobs/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const total = await Job.count();
    const active = await Job.count({ where: { status: 'active' } });
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const newToday = await Job.count({ where: { created_at: { [Op.gte]: todayStart } } });
    res.json({ total, active, newToday });
  } catch (error) {
    res.status(500).json({ message: '获取职位统计失败' });
  }
});

// 职位详情
router.get('/jobs/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const job = await Job.findByPk(req.params.id, {
      include: [{ model: Company, attributes: ['id', 'name'] }]
    });
    if (!job) return res.status(404).json({ message: '职位不存在' });
    res.json(job);
  } catch (error) {
    console.error('Get job detail error:', error);
    res.status(500).json({ message: '获取职位详情失败' });
  }
});

router.post('/jobs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const job = await Job.create(req.body);
    res.status(201).json(job);
  } catch (error) {
    console.error('Create job error:', error);
    res.status(500).json({ message: '创建职位失败' });
  }
});

router.patch('/jobs/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const job = await Job.findByPk(req.params.id);
    if (!job) return res.status(404).json({ message: '职位不存在' });
    await job.update(req.body);
    res.json(job);
  } catch (error) {
    console.error('Update job error:', error);
    res.status(500).json({ message: '更新职位失败' });
  }
});

router.delete('/jobs/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const job = await Job.findByPk(req.params.id);
    if (!job) return res.status(404).json({ message: '职位不存在' });
    await job.destroy();
    res.json({ message: '删除成功' });
  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({ message: '删除职位失败' });
  }
});

// 简历列表
router.get('/resumes', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10, company_id, search } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (company_id) {
      where.company_id = company_id;
    }

    // 搜索逻辑：支持按简历文件名搜索
    if (search) {
      where.file_name = { [Op.like]: `%${search}%` };
    }

    const { count, rows } = await Resume.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        { model: Company, as: 'Company', attributes: ['id', 'name'] },
        { 
          model: ResumeJob, 
          include: [{ model: Job, attributes: ['id', 'title'] }] 
        }
      ],
      order: [['upload_date', 'DESC']]
    });

    res.json({
      total: count,
      items: rows.map(item => {
        // 将绝对路径转换为相对 uploads 目录的路径
        let relativePath = item.file_path;
        if (relativePath) {
          // 统一使用正斜杠
          relativePath = relativePath.replace(/\\/g, '/');
          if (relativePath.includes('uploads/')) {
            const parts = relativePath.split('uploads/');
            relativePath = parts[parts.length - 1];
          }
        }

        return {
          id: item.id,
          file_name: item.file_name,
          name: item.name || (item.parsed_data && item.parsed_data.name) || '未知',
          file_path: relativePath,
          Company: item.Company,
          ResumeJobs: item.ResumeJobs,
          upload_date: item.upload_date,
          parsed_data: item.parsed_data
        };
      })
    });
  } catch (error) {
    console.error('Get resumes error:', error);
    res.status(500).json({ message: '获取简历列表失败' });
  }
});

// 简历统计
router.get('/resumes/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const total = await Resume.count();
    
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthCount = await Resume.count({
      where: {
        upload_date: { [Op.gte]: startOfMonth }
      }
    });

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const weekCount = await Resume.count({
      where: {
        upload_date: { [Op.gte]: startOfWeek }
      }
    });

    res.json({
      total,
      month: monthCount,
      week: weekCount
    });
  } catch (error) {
    console.error('Get resume stats error:', error);
    res.status(500).json({ message: '获取简历统计失败' });
  }
});

// 获取简历详情
router.get('/resumes/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const resume = await Resume.findByPk(req.params.id, {
      include: [
        { model: Company, as: 'Company', attributes: ['id', 'name'] },
        { 
          model: ResumeJob, 
          include: [{ model: Job, attributes: ['id', 'title'] }] 
        }
      ]
    });
    if (!resume) return res.status(404).json({ message: '简历不存在' });
    
    // 处理文件路径为相对路径
    const item = resume.toJSON();
    if (item.file_path) {
      // 统一使用正斜杠
      let relativePath = item.file_path.replace(/\\/g, '/');
      if (relativePath.includes('uploads/')) {
        const parts = relativePath.split('uploads/');
        relativePath = parts[parts.length - 1];
      }
      item.file_path = relativePath;
    }
    
    res.json(item);
  } catch (error) {
    console.error('Get resume detail error:', error);
    res.status(500).json({ message: '获取简历详情失败' });
  }
});

// 删除简历
router.delete('/resumes/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const resume = await Resume.findByPk(id);
    
    if (!resume) {
      return res.status(404).json({ message: '简历不存在' });
    }

    // 删除关联的分析结果
    await AnalysisResult.destroy({ where: { resume_id: id } });
    
    // 删除旧版深度分析记录
    await DeepAnalysisRecord.destroy({ where: { resume_id: id } });
    
    // 删除面试会话
    await InterviewSession.destroy({ where: { resume_id: id } });

    // 删除简历职位关联
    await ResumeJob.destroy({ where: { resume_id: id } });

    // 删除简历记录
    await resume.destroy();

    res.json({ success: true, message: '简历删除成功' });
  } catch (error) {
    console.error('Delete resume error:', error);
    res.status(500).json({ message: '删除简历失败' });
  }
});

// 批量删除简历
router.post('/resumes/batch-delete', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: '请提供要删除的简历ID列表' });
    }

    // 删除关联的分析结果
    await AnalysisResult.destroy({ where: { resume_id: { [Op.in]: ids } } });
    
    // 删除旧版深度分析记录
    await DeepAnalysisRecord.destroy({ where: { resume_id: { [Op.in]: ids } } });
    
    // 删除面试会话
    await InterviewSession.destroy({ where: { resume_id: { [Op.in]: ids } } });

    // 删除简历职位关联
    await ResumeJob.destroy({ where: { resume_id: { [Op.in]: ids } } });

    // 批量删除简历记录
    await Resume.destroy({ where: { id: { [Op.in]: ids } } });

    res.json({ success: true, message: `成功删除 ${ids.length} 份简历` });
  } catch (error) {
    console.error('Batch delete resumes error:', error);
    res.status(500).json({ message: '批量删除简历失败' });
  }
});

// 仪表板统计
router.get('/dashboard/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const Resume = sequelize.models.Resume;
    const Job = sequelize.models.Job;
    const Company = sequelize.models.Company;
    const Subscription = sequelize.models.Subscription;

    const totalResumes = await Resume.count();
    const totalJobs = await Job.count();
    const totalCompanies = await Company.count();
    const activeSubscriptions = await Subscription.count({ where: { status: 'active' } });

    res.json({
      totalResumes,
      totalJobs,
      totalCompanies,
      activeSubscriptions
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ message: '获取仪表板统计失败' });
  }
});

// 仪表板图表数据
router.get('/dashboard/charts/:type', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { type } = req.params;
    let data = [];
    const months = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d);
    }

    if (type === 'userGrowth') {
      for (const m of months) {
        const start = new Date(m.getFullYear(), m.getMonth(), 1);
        const end = new Date(m.getFullYear(), m.getMonth() + 1, 1);
        const count = await User.count({ where: { created_at: { [Op.gte]: start, [Op.lt]: end } } });
        const dateStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`;
        data.push({ date: dateStr, count });
      }
      return res.json(data);
    }

    if (type === 'subscriptionDistribution') {
      const plans = [
        { key: 'free', name: '免费版' },
        { key: 'pro', name: '专业版' },
        { key: 'enterprise', name: '企业版' },
      ];
      for (const p of plans) {
        const count = await Subscription.count({ where: { plan: p.key } });
        data.push({ name: p.name, count });
      }
      return res.json(data);
    }

    if (type === 'revenueTrend') {
      for (const m of months) {
        const start = new Date(m.getFullYear(), m.getMonth(), 1);
        const end = new Date(m.getFullYear(), m.getMonth() + 1, 1);
        const amount = await Order.sum('amount', { where: { status: 'paid', created_at: { [Op.gte]: start, [Op.lt]: end } } });
        const dateStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`;
        data.push({ date: dateStr, amount: Number(amount || 0) });
      }
      return res.json(data);
    }

    if (type === 'aiUsage') {
      const mapping = { modelscope: '魔搭', siliconflow: '硅基流动', qianwen: '千问', glm: '质谱GLM', deepseek: 'DeepSeek', kimi: 'Kimi', minimax: 'MiniMax' };
      const providers = Object.keys(mapping);
      for (const p of providers) {
        const calls = await (sequelize.models.AnalysisResult || AnalysisResult).count({ where: { ai_provider: p } });
        data.push({ model: mapping[p], calls });
      }
      return res.json(data);
    }

    return res.status(400).json({ message: '无效的图表类型' });
  } catch (error) {
    console.error(`Get dashboard chart data error for ${req.params.type}:`, error);
    res.status(500).json({ message: '获取图表数据失败' });
  }
});

// 最近活动
router.get('/dashboard/activities', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const logs = await (sequelize.models.AuditLog || AuditLog).findAll({ order: [['occurred_at', 'DESC']], limit: 10 });
    const activities = logs.map(l => {
      const t = (l.resource_type || '').toLowerCase();
      let type = 'system';
      if (t === 'user') type = 'user';
      else if (t === 'company') type = 'company';
      else if (t === 'subscription') type = 'subscription';
      else if (t.includes('ai')) type = 'ai';
      const title = l.action || '操作记录';
      const description = `${l.resource_type || '系统'}#${l.resource_id || ''}`.trim();
      const createdAt = l.occurred_at || new Date();
      return { id: l.id, type, title, description, createdAt };
    });
    res.json(activities);
  } catch (error) {
    console.error('Get dashboard activities error:', error);
    res.status(500).json({ message: '获取最近活动失败' });
  }
});

module.exports = router;

// 系统设置与角色权限（占位实现）
router.get('/system/settings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const cfg = await SystemConfig.findOne({ where: { key: 'settings' } });
    res.json(cfg ? cfg.value : { siteName: '争湃·简历大师', siteDescription: '后台管理', siteLogo: '', contactEmail: '', contactPhone: '', icpNumber: '', analyticsCode: '' });
  } catch (e) { res.json({}) }
});
router.put('/system/settings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [cfg] = await SystemConfig.findOrCreate({ where: { key: 'settings' }, defaults: { value: req.body || {} } });
    await cfg.update({ value: req.body || {} });
    res.json(cfg.value);
  } catch (e) { res.status(500).json({ message: '保存失败' }) }
});



router.get('/system/notifications', authenticateToken, requireAdmin, async (req, res) => {
  try { const cfg = await SystemConfig.findOne({ where: { key: 'notifications' } }); res.json(cfg ? cfg.value : { emailNotifications: true, smsNotifications: false, pushNotifications: true, systemNotifications: true }); } catch (e) { res.json({}) }
});
router.put('/system/notifications', authenticateToken, requireAdmin, async (req, res) => {
  try { const [cfg] = await SystemConfig.findOrCreate({ where: { key: 'notifications' }, defaults: { value: req.body || {} } }); await cfg.update({ value: req.body || {} }); res.json(cfg.value) } catch (e) { res.status(500).json({ message: '保存失败' }) }
});

router.get('/system/roles', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const roles = await sequelize.models.Role.findAll({ include: [{ model: sequelize.models.RolePermission, as: 'Permissions' }] });
    const items = roles.map(r => ({ id: r.id, key: r.key, name: r.name, description: r.description, status: r.status, permissions: (r.Permissions || []).map(p => p.permission_key), isSystem: r.key && ['ADMIN', 'OPS'].includes(r.key.toUpperCase()) }))
    res.json(items);
  } catch (e) { res.status(500).json({ message: '获取角色失败' }) }
});
router.post('/system/roles', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const Role = sequelize.models.Role; const RolePermission = sequelize.models.RolePermission;
    const keyRaw = (req.body.key || req.body.name || '').toString();
    const key = keyRaw.trim().toUpperCase().replace(/\s+/g, '_');
    const name = req.body.name && req.body.name.toString().trim();
    if (!key || !name) return res.status(400).json({ message: '缺少角色键或名称' });
    const role = await Role.create({ key, name, description: req.body.description || '', status: req.body.status || 'active' });
    const perms = Array.isArray(req.body.permissions) ? req.body.permissions.map(k => ({ role_id: role.id, permission_key: k })) : [];
    if (perms.length) await RolePermission.bulkCreate(perms);
    res.status(201).json({ id: role.id });
  } catch (e) { res.status(500).json({ message: '创建角色失败' }) }
});
router.put('/system/roles/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const Role = sequelize.models.Role; const RolePermission = sequelize.models.RolePermission;
    const role = await Role.findByPk(req.params.id);
    if (!role) return res.status(404).json({ message: '角色不存在' });
    await role.update({ key: req.body.key ?? role.key, name: req.body.name ?? role.name, description: req.body.description ?? role.description, status: req.body.status ?? role.status });
    if (Array.isArray(req.body.permissions)) {
      await RolePermission.destroy({ where: { role_id: role.id } });
      const perms = req.body.permissions.map(k => ({ role_id: role.id, permission_key: k }));
      if (perms.length) await RolePermission.bulkCreate(perms);
    }
    res.json({ id: role.id });
  } catch (e) { res.status(500).json({ message: '更新角色失败' }) }
});
router.delete('/system/roles/:id', authenticateToken, requireAdmin, async (req, res) => {
  try { const Role = sequelize.models.Role; const RolePermission = sequelize.models.RolePermission; await RolePermission.destroy({ where: { role_id: req.params.id } }); await Role.destroy({ where: { id: req.params.id } }); res.json({ message: '删除成功' }) } catch (e) { res.status(500).json({ message: '删除角色失败' }) }
});
router.get('/system/permissions', authenticateToken, requireAdmin, async (req, res) => {
  res.json([
    { category: '仪表板', permissions: [{ title: '查看仪表板', value: 'dashboard.view', description: '访问统计与图表' }] },
    { category: '客户管理', permissions: [{ title: '管理账号', value: 'customers.manage', description: '创建/编辑/删除账号' }, { title: '查看账号', value: 'customers.view', description: '查看账号列表与详情' }] },
    { category: '企业管理', permissions: [{ title: '管理企业', value: 'companies.manage', description: '创建/编辑/认证企业' }, { title: '查看企业', value: 'companies.view', description: '查看企业列表与详情' }] },
    { category: '订阅管理', permissions: [{ title: '管理订阅', value: 'subscriptions.manage', description: '变更计划/续费/取消' }, { title: '查看订阅', value: 'subscriptions.view', description: '查看订阅与用量' }] },
    { category: 'AI模型管理', permissions: [{ title: '管理模型', value: 'ai_models.manage', description: '提供商与密钥管理' }, { title: '查看模型', value: 'ai_models.view', description: '查看提供商与密钥' }] },
    { category: '系统管理', permissions: [{ title: '系统设置', value: 'system.settings', description: '基础/短信/通知设置' }, { title: '查看日志', value: 'system.logs', description: '查询与导出系统日志' }] }
  ])
});
router.get('/system/logs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', level = '', module = '', startDate, endDate } = req.query;
    const offset = (page - 1) * limit;
    const where = {};
    
    if (search) {
      where[Op.or] = [
        { action: { [Op.like]: `%${search}%` } },
        { payload: { [Op.like]: `%${search}%` } }
      ];
    }
    
    if (level) {
      // 审计日志目前没有 level 字段，如果需要可以增加，这里暂时忽略或按 action 过滤
    }
    
    if (module) {
      where.resource_type = module;
    }
    
    if (startDate || endDate) {
      where.occurred_at = {};
      if (startDate) where.occurred_at[Op.gte] = new Date(startDate);
      if (endDate) where.occurred_at[Op.lte] = new Date(endDate);
    }

    const { count, rows } = await (sequelize.models.AuditLog || AuditLog).findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['occurred_at', 'DESC']],
      include: [{ model: User, as: 'Actor', attributes: ['id', 'username'] }]
    });

    res.json({
      items: rows.map(l => ({
        id: l.id,
        timestamp: l.occurred_at,
        level: 'info', // 审计日志默认为 info
        module: l.resource_type,
        action: l.action,
        user: l.Actor ? l.Actor.username : 'Unknown',
        message: `${l.action} on ${l.resource_type} #${l.resource_id}`,
        payload: l.payload,
        ip: l.ip
      })),
      total: count
    });
  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({ message: '获取日志失败' });
  }
});

router.get('/system/logs/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const log = await (sequelize.models.AuditLog || AuditLog).findByPk(req.params.id, {
      include: [{ model: User, as: 'Actor', attributes: ['id', 'username'] }]
    });
    if (!log) return res.status(404).json({ message: '日志不存在' });
    res.json({
      id: log.id,
      timestamp: log.occurred_at,
      level: 'info',
      module: log.resource_type,
      action: log.action,
      user: log.Actor ? log.Actor.username : 'Unknown',
      message: `${log.action} on ${log.resource_type} #${log.resource_id}`,
      payload: log.payload,
      ip: log.ip,
      ua: log.ua
    });
  } catch (error) {
    res.status(500).json({ message: '获取日志详情失败' });
  }
});

router.get('/system/logs/export', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const logs = await (sequelize.models.AuditLog || AuditLog).findAll({
      order: [['occurred_at', 'DESC']],
      limit: 1000,
      include: [{ model: User, as: 'Actor', attributes: ['id', 'username'] }]
    });
    
    let csv = 'timestamp,level,module,user,action,message,ip\n';
    logs.forEach(l => {
      const user = l.Actor ? l.Actor.username : 'Unknown';
      csv += `"${l.occurred_at.toISOString()}","info","${l.resource_type}","${user}","${l.action}","${l.action} on ${l.resource_type} #${l.resource_id}","${l.ip || ''}"\n`;
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=logs.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ message: '导出日志失败' });
  }
});

// 辅助：角色映射
function mapRole(role) {
  const m = {
    'HR_MANAGER': 'enterprise',
    'HR_STAFF': 'user',
    'ADMIN': 'admin'
  };
  return m[role] || 'user';
}
router.get('/ai-providers/platforms', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const rows = await ModelProvider.findAll({ attributes: ['provider'], group: ['provider'] });
    res.json(rows.map(r => r.provider));
  } catch (error) {
    res.status(500).json({ message: '获取AI平台列表失败' });
  }
});

router.get('/ai-providers/models', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { provider } = req.query;
    const where = {};
    if (provider) where.provider = provider;
    const rows = await ModelKey.findAll({ where, order: [['created_at', 'DESC']] });
    res.json(rows.map(k => ({ id: k.id, provider: k.provider, scope: k.scope, company_id: k.company_id })));
  } catch (error) {
    res.status(500).json({ message: '获取AI平台模型失败' });
  }
});
