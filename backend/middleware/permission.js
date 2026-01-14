const { User, Subscription, Company } = require('../models');
const { Op } = require('sequelize');
const moment = require('moment');

class PermissionMiddleware {
  // 检查用户是否已认证
  static requireAuth(req, res, next) {
    console.log(`[Permission] requireAuth: User=${req.user?.id}`);
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '请先登录'
        }
      });
    }
    next();
  }

  // 检查用户是否有有效订阅
  static async requireSubscription(req, res, next) {
    console.log(`[Permission] requireSubscription: User=${req.user?.id}`);
    try {
      const userId = req.user.id;
      
      const user = await User.findByPk(userId, {
        include: [{
          model: Company,
          as: 'Company',
          include: [{
            model: Subscription,
            as: 'Subscriptions',
            where: { status: 'active' },
            required: false,
            order: [['created_at', 'DESC']]
          }]
        }]
      });

      // 获取订阅信息 (优先使用公司订阅)
      let subscription = null;
      if (user && user.Company && user.Company.Subscriptions && user.Company.Subscriptions.length > 0) {
        subscription = user.Company.Subscriptions[0];
      }

      // 如果没有公司订阅，检查用户个人订阅状态 (兼容旧数据或个人用户)
      if (!subscription) {
        // 构造一个默认的免费订阅对象，确保不报错
        // 确保免费版用户始终拥有有效订阅状态，而不是过期状态
        subscription = {
          plan: user.role === 'premium' ? 'pro' : (user.role === 'enterprise' ? 'enterprise' : 'free'),
          billing_cycle: 'monthly',
          end_at: user.subscription_end_date ? new Date(user.subscription_end_date) : moment().add(10, 'years').toDate(), // 免费版给予超长有效期
          start_at: user.created_at || new Date(),
          status: 'active',
          quota: null
        };
      }

      const endDate = subscription.end_at || subscription.expiresAt; // 兼容字段
      const isExpired = endDate && moment(endDate).isBefore(moment());

      // 只有非免费版才强制检查过期，免费版永不过期（除非被封禁，那是另一回事）
      if (isExpired && subscription.plan !== 'free') {
        console.log('订阅已过期:', { plan: subscription.plan, end_at: endDate });
        return res.status(403).json({
          success: false,
          error: {
            code: 'SUBSCRIPTION_EXPIRED',
            message: '您的订阅已过期，请续订',
            upgradeUrl: '/subscription/renew'
          }
        });
      }

      // 规范化 planType 供后续使用
      if (!subscription.planType) {
        subscription.planType = `${subscription.plan || 'basic'}_${subscription.billing_cycle || 'monthly'}`;
      }

      // 将订阅信息添加到请求对象
      req.subscription = subscription;
      next();
    } catch (error) {
      console.error('检查订阅状态失败 - 详细错误:', error);
      console.error('当前用户ID:', req.user?.id);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '检查订阅状态失败: ' + (error.message || '未知错误')
        }
      });
    }
  }

  // 检查用户是否有专业版订阅
  static async requireProSubscription(req, res, next) {
    try {
      const userId = req.user.id;
      
      const user = await User.findByPk(userId, {
        include: [{
          model: Company,
          as: 'Company',
          include: [{
            model: Subscription,
            as: 'Subscriptions',
            where: { 
              status: 'active',
              plan: ['pro', 'enterprise']
            },
            required: false,
            order: [['created_at', 'DESC']]
          }]
        }]
      });

      let subscription = null;
      if (user && user.Company && user.Company.Subscriptions && user.Company.Subscriptions.length > 0) {
        subscription = user.Company.Subscriptions[0];
      }

      // 个人用户回退检查
      if (!subscription && user.subscription_status === 'active' && ['premium', 'enterprise'].includes(user.role)) {
        subscription = {
          plan: user.role === 'premium' ? 'pro' : 'enterprise',
          billing_cycle: 'monthly',
          end_at: user.subscription_end_date,
          status: 'active'
        };
      }

      if (!subscription) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'PRO_SUBSCRIPTION_REQUIRED',
            message: '此功能需要专业版订阅',
            upgradeUrl: '/subscription/plans?plan=pro'
          }
        });
      }

      const endDate = subscription.end_at || subscription.expiresAt;
      const isExpired = endDate && moment(endDate).isBefore(moment());

      if (isExpired) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'SUBSCRIPTION_EXPIRED',
            message: '您的专业版订阅已过期，请续订',
            upgradeUrl: '/subscription/renew'
          }
        });
      }

      if (!subscription.planType) {
        subscription.planType = `${subscription.plan}_${subscription.billing_cycle || 'monthly'}`;
      }

      req.subscription = subscription;
      next();
    } catch (error) {
      console.error('检查专业版订阅失败:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '检查订阅状态失败'
        }
      });
    }
  }

  // 检查API调用次数限制
  static checkApiLimit(limitType = 'general') {
    return async (req, res, next) => {
      try {
        const userId = req.user.id;
        const subscription = req.subscription;

        // 如果是管理员或者处于开发模式，解除限制
        if (req.user.role === 'admin' || process.env.NODE_ENV === 'development') {
          return next();
        }

        if (!subscription) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'NO_SUBSCRIPTION',
              message: '需要有效订阅才能使用API'
            }
          });
        }

        // 获取使用限制 (优先使用订阅对象中的 quota)
        let limits;
        if (subscription.quota) {
          // 映射 quota 字段到 limits 格式
          limits = {
            aiAnalysis: subscription.quota.resume_parses_per_month || 50,
            resumeUpload: subscription.quota.resume_parses_per_month || 20, // 假设共用额度
            jobMatching: subscription.quota.ai_calls ? Math.floor(subscription.quota.ai_calls / 10) : 30,
            apiCalls: subscription.quota.ai_calls || 100,
            storage: 100
          };
          // 如果 plan 是 enterprise/pro，可能某些是无限制
          if (subscription.plan === 'enterprise' || subscription.plan === 'pro') {
             // 保持 quota 中的数值，如果是 -1 则为无限制
          }
        } else {
          limits = this.getSubscriptionLimits(subscription.planType);
        }

        const currentUsage = await this.getCurrentUsage(userId, subscription);

        // 检查是否超过限制
        const limit = limits[limitType];
        const usage = currentUsage[limitType] || 0;

        if (limit !== -1 && usage >= limit) {
          return res.status(429).json({
            success: false,
            error: {
              code: 'API_LIMIT_EXCEEDED',
              message: `您的${limitType}使用次数已达上限`,
              current: usage,
              limit: limit,
              upgradeUrl: '/subscription/upgrade'
            }
          });
        }

        // 将使用情况添加到请求对象
        req.usage = currentUsage;
        req.limits = limits;
        next();
      } catch (error) {
        console.error('检查API限制失败:', error);
        res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: '检查API限制失败'
          }
        });
      }
    };
  }

  // 获取订阅限制
  static getSubscriptionLimits(planType) {
    const limits = {
      basic_monthly: {
        aiAnalysis: 50,
        resumeUpload: 20,
        jobMatching: 30,
        apiCalls: 100,
        storage: 100 // MB
      },
      basic_yearly: {
        aiAnalysis: 600,
        resumeUpload: 240,
        jobMatching: 360,
        apiCalls: 1200,
        storage: 1000 // MB
      },
      free_monthly: { // Add free plan fallback
        aiAnalysis: 1000, // 大幅提高免费版限制，避免阻塞用户
        resumeUpload: 500,
        jobMatching: 1000,
        apiCalls: 2000,
        storage: 500
      },
      pro_monthly: {
        aiAnalysis: -1, // 无限制
        resumeUpload: -1,
        jobMatching: -1,
        apiCalls: -1,
        storage: -1
      },
      pro_yearly: {
        aiAnalysis: -1,
        resumeUpload: -1,
        jobMatching: -1,
        apiCalls: -1,
        storage: -1
      },
      enterprise_monthly: {
        aiAnalysis: -1,
        resumeUpload: -1,
        jobMatching: -1,
        apiCalls: -1,
        storage: -1
      }
    };

    return limits[planType] || limits.free_monthly; // Default to free
  }

  // 获取当前使用情况
  static async getCurrentUsage(userId, subscription) {
    const { UserActivity } = require('../models');
    
    const startDate = subscription.start_at ? moment(subscription.start_at).toDate() : moment().startOf('month').toDate();
    const endDate = subscription.end_at ? moment(subscription.end_at).toDate() : moment().endOf('month').toDate();

    // 获取订阅周期内的活动统计
    const activities = await UserActivity.findAll({
      where: {
        user_id: userId, // Fixed: userId -> user_id
        created_at: {    // Fixed: createdAt -> created_at
          [Op.between]: [startDate, endDate] // Fixed: $between -> [Op.between]
        },
        action: {        // Fixed: activityType -> action
          [Op.in]: ['ai_analysis', 'resume_upload', 'job_matching', 'api_call'] // Fixed: $in -> [Op.in]
        }
      }
    });

    return {
      aiAnalysis: activities.filter(a => a.action === 'ai_analysis').length,
      resumeUpload: activities.filter(a => a.action === 'resume_upload').length,
      jobMatching: activities.filter(a => a.action === 'job_matching').length,
      apiCalls: activities.filter(a => a.action === 'api_call').length
    };
  }

  // 检查管理员权限
  static requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ADMIN_REQUIRED',
          message: '需要管理员权限'
        }
      });
    }
    next();
  }

  // 检查是否具有特定权限
  static requirePermission(permission) {
    return (req, res, next) => {
      // 目前简化逻辑：管理员拥有所有权限
      // 可以在此处扩展更多细粒度的权限检查逻辑
      if (req.user && req.user.role === 'admin') {
        return next();
      }

      // 暂时拒绝其他角色访问需要特定权限的接口
      return res.status(403).json({
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: '权限不足'
        }
      });
    };
  }

  // 检查文件上传权限
  static checkFileUpload(req, res, next) {
    const file = req.file;
    if (!file) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_FILE',
          message: '请选择要上传的文件'
        }
      });
    }

    // 检查文件类型
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FILE_TYPE',
          message: '不支持的文件类型，请上传PDF、Word或文本文件'
        }
      });
    }

    // 检查文件大小（10MB）
    if (file.size > 10 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: '文件大小不能超过10MB'
        }
      });
    }

    next();
  }

  // 检查速率限制
  static rateLimit(maxRequests = 100, windowMs = 60 * 60 * 1000) {
    const requests = new Map();

    return (req, res, next) => {
      const userId = req.user?.id || req.ip;
      console.log(`[Permission] rateLimit check: User=${userId}, Path=${req.path}`);
      const now = Date.now();
      const windowStart = now - windowMs;

      // 清理过期的请求记录
      if (requests.has(userId)) {
        requests.set(userId, requests.get(userId).filter(time => time > windowStart));
      } else {
        requests.set(userId, []);
      }

      const userRequests = requests.get(userId);

      if (userRequests.length >= maxRequests) {
        return res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `请求过于频繁，请稍后再试`,
            retryAfter: Math.ceil((userRequests[0] + windowMs - now) / 1000)
          }
        });
      }

      // 记录当前请求
      userRequests.push(now);
      next();
    };
  }
}

module.exports = PermissionMiddleware;
