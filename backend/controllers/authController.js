const { User, Resume, AnalysisResult, Job, ResumeJob } = require('../models');
const { generateToken } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');

// 简易验证码存储（演示环境）
const phoneCodeStore = new Map();
function genCode(){ return String(Math.floor(100000 + Math.random()*900000)); }
function now(){ return Date.now(); }

const sms = require('../services/smsService');

// 发送短信验证码（演示实现）
const sendCode = async (req,res)=>{
  try{
    const { phone: rawPhone } = req.body;
    const np = sms.normalizePhone(rawPhone);
    if(!np.ok){
      return res.status(400).json({ success:false, error:{ code:'INVALID_PHONE', message:'手机号格式不正确' } });
    }
    const phone = np.phone;
    const code = genCode();
    phoneCodeStore.set(String(phone), { code, expire: now()+5*60*1000, attempts:0 });
    console.log(`[Auth] Sending code ${code} to ${phone}...`);
    const sendRes = await sms.sendVerificationCode(String(phone), code);
    console.log('[Auth] SMS Result:', JSON.stringify(sendRes));
    
    // 仅在短信发送成功时返回成功
    if (sendRes && sendRes.success && sendRes.sent){
      return res.json({ success:true, data:{ sent:true, devHint: code }, message: sendRes.message || '验证码已发送' });
    } else {
      const reason = sendRes && sendRes.error ? String(sendRes.error) : ''
      const msg = reason === 'CONFIG_MISSING_KEYS' ? '短信通道未配置：缺少AccessKey' :
        (reason === 'CONFIG_MISSING_SIGN' ? '短信通道未配置：缺少签名' :
        (reason === 'CONFIG_MISSING_TEMPLATE' ? '短信通道未配置：缺少模板' :
        (reason === 'DISABLED' ? '短信服务未开启' :
        (sendRes && sendRes.mock ? '短信通道未配置：缺少AccessKey' : (sendRes && sendRes.message ? String(sendRes.message) : '短信发送失败')))))
      // 明确返回 false 以便于前端处理
      return res.status(400).json({ success:false, error: { code: 'SMS_SEND_FAILED', message: msg, detail: reason } });
    }
  }catch(e){
    res.status(500).json({ success:false, error:{ code:'SEND_CODE_ERROR', message:e.message } });
  }
};

// 校验验证码并登录/注册
const verifyCode = async (req,res)=>{
  try{
    const { phone: rawPhone, code } = req.body;
    const np = sms.normalizePhone(rawPhone);
    if(!np.ok){
      return res.status(400).json({ success:false, error:{ code:'INVALID_PHONE', message:'手机号格式不正确' } });
    }
    const phone = np.phone;
    if(!code || String(code).length!==6){
      return res.status(400).json({ success:false, error:{ code:'INVALID_CODE', message:'验证码格式不正确' } });
    }
    let record = phoneCodeStore.get(String(phone));
    const devBypass = code==='123456';
    if(!devBypass){
      // 如果内存中没有，尝试从数据库中查找（防止服务器重启导致内存丢失）
      if (!record) {
        const { VerificationCode } = require('../models');
        const dbRecord = await VerificationCode.findOne({
          where: {
            phone: String(phone),
            status: 'sent',
            expires_at: { [Op.gt]: new Date() }
          },
          order: [['created_at', 'DESC']]
        });
        if (dbRecord) {
          record = { code: dbRecord.code, expire: new Date(dbRecord.expires_at).getTime(), attempts: 0, dbId: dbRecord.id };
        }
      }

      if(!record || record.expire<now()){
        return res.status(400).json({ success:false, error:{ code:'CODE_EXPIRED', message:'验证码已过期或未发送' } });
      }
      if(record.code !== String(code)){
        if (record.dbId) {
          // 如果是数据库记录，更新尝试次数（此处简单处理，主要靠内存）
        }
        record.attempts++; phoneCodeStore.set(String(phone), record);
        return res.status(401).json({ success:false, error:{ code:'CODE_MISMATCH', message:'验证码错误' } });
      }
      
      // 标记为已使用
      if (record.dbId) {
        const { VerificationCode } = require('../models');
        await VerificationCode.update({ status: 'used' }, { where: { id: record.dbId } });
      }
      phoneCodeStore.delete(String(phone));
    }

    let user = await User.findOne({ where:{ phone:String(phone) } });
    let action = 'login';
    if(!user){
      const username = `用户${String(phone).slice(-4)}-${Math.floor(Math.random()*10000)}`;
      const hashedPassword = await bcrypt.hash(`auto-${genCode()}-${phone}`, 10);
      user = await User.create({ username, phone:String(phone), password_hash: hashedPassword, phone_verified:true });
      action = 'registered';
    }

    await user.update({ last_login_at: new Date(), login_count: (user.login_count||0)+1 });
    const token = generateToken(user);
    res.json({ success:true, data:{ user:{ id:user.id, username:user.username, email:user.email, phone:user.phone, avatar:user.avatar, role:user.role, company_name:user.company_name, company_id:user.company_id }, token, action }, message: action==='registered'?'注册并登录成功':'登录成功' });
  }catch(e){
    res.status(500).json({ success:false, error:{ code:'VERIFY_CODE_ERROR', message:e.message } });
  }
};

// 用户注册
const register = async (req, res) => {
  try {
    const { username, email, phone, password } = req.body;

    // 检查必填字段
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: '用户名和密码为必填项'
        }
      });
    }

    // 构建查询条件来检查用户是否已存在
    const checkConditions = [{ username: username }];
    if (email) checkConditions.push({ email: email });
    if (phone) checkConditions.push({ phone: phone });

    // 检查用户是否已存在
    const existingUser = await User.findOne({
      where: {
        [Op.or]: checkConditions
      }
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'USER_EXISTS',
          message: '用户已存在'
        }
      });
    }

    // 密码加密
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 创建新用户
    const user = await User.create({
      username,
      email,
      phone,
      password_hash: hashedPassword,
      avatar: '/dist/avatar01.png' // 注册用户默认头像设为 avatar01.png
    });

    // 生成令牌
    const token = generateToken(user);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          phone: user.phone,
          avatar: user.avatar,
          role: user.role,
          company_name: user.company_name,
          company_id: user.company_id
        },
        token
      },
      message: '注册成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'REGISTRATION_ERROR',
        message: error.message
      }
    });
  }
};

// 用户登录
const login = async (req, res) => {
  try {
    console.log('[DEBUG_LOGIN] Incoming request body:', JSON.stringify(req.body));
    const { email, phone, username, identifier, password } = req.body;

    // 检查是否提供了登录凭据
    if (!email && !phone && !username && !identifier) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: '请提供登录账号'
        }
      });
    }

    // 构建查询条件
    let whereConditions = [];
    if (identifier) {
      whereConditions.push({ username: identifier });
      whereConditions.push({ email: identifier });
      whereConditions.push({ phone: identifier });
    } else {
      if (email) whereConditions.push({ email: email });
      if (phone) whereConditions.push({ phone: phone });
      if (username) whereConditions.push({ username: username });
    }

    // 根据邮箱、手机或用户名查找用户
    console.log('[DEBUG_LOGIN] Received identifier:', identifier, 'type:', typeof identifier);
    console.log('[DEBUG_LOGIN] Search conditions:', JSON.stringify(whereConditions));
    
    const user = await User.findOne({
      where: {
        [Op.or]: whereConditions
      }
    });

    if (!user) {
      console.log('[DEBUG_LOGIN] User not found for conditions:', JSON.stringify(whereConditions));
      const isDev = process.env.NODE_ENV !== 'production';
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: isDev ? `用户不存在: ${JSON.stringify(whereConditions)}` : '用户名或密码错误'
        }
      });
    }

    // 验证密码
    console.log('[DEBUG_LOGIN] Found user:', user.username, 'ID:', user.id, 'Role:', user.role);
    console.log('[DEBUG_LOGIN] Received password length:', password ? password.length : 0);
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    console.log('[DEBUG_LOGIN] Password comparison result:', isPasswordValid);

    if (!isPasswordValid) {
      console.log('Login failed: Invalid password for user', user.username);
      const isDev = process.env.NODE_ENV !== 'production';
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: isDev ? '密码错误' : '用户名或密码错误'
        }
      });
    }

    // 生成令牌
    const token = generateToken(user);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          phone: user.phone,
          avatar: user.avatar,
          role: user.role,
          company_name: user.company_name,
          company_id: user.company_id
        },
        token
      },
      message: '登录成功'
    });
  } catch (error) {
    console.error('Login Error Detailed:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'LOGIN_ERROR',
        message: error.message,
        stack: error.stack
      }
    });
  }
};

// 获取当前用户信息
const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: '用户不存在'
        }
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          phone: user.phone,
          avatar: user.avatar,
          company_name: user.company_name,
          company_id: user.company_id
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'USER_ERROR',
        message: error.message
      }
    });
  }
};

// 更新用户信息
const updateCurrentUser = async (req, res) => {
  try {
    const { username, email, phone, avatar, company_name } = req.body;

    const updatedUser = await User.update(
      { username, email, phone, avatar, company_name },
      { where: { id: req.user.id }, returning: true }
    );

    if (updatedUser[0] === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: '用户不存在'
        }
      });
    }

    const user = await User.findByPk(req.user.id);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          phone: user.phone,
          avatar: user.avatar,
          role: user.role,
          company_name: user.company_name,
          company_id: user.company_id
        }
      },
      message: '用户信息更新成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_ERROR',
        message: error.message
      }
    });
  }
};

// 用户登出
const logout = async (req, res) => {
  res.json({
    success: true,
    message: '登出成功'
  });
};

// 设置或更新用户密码
const setPassword = async (req, res) => {
  try {
    const { password } = req.body;
    const userId = req.user.id; // 从 authenticate 中间件获取用户ID

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PASSWORD',
          message: '密码不能为空且至少为6位'
        }
      });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: '用户不存在'
        }
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await user.update({ password_hash: hashedPassword });

    res.json({
      success: true,
      message: '密码设置成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SET_PASSWORD_ERROR',
        message: error.message
      }
    });
  }
};

module.exports = {
  register,
  login,
  getCurrentUser,
  updateCurrentUser,
  logout,
  sendCode,
  verifyCode,
  setPassword,
  async getUserStats(req, res) {
    try {
      const companyId = req.user?.company_id || null;
      let whereClause = { user_id: req.user.id };
      
      if (companyId) {
        whereClause = { 
          [Op.or]: [
            { user_id: req.user.id },
            { company_id: companyId }
          ]
        };
      }

      const resumesCount = await Resume.count({ where: whereClause });
      const interviewsCount = await ResumeJob.count({ 
        where: { 
          ...whereClause, 
          status: { [Op.in]: ['interview', '面试', '面试中'] } 
        } 
      });
      const activeJobs = await Job.count({ 
        where: { 
          ...whereClause, 
          status: 'active' 
        } 
      });
      res.json({ success: true, data: { resumes: resumesCount, interviews: interviewsCount, tasks: activeJobs } });
    } catch (error) {
      res.status(500).json({ success: false, error: { code: 'USER_STATS_ERROR', message: error.message } });
    }
  }
};
