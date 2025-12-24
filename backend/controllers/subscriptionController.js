const { Subscription, User, Order, UserActivity, Company, AuditLog } = require('../models');
const { Op } = require('sequelize');
const moment = require('moment');

class SubscriptionController {
  constructor() {
    this.getUserSubscription = this.getUserSubscription.bind(this);
    this.getAvailablePlans = this.getAvailablePlans.bind(this);
    this.renewSubscription = this.renewSubscription.bind(this);
    this.getSubscriptionUsage = this.getSubscriptionUsage.bind(this);
    this.checkSubscriptionStatus = this.checkSubscriptionStatus.bind(this);
    this.upgradeSubscription = this.upgradeSubscription.bind(this);
    this.getSubscriptionLimits = this.getSubscriptionLimits.bind(this);
  }

  // 获取订阅限制
  getSubscriptionLimits(planType) {
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
      free_monthly: {
        aiAnalysis: 10,
        resumeUpload: 5,
        jobMatching: 10,
        apiCalls: 20,
        storage: 50
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

    return limits[planType] || limits.free_monthly;
  }

  // 获取用户订阅信息
  async getUserSubscription(req, res) {
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

      let subscription = null;
      if (user && user.Company && user.Company.Subscriptions && user.Company.Subscriptions.length > 0) {
        subscription = user.Company.Subscriptions[0];
      }

      if (!subscription) {
        return res.json({
          success: true,
          data: {
            hasSubscription: false,
            status: 'inactive',
            planType: null,
            expiresAt: null,
            isExpired: true
          }
        });
      }

      const expiresAt = subscription.end_at || subscription.expiresAt;
      const isExpired = expiresAt && moment(expiresAt).isBefore(moment());
      const daysRemaining = expiresAt ? moment(expiresAt).diff(moment(), 'days') : 0;

      res.json({
        success: true,
        data: {
          hasSubscription: true,
          id: subscription.id,
          status: subscription.status,
          planType: subscription.planType || `${subscription.plan}_${subscription.billing_cycle}`,
          expiresAt: expiresAt,
          startedAt: subscription.start_at || subscription.startedAt,
          isExpired,
          daysRemaining: Math.max(0, daysRemaining),
          autoRenew: subscription.auto_renew || subscription.autoRenew || false
        }
      });
    } catch (error) {
      console.error('获取用户订阅信息失败:', error);
      res.status(500).json({
        success: false,
        error: '获取订阅信息失败'
      });
    }
  }

  // 获取可用订阅计划
  async getAvailablePlans(req, res) {
    try {
      const plans = [
        {
          id: 'basic_monthly',
          name: '基础版月付',
          planType: 'monthly',
          price: 29,
          features: [
            '每月50次AI分析',
            '基础简历模板',
            '邮件支持',
            '基础数据导出'
          ],
          popular: false
        },
        {
          id: 'basic_yearly',
          name: '基础版年付',
          planType: 'yearly',
          price: 290,
          originalPrice: 348,
          features: [
            '每年600次AI分析',
            '基础简历模板',
            '邮件支持',
            '基础数据导出',
            '节省17%'
          ],
          popular: false
        },
        {
          id: 'pro_monthly',
          name: '专业版月付',
          planType: 'monthly',
          price: 59,
          features: [
            '无限AI分析',
            '高级简历模板',
            '优先客服支持',
            '高级数据导出',
            '团队协作功能',
            'API访问'
          ],
          popular: true
        },
        {
          id: 'pro_yearly',
          name: '专业版年付',
          planType: 'yearly',
          price: 590,
          originalPrice: 708,
          features: [
            '无限AI分析',
            '高级简历模板',
            '优先客服支持',
            '高级数据导出',
            '团队协作功能',
            'API访问',
            '专属顾问',
            '节省17%'
          ],
          popular: false
        }
      ];

      res.json({
        success: true,
        data: plans
      });
    } catch (error) {
      console.error('获取订阅计划失败:', error);
      res.status(500).json({
        success: false,
        error: '获取订阅计划失败'
      });
    }
  }

  // 续订订阅
  async renewSubscription(req, res) {
    try {
      const userId = req.user.id;
      const { planType, autoRenew } = req.body;

      const user = await User.findByPk(userId, {
        include: [{ model: Company, as: 'Company' }]
      });

      if (!user || !user.Company) {
        return res.status(400).json({
          success: false,
          error: '用户未关联公司，无法续订'
        });
      }

      const currentSubscription = await Subscription.findOne({
        where: { company_id: user.Company.id },
        order: [['created_at', 'DESC']]
      });

      if (!currentSubscription) {
        return res.status(400).json({
          success: false,
          error: '当前没有有效的订阅'
        });
      }

      // 计算新的到期时间
      const currentExpiresAt = currentSubscription.end_at || currentSubscription.expiresAt || new Date();
      let newExpiresAt = moment(currentExpiresAt);
      
      const isMonthly = planType.includes('monthly');
      const isYearly = planType.includes('yearly');

      if (isMonthly) {
        newExpiresAt.add(1, 'month');
      } else if (isYearly) {
        newExpiresAt.add(1, 'year');
      } else {
        // Default or error
         newExpiresAt.add(1, 'month');
      }

      // 创建续订记录
      const renewedSubscription = await Subscription.create({
        company_id: user.Company.id,
        plan: planType.includes('pro') ? 'pro' : 'free',
        billing_cycle: isYearly ? 'annual' : 'monthly',
        status: 'active',
        end_at: newExpiresAt.toDate(),
        start_at: currentExpiresAt, // 从上期结束开始
        auto_renew: autoRenew || false,
        // quota: currentSubscription.quota // Copy quota?
      });

      // 更新用户状态 (Optional, if we keep user status synced)
      await User.update(
        { subscription_status: 'active' },
        { where: { id: userId } }
      );

      // 记录用户活动
      await UserActivity.create({
        user_id: userId,
        company_id: user.Company.id,
        action: 'subscription_renewed',
        details: {
          planType,
          expiresAt: newExpiresAt.toDate(),
          autoRenew: autoRenew || false
        }
      });

      res.json({
        success: true,
        data: {
          subscriptionId: renewedSubscription.id,
          planType: `${renewedSubscription.plan}_${renewedSubscription.billing_cycle}`,
          expiresAt: renewedSubscription.end_at,
          autoRenew: renewedSubscription.auto_renew
        }
      });
    } catch (error) {
      console.error('续订订阅失败:', error);
      res.status(500).json({
        success: false,
        error: '续订订阅失败'
      });
    }
  }

  // 取消订阅
  async cancelSubscription(req, res) {
    try {
      const userId = req.user.id;
      const { cancelAtPeriodEnd } = req.body;

      const user = await User.findByPk(userId, {
        include: [{
          model: Company,
          as: 'Company',
          include: [{
            model: Subscription,
            as: 'Subscriptions',
            where: { status: 'active' },
            order: [['created_at', 'DESC']]
          }]
        }]
      });

      let subscription = null;
      if (user && user.Company && user.Company.Subscriptions && user.Company.Subscriptions.length > 0) {
        subscription = user.Company.Subscriptions[0];
      }

      if (!subscription) {
        return res.status(400).json({
          success: false,
          error: '当前没有有效的订阅'
        });
      }

      if (cancelAtPeriodEnd) {
        // 到期后取消
        subscription.auto_renew = false;
        // subscription.status = 'cancel_at_period_end'; // Enum might not support this, keep active but no auto renew
        await subscription.save();
      } else {
        // 立即取消
        subscription.status = 'canceled';
        subscription.end_at = new Date(); // Effectively expired
        await subscription.save();

        // 更新用户状态
        await User.update(
          { subscription_status: 'cancelled' },
          { where: { id: userId } }
        );
      }

      // 记录用户活动
      await UserActivity.create({
        user_id: userId,
        company_id: user.Company ? user.Company.id : null,
        action: 'subscription_cancelled',
        details: {
          cancelAtPeriodEnd,
          subscriptionId: subscription.id
        }
      });

      res.json({
        success: true,
        data: {
          status: subscription.status,
          cancelledAt: new Date(),
          expiresAt: subscription.end_at,
          autoRenew: subscription.auto_renew
        }
      });
    } catch (error) {
      console.error('取消订阅失败:', error);
      res.status(500).json({
        success: false,
        error: '取消订阅失败'
      });
    }
  }

  // 获取订阅历史
  async getSubscriptionHistory(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, pageSize = 10 } = req.query;

      const user = await User.findByPk(userId, {
         include: [{ model: Company, as: 'Company' }]
      });

      if (!user || !user.Company) {
          return res.json({
            success: true,
            data: {
                subscriptions: [],
                total: 0,
                page: parseInt(page),
                pageSize: parseInt(pageSize),
                totalPages: 0
            }
          });
      }

      const subscriptions = await Subscription.findAndCountAll({
        where: { company_id: user.Company.id },
        order: [['created_at', 'DESC']],
        limit: parseInt(pageSize),
        offset: (parseInt(page) - 1) * parseInt(pageSize)
      });

      res.json({
        success: true,
        data: {
          subscriptions: subscriptions.rows,
          total: subscriptions.count,
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          totalPages: Math.ceil(subscriptions.count / parseInt(pageSize))
        }
      });
    } catch (error) {
      console.error('获取订阅历史失败:', error);
      res.status(500).json({
        success: false,
        error: '获取订阅历史失败'
      });
    }
  }

  // 获取订阅使用统计
  async getSubscriptionUsage(req, res) {
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
            order: [['created_at', 'DESC']]
          }]
        }]
      });

      let subscription = null;
      if (user && user.Company && user.Company.Subscriptions && user.Company.Subscriptions.length > 0) {
        subscription = user.Company.Subscriptions[0];
      }

      if (!subscription) {
        return res.json({
          success: true,
          data: {
            hasSubscription: false,
            usage: null
          }
        });
      }

      // 获取用户在当前订阅周期内的活动统计
      const startDate = subscription.start_at || subscription.startedAt || moment().startOf('month');
      const endDate = subscription.end_at || subscription.expiresAt || moment().endOf('month');

      const whereClause = {
        created_at: {
          [Op.between]: [startDate, endDate]
        },
        action: {
          [Op.in]: ['ai_analysis', 'resume_upload', 'job_matching']
        }
      };

      // 多租户隔离：如果订阅关联了公司，则按公司ID统计；否则（理论上不存在）按用户ID
      if (subscription.company_id) {
        whereClause.company_id = subscription.company_id;
      } else {
        whereClause.user_id = userId;
      }

      const activities = await UserActivity.findAll({
        where: whereClause
      });

      const usageStats = {
        aiAnalysisCount: activities.filter(a => a.action === 'ai_analysis').length,
        resumeUploadCount: activities.filter(a => a.action === 'resume_upload').length,
        jobMatchingCount: activities.filter(a => a.action === 'job_matching').length,
        totalUsage: activities.length
      };

      // 根据订阅类型计算限额
      const planType = subscription.planType || `${subscription.plan}_${subscription.billing_cycle}`;
      const limits = this.getSubscriptionLimits(planType);

      res.json({
        success: true,
        data: {
          hasSubscription: true,
          planType: planType,
          usage: usageStats,
          limits: limits,
          usagePercentage: {
            aiAnalysis: limits.aiAnalysis > 0 ? (usageStats.aiAnalysisCount / limits.aiAnalysis) * 100 : 0,
            total: limits.total > 0 ? (usageStats.totalUsage / limits.total) * 100 : 0
          }
        }
      });
    } catch (error) {
      console.error('获取订阅使用统计失败:', error);
      res.status(500).json({
        success: false,
        error: '获取使用统计失败'
      });
    }
  }

  // 获取订阅限额
  getSubscriptionLimits(planType) {
    const limits = {
      monthly: {
        basic: {
          aiAnalysis: 50,
          resumeUpload: 20,
          jobMatching: 30,
          total: 100
        },
        pro: {
          aiAnalysis: -1, // -1 表示无限制
          resumeUpload: -1,
          jobMatching: -1,
          total: -1
        }
      },
      yearly: {
        basic: {
          aiAnalysis: 600,
          resumeUpload: 240,
          jobMatching: 360,
          total: 1200
        },
        pro: {
          aiAnalysis: -1,
          resumeUpload: -1,
          jobMatching: -1,
          total: -1
        }
      }
    };

    // 简化处理
    if (planType.includes('pro') || planType.includes('enterprise')) {
         return limits.monthly.pro;
    }
    return limits.monthly.basic;
  }

  // 检查订阅状态（定时任务调用）
  async checkSubscriptionStatus() {
    try {
      const expiredSubscriptions = await Subscription.findAll({
        where: {
          status: 'active',
          end_at: {
            [Op.lt]: new Date()
          }
        },
        include: [{
          model: Company,
          as: 'Company'
        }]
      });

      // 获取系统操作员（管理员）用于记录日志
      let systemActorId = 1;
      try {
        const adminUser = await User.findOne({ where: { role: 'admin' } });
        if (adminUser) {
            systemActorId = adminUser.id;
        }
      } catch (e) {
        // Fallback to ID 1 if User find fails
      }

      for (const subscription of expiredSubscriptions) {
        const oldStatus = subscription.status;
        if (subscription.auto_renew) {
          // 这里可以添加自动续费逻辑
          // subscription.status = 'expired_auto_renew_failed'; 
          // For now just mark expired
           subscription.status = 'expired';
        } else {
          subscription.status = 'expired';
        }
        
        await subscription.save();

        // 更新用户状态
        if (subscription.Company) {
           // Find users of this company
           await User.update(
             { subscription_status: 'expired' },
             { where: { company_id: subscription.Company.id } }
           );
        }

        // 记录系统日志
        try {
            await AuditLog.create({
                actor_account_id: systemActorId,
                action: 'subscription_expired_system_check',
                resource_type: 'subscription',
                resource_id: subscription.id,
                payload: {
                    company_id: subscription.company_id,
                    plan: subscription.plan,
                    old_status: oldStatus,
                    new_status: subscription.status,
                    auto_renew: subscription.auto_renew,
                    end_at: subscription.end_at
                },
                ip: '127.0.0.1',
                ua: 'System/Scheduler'
            });
        } catch (logError) {
            console.error('Failed to write audit log for subscription expiration:', logError);
        }
      }

      return expiredSubscriptions.length;
    } catch (error) {
      console.error('检查订阅状态失败:', error);
      return 0;
    }
  }

  // 升级订阅
  async upgradeSubscription(req, res) {
    try {
      const userId = req.user.id;
      const { targetPlan } = req.body;

      const user = await User.findByPk(userId, {
        include: [{
          model: Company,
          as: 'Company',
          include: [{
            model: Subscription,
            as: 'Subscriptions',
            where: { status: 'active' },
            order: [['created_at', 'DESC']]
          }]
        }]
      });

      let currentSubscription = null;
      if (user && user.Company && user.Company.Subscriptions && user.Company.Subscriptions.length > 0) {
        currentSubscription = user.Company.Subscriptions[0];
      }

      if (!currentSubscription) {
        return res.status(400).json({
          success: false,
          error: '当前没有有效的订阅'
        });
      }

      const currentExpiresAt = moment(currentSubscription.end_at || currentSubscription.expiresAt);
      let newExpiresAt = currentExpiresAt.clone();

      const isMonthly = targetPlan.includes('monthly');
      const isYearly = targetPlan.includes('yearly');

      if (isMonthly) {
        newExpiresAt.add(1, 'month');
      } else if (isYearly) {
        newExpiresAt.add(1, 'year');
      }

      // 取消当前订阅 (mark as upgraded?)
      // currentSubscription.status = 'upgraded'; // Enum limitation?
      currentSubscription.status = 'expired'; // Or canceled
      await currentSubscription.save();

      // 创建新订阅
      const newSubscription = await Subscription.create({
        company_id: user.Company.id,
        plan: targetPlan.includes('pro') ? 'pro' : 'free',
        billing_cycle: isYearly ? 'annual' : 'monthly',
        status: 'active',
        end_at: newExpiresAt.toDate(),
        start_at: currentExpiresAt,
        // upgradedFrom: currentSubscription.id
      });

      // 记录用户活动
      await UserActivity.create({
        user_id: userId,
        company_id: user.Company.id,
        action: 'subscription_upgraded',
        details: {
          fromPlan: currentSubscription.plan,
          toPlan: targetPlan,
          oldSubscriptionId: currentSubscription.id,
          newSubscriptionId: newSubscription.id
        }
      });

      res.json({
        success: true,
        data: {
          newSubscriptionId: newSubscription.id,
          planType: `${newSubscription.plan}_${newSubscription.billing_cycle}`,
          expiresAt: newSubscription.end_at
        }
      });
    } catch (error) {
      console.error('升级订阅失败:', error);
      res.status(500).json({
        success: false,
        error: '升级订阅失败'
      });
    }
  }
}

module.exports = new SubscriptionController();