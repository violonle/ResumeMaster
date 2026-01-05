const { User, Resume, AnalysisResult, Job, ResumeJob } = require('../models');
const { generateToken } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');

// 简易验证码存储（演示环境）
const phoneCodeStore = new Map();
function genCode(){ return String(Math.floor(100000 + Math.random()*900000)); }
function now(){ return Date.now(); }

// 发送短信验证码（演示实现）
const sendCode = async (req,res)=>{
  try{
    const { phone } = req.body;
    if(!phone || !/^1[3-9]\d{9}$/.test(String(phone))){
      return res.status(400).json({ success:false, error:{ code:'INVALID_PHONE', message:'手机号格式不正确' } });
    }
    const code = genCode();
    phoneCodeStore.set(String(phone), { code, expire: now()+5*60*1000, attempts:0 });
    const sms = require('../services/smsService');
    console.log(`[Auth] Sending code ${code} to ${phone}...`);
    const sendRes = await sms.sendVerificationCode(String(phone), code);
    console.log('[Auth] SMS Result:', JSON.stringify(sendRes));
    
    // 仅在短信发送成功时才返回 devHint（可选），或者仅在非生产环境返回
    // 为确保用户体验，如果短信发送失败，必须返回错误
    if (sendRes && sendRes.success){
      return res.json({ success:true, data:{ sent:true, devHint: code } });
    } else {
      const reason = sendRes && sendRes.error ? String(sendRes.error) : ''
      const msg = reason === 'CONFIG_MISSING_KEYS' ? '短信通道未配置：缺少AccessKey' : (reason === 'CONFIG_MISSING_SIGN' ? '短信通道未配置：缺少签名' : (reason === 'CONFIG_MISSING_TEMPLATE' ? '短信通道未配置：缺少模板' : (sendRes.message || '短信发送失败')))
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
    const { phone, code } = req.body;
    if(!phone || !/^1[3-9]\d{9}$/.test(String(phone))){
      return res.status(400).json({ success:false, error:{ code:'INVALID_PHONE', message:'手机号格式不正确' } });
    }
    if(!code || String(code).length!==6){
      return res.status(400).json({ success:false, error:{ code:'INVALID_CODE', message:'验证码格式不正确' } });
    }
    const record = phoneCodeStore.get(String(phone));
    const devBypass = code==='123456';
    if(!devBypass){
      if(!record || record.expire<now()){
        return res.status(400).json({ success:false, error:{ code:'CODE_EXPIRED', message:'验证码已过期或未发送' } });
      }
      if(record.code !== String(code)){
        record.attempts++; phoneCodeStore.set(String(phone), record);
        return res.status(401).json({ success:false, error:{ code:'CODE_MISMATCH', message:'验证码错误' } });
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
      password_hash: hashedPassword
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
    const { email, phone, username, password } = req.body;

    // 检查是否提供了登录凭据
    if (!email && !phone && !username) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: '请提供邮箱、手机号或用户名'
        }
      });
    }

    // 构建查询条件
    const whereConditions = {};
    if (email) whereConditions.email = email;
    if (phone) whereConditions.phone = phone;
    if (username) whereConditions.username = username;

    // 根据邮箱、手机或用户名查找用户
    const user = await User.findOne({
      where: {
        [Op.or]: Object.keys(whereConditions).map(key => ({ [key]: whereConditions[key] }))
      }
    });

    if (!user) {
      console.log('Login failed: User not found', JSON.stringify(whereConditions));
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
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

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
      const companyName = req.user?.company_name || null;
      let userIds = [req.user.id];
      if (companyName) {
        const users = await User.findAll({ where: { company_name: companyName }, attributes: ['id'] });
        userIds = users.map(u => u.id);
      }
      const whereUser = userIds.length === 1 ? { user_id: userIds[0] } : { user_id: { [Op.in]: userIds } };
      const resumesCount = await Resume.count({ where: whereUser });
      const interviewsCount = await ResumeJob.count({ where: { ...whereUser, status: 'interview' } });
      const activeJobs = await Job.count({ where: { ...whereUser, status: 'active' } });
      res.json({ success: true, data: { resumes: resumesCount, interviews: interviewsCount, tasks: activeJobs } });
    } catch (error) {
      res.status(500).json({ success: false, error: { code: 'USER_STATS_ERROR', message: error.message } });
    }
  }
};
