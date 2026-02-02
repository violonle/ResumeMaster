const { User, Subscription, Company, UserActivity } = require('../models');
const { Op } = require('sequelize');
const moment = require('moment');
const PermissionMiddleware = require('../middleware/permission');

class PermissionController {
  // 获取用户权限信息
  async getUserPermissions(req, res) {
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

      if (!user) {
        return res.status(404).json({
          success: false,
          error: '用户不存在'
        });
      }

      let subscription = null;
      if (user.Company && user.Company.Subscriptions && user.Company.Subscriptions.length > 0) {
        subscription = user.Company.Subscriptions[0];
      }

      let permissions = {
        canUseAI: false,
        canUploadFiles: false,
        canExportData: false,
        canUseAPI: false,
        maxAIAnalysis: 0,
        maxFileUploads: 0,
        maxStorage: 0,
        planType: 'free'
      };

      if (subscription) {
        const isExpired = moment(subscription.end_at || subscription.expiresAt).isBefore(moment());
        
        if (!isExpired) {
           // 规范化 planType
           const planType = subscription.planType || `${subscription.plan || 'basic'}_${subscription.billing_cycle || 'monthly'}`;
          permissions = this.getPlanPermissions(planType);
          permissions.planType = planType;
        }
      }

      // 获取当前使用情况
      const usage = await this.getCurrentUsage(user, subscription);

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            subscriptionStatus: user.subscription_status
          },
          subscription: subscription ? {
            id: subscription.id,
            planType: permissions.planType,
            status: subscription.status,
            expiresAt: subscription.end_at || subscription.expiresAt,
            startedAt: subscription.start_at || subscription.startedAt,
            autoRenew: subscription.auto_renew || subscription.autoRenew
          } : null,
          permissions,
          usage,
          isExpired: subscription ? moment(subscription.end_at || subscription.expiresAt).isBefore(moment()) : false
        }
      });
    } catch (error) {
      console.error('获取用户权限信息失败:', error);
      res.status(500).json({
        success: false,
        error: '获取权限信息失败'
      });
    }
  }

  // 根据订阅类型获取权限
  getPlanPermissions(planType) {
    const permissions = {
      basic_monthly: {
        canUseAI: true,
        canUploadFiles: true,
        canExportData: true,
        canUseAPI: false,
        maxAIAnalysis: 50,
        maxFileUploads: 20,
        maxStorage: 100 * 1024 * 1024 // 100MB
      },
      basic_yearly: {
        canUseAI: true,
        canUploadFiles: true,
        canExportData: true,
        canUseAPI: false,
        maxAIAnalysis: 600,
        maxFileUploads: 240,
        maxStorage: 1000 * 1024 * 1024 // 1GB
      },
      pro_monthly: {
        canUseAI: true,
        canUploadFiles: true,
        canExportData: true,
        canUseAPI: true,
        maxAIAnalysis: -1, // 无限制
        maxFileUploads: -1,
        maxStorage: -1
      },
      pro_yearly: {
        canUseAI: true,
        canUploadFiles: true,
        canExportData: true,
        canUseAPI: true,
        maxAIAnalysis: -1,
        maxFileUploads: -1,
        maxStorage: -1
      }
    };

    return permissions[planType] || {
      canUseAI: false,
      canUploadFiles: false,
      canExportData: false,
      canUseAPI: false,
      maxAIAnalysis: 0,
      maxFileUploads: 0,
      maxStorage: 0
    };
  }

  // 获取当前使用情况
  async getCurrentUsage(user, subscription) {
    const { UserActivity } = require('../models');
    
    if (!subscription) {
      return {
        aiAnalysis: 0,
        fileUploads: 0,
        storage: 0,
        apiCalls: 0
      };
    }

    const startDate = subscription.start_at ? moment(subscription.start_at).toDate() : moment().startOf('month').toDate();
    const endDate = subscription.end_at ? moment(subscription.end_at).toDate() : moment().endOf('month').toDate();

    const whereClause = {
      created_at: {
        [Op.between]: [startDate, endDate]
      },
      action: {
        [Op.in]: ['ai_analysis', 'resume_upload', 'job_matching', 'api_call']
      }
    };

    // 如果是企业订阅，按公司ID统计；否则按用户ID统计
    if (subscription.company_id) {
      whereClause.company_id = subscription.company_id;
    } else {
      whereClause.user_id = user.id;
    }

    const activities = await UserActivity.findAll({
      where: whereClause
    });

    return {
      aiAnalysis: activities.filter(a => a.action === 'ai_analysis').length,
      fileUploads: activities.filter(a => a.action === 'resume_upload').length,
      storage: 0, // 这里需要计算实际存储大小
      apiCalls: activities.filter(a => a.action === 'api_call').length
    };
  }

  // 检查特定权限
  async checkPermission(req, res) {
    try {
      const userId = req.user.id;
      const { permission } = req.params;

      const whereClause = {
        id: userId
      };

      const user = await User.findOne({
        where: whereClause,
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

      if (!user) {
        return res.status(404).json({
          success: false,
          error: '用户不存在'
        });
      }

      let subscription = null;
      if (user.Company && user.Company.Subscriptions && user.Company.Subscriptions.length > 0) {
        subscription = user.Company.Subscriptions[0];
      }

      let hasPermission = false;

      if (subscription) {
        const isExpired = moment(subscription.end_at || subscription.expiresAt).isBefore(moment());
        
        if (!isExpired) {
          const planType = subscription.planType || `${subscription.plan || 'basic'}_${subscription.billing_cycle || 'monthly'}`;
          const permissions = this.getPlanPermissions(planType);
          hasPermission = permissions[permission] || false;
        }
      }

      res.json({
        success: true,
        data: {
          permission,
          hasPermission,
          requiresSubscription: !hasPermission && user.role !== 'admin'
        }
      });
    } catch (error) {
      console.error('检查权限失败:', error);
      res.status(500).json({
        success: false,
        error: '检查权限失败'
      });
    }
  }

  // 获取权限列表
  async getPermissionList(req, res) {
    try {
      const permissions = [
        {
          key: 'canUseAI',
          name: '使用AI分析',
          description: '使用AI进行简历分析和职位匹配',
          category: '核心功能'
        },
        {
          key: 'canUploadFiles',
          name: '文件上传',
          description: '上传简历文件进行解析',
          category: '核心功能'
        },
        {
          key: 'canExportData',
          name: '数据导出',
          description: '导出分析结果和数据报告',
          category: '数据功能'
        },
        {
          key: 'canUseAPI',
          name: 'API访问',
          description: '使用API接口进行集成开发',
          category: '高级功能'
        },
        {
          key: 'maxAIAnalysis',
          name: 'AI分析次数',
          description: '每月AI分析的最大次数',
          category: '使用限制'
        },
        {
          key: 'maxFileUploads',
          name: '文件上传次数',
          description: '每月文件上传的最大次数',
          category: '使用限制'
        },
        {
          key: 'maxStorage',
          name: '存储空间',
          description: '可用的最大存储空间',
          category: '使用限制'
        }
      ];

      res.json({
        success: true,
        data: permissions
      });
    } catch (error) {
      console.error('获取权限列表失败:', error);
      res.status(500).json({
        success: false,
        error: '获取权限列表失败'
      });
    }
  }

  // 记录权限检查失败
  async logPermissionDenied(req, res) {
    try {
      const userId = req.user.id;
      const { permission, reason } = req.body;

      await UserActivity.create({
        user_id: userId,
        company_id: req.user.company_id || null,
        action: 'permission_denied',
        details: {
          permission,
          reason,
          endpoint: req.path,
          method: req.method
        }
      });

      res.json({
        success: true,
        message: '权限拒绝已记录'
      });
    } catch (error) {
      console.error('记录权限拒绝失败:', error);
      res.status(500).json({
        success: false,
        error: '记录权限拒绝失败'
      });
    }
  }

  // 获取权限使用统计
  async getPermissionStats(req, res) {
    try {
      const userId = req.user.id;
      
      // 获取用户的权限拒绝记录
      const deniedActivities = await UserActivity.findAll({
        where: {
          user_id: userId,
          action: 'permission_denied'
        },
        order: [['created_at', 'DESC']],
        limit: 10
      });

      // 获取用户的功能使用情况
      const usageActivities = await UserActivity.findAll({
        where: {
          user_id: userId,
          action: {
            [Op.in]: ['ai_analysis', 'resume_upload', 'job_matching', 'api_call']
          }
        },
        attributes: [
          ['action', 'activityType'],
          [require('sequelize').fn('COUNT', '*'), 'count']
        ],
        group: ['action']
      });

      const usageStats = usageActivities.reduce((acc, activity) => {
        acc[activity.dataValues.activityType] = parseInt(activity.dataValues.count);
        return acc;
      }, {});

      res.json({
        success: true,
        data: {
          recentDenials: deniedActivities.map(activity => ({
            permission: activity.details.permission,
            reason: activity.details.reason,
            timestamp: activity.created_at
          })),
          usageStats,
          totalDenials: deniedActivities.length
        }
      });
    } catch (error) {
      console.error('获取权限使用统计失败:', error);
      res.status(500).json({
        success: false,
        error: '获取权限使用统计失败'
      });
    }
  }
}

module.exports = new PermissionController();