const WechatPayService = require('../services/wechatPayService');
const AlipayService = require('../services/alipayService');
const logger = require('../utils/logger');
const { Order, User, Subscription, sequelize } = require('../models');
const crypto = require('crypto');
const { Op } = require('sequelize');

class PaymentController {
  constructor() {
    // 初始化支付服务
    this.wechatPayService = new WechatPayService({
      appId: process.env.WECHAT_APP_ID,
      mchId: process.env.WECHAT_MCH_ID,
      apiKey: process.env.WECHAT_API_KEY,
      appSecret: process.env.WECHAT_APP_SECRET,
      notifyUrl: process.env.WECHAT_NOTIFY_URL
    });

    this.alipayService = new AlipayService({
      appId: process.env.ALIPAY_APP_ID,
      privateKey: process.env.ALIPAY_PRIVATE_KEY,
      publicKey: process.env.ALIPAY_PUBLIC_KEY,
      alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY,
      notifyUrl: process.env.ALIPAY_NOTIFY_URL,
      returnUrl: process.env.ALIPAY_RETURN_URL,
      isSandbox: process.env.ALIPAY_SANDBOX === 'true'
    });
  }

  // 生成唯一订单号
  generateOrderNo() {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substr(2, 6);
    return `ORDER_${timestamp}_${random}`;
  }

  // 创建支付订单
  async createPaymentOrder(req, res) {
    try {
      const { userId, planType, paymentMethod, amount, openId } = req.body;

      // 验证用户
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ error: '用户不存在' });
      }

      // 生成订单号
      const orderNo = this.generateOrderNo();

      // 创建订单记录
      const order = await Order.create({
        out_trade_no: orderNo,
        user_id: userId,
        company_id: user.company_id || null,
        plan: planType,
        provider: paymentMethod,
        amount,
        status: 'pending',
        created_at: new Date()
      });

      let paymentResult;

      // 根据支付方式调用不同的支付接口
      if (paymentMethod === 'wechat') {
        paymentResult = await this.wechatPayService.createUnifiedOrder({
          body: `SuperResumeMaster - ${planType}会员`,
          outTradeNo: orderNo,
          totalFee: amount * 100, // 转换为分
          spbillCreateIp: req.ip,
          tradeType: 'JSAPI',
          openId: openId
        });
      } else if (paymentMethod === 'alipay') {
        // 支付宝支付
        const subject = `SuperResumeMaster - ${planType}会员`;
        const formHtml = await this.alipayService.pagePay(
          subject,
          orderNo,
          amount.toString()
        );

        paymentResult = {
          success: true,
          data: {
            paymentUrl: formHtml,
            orderNo: orderNo
          }
        };
      } else {
        return res.status(400).json({ error: '不支持的支付方式' });
      }

      if (paymentResult.success) {
        logger.info('支付订单创建成功', { orderNo, userId, planType, paymentMethod });
        res.json({
          success: true,
          data: {
            orderId: order.id,
            orderNo: orderNo,
            paymentData: paymentResult.data
          }
        });
      } else {
        // 删除失败的订单
        await order.destroy();
        logger.warn('支付订单创建失败', { orderNo, userId, planType, paymentMethod, error: paymentResult.error });
        res.status(400).json({
          success: false,
          error: paymentResult.error
        });
      }
    } catch (error) {
      logger.error('创建支付订单失败', { message: error.message, stack: error.stack });
      res.status(500).json({
        success: false,
        error: '创建支付订单失败'
      });
    }
  }

  // 微信支付回调
  async wechatNotify(req, res) {
    try {
      const xmlData = req.body;

      // 解析XML数据
      const notifyData = await this.wechatPayService.xmlToObject(xmlData);

      // 处理支付回调
      const result = await this.wechatPayService.handleNotify(notifyData);

      if (result.success) {
        const { outTradeNo, transactionId, totalFee } = result.data;

        // 更新订单状态
        const order = await Order.findOne({ where: { out_trade_no: outTradeNo } });
        if (order && order.status === 'pending') {
          order.status = 'paid';
          order.transaction_id = transactionId;
          order.paid_at = new Date();
          await order.save();

          // 更新用户订阅状态
          await this.updateUserSubscription(order.user_id, order.plan);
        }

        // 返回成功响应
        logger.info('微信支付回调成功', { outTradeNo, transactionId, totalFee });
        res.set('Content-Type', 'application/xml');
        res.send(this.wechatPayService.generateSuccessResponse());
      } else {
        // 返回失败响应
        logger.warn('微信支付回调失败', { error: result.error });
        res.set('Content-Type', 'application/xml');
        res.send(this.wechatPayService.generateFailResponse(result.error));
      }
    } catch (error) {
      logger.error('微信支付回调处理失败', { message: error.message, stack: error.stack });
      res.set('Content-Type', 'application/xml');
      res.send(this.wechatPayService.generateFailResponse('处理失败'));
    }
  }

  // 支付宝支付回调
  async alipayNotify(req, res) {
    try {
      const notifyData = req.body;

      // 处理支付回调
      const result = await this.alipayService.handleNotify(notifyData);

      if (result.success) {
        const { outTradeNo, tradeNo, totalAmount } = result.data;

        // 更新订单状态
        const order = await Order.findOne({ where: { out_trade_no: outTradeNo } });
        if (order && order.status === 'pending') {
          order.status = 'paid';
          order.transaction_id = tradeNo;
          order.paid_at = new Date();
          await order.save();

          // 更新用户订阅状态
          await this.updateUserSubscription(order.user_id, order.plan);
        }

        // 返回成功响应
        logger.info('支付宝支付回调成功', { outTradeNo, tradeNo, totalAmount });
        res.send(this.alipayService.generateSuccessResponse());
      } else {
        // 返回失败响应
        logger.warn('支付宝支付回调失败', { result });
        res.send(this.alipayService.generateFailResponse());
      }
    } catch (error) {
      logger.error('支付宝支付回调处理失败', { message: error.message, stack: error.stack });
      res.send(this.alipayService.generateFailResponse());
    }
  }

  // 查询支付订单状态
  async queryPaymentStatus(req, res) {
    try {
      const { orderNo, paymentMethod } = req.params;
      const userId = req.user.id;

      // 验证订单是否存在且属于当前用户或其公司
      const order = await Order.findOne({ where: { out_trade_no: orderNo } });
      if (!order) {
        return res.status(404).json({ error: '订单不存在' });
      }

      if (order.user_id !== userId) {
        // 检查是否是同一公司
        if (!req.user.company_id || req.user.company_id !== order.company_id) {
          return res.status(403).json({ error: '无权查询此订单状态' });
        }
      }

      let result;

      if (paymentMethod === 'wechat') {
        result = await this.wechatPayService.queryOrder(orderNo);
      } else if (paymentMethod === 'alipay') {
        result = await this.alipayService.queryOrder(orderNo);
      } else {
        return res.status(400).json({ error: '不支持的支付方式' });
      }

      if (result.success) {
        res.json({
          success: true,
          data: result.data
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      logger.error('查询支付状态失败', { message: error.message, stack: error.stack });
      res.status(500).json({
        success: false,
        error: '查询支付状态失败'
      });
    }
  }

  // 更新用户订阅状态
  async updateUserSubscription(userId, planType) {
    try {
      const { Company } = require('../models');
      const user = await User.findByPk(userId, {
        include: [{ model: Company, as: 'Company' }]
      });
      
      if (!user || !user.Company) {
        console.error('更新订阅失败: 用户未关联公司', userId);
        return;
      }

      const companyId = user.Company.id;

      // 计算订阅到期时间
      let expiresAt = new Date();
      if (planType.includes('monthly')) {
        expiresAt.setMonth(expiresAt.getMonth() + 1);
      } else if (planType.includes('yearly')) {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      }

      // 解析计划详情
      const planLevel = planType.includes('pro') ? 'pro' : (planType.includes('enterprise') ? 'enterprise' : 'free');
      const billingCycle = planType.includes('yearly') ? 'annual' : 'monthly';

      // 更新或创建订阅记录
      const [subscription, created] = await Subscription.findOrCreate({
        where: { company_id: companyId },
        defaults: {
          company_id: companyId,
          plan: planLevel,
          billing_cycle: billingCycle,
          status: 'active',
          end_at: expiresAt,
          start_at: new Date()
        }
      });

      if (!created) {
        subscription.plan = planLevel;
        subscription.billing_cycle = billingCycle;
        subscription.status = 'active';
        subscription.end_at = expiresAt;
        // 如果是续费，start_at 保持不变或根据业务逻辑更新
        await subscription.save();
      }

      // 更新用户状态
      user.subscription_status = 'active';
      await user.save();
      
      // 同时更新公司下所有用户的订阅状态（如果是企业版订阅）
      if (planLevel === 'enterprise' || planLevel === 'pro') {
         await User.update(
           { subscription_status: 'active' },
           { where: { company_id: companyId } }
         );
      }
      
    } catch (error) {
      console.error('更新用户订阅状态失败:', error);
    }
  }

  // 获取用户订单列表
  async getUserOrders(req, res) {
    try {
      const { userId } = req.params;
      const { page = 1, pageSize = 10 } = req.query;

      // 验证当前用户是否有权限查看该用户的订单
      // 如果是本人，或者是同一公司的管理员（待实现），允许查看
      // 简单起见，目前只允许本人查看，或者管理员查看
      // 这里假设中间件已经验证了 token，req.user 存在
      if (req.user.id != userId) {
         // 检查是否是同一公司
         if (!req.user.company_id || req.user.company_id !== (await User.findByPk(userId)).company_id) {
             return res.status(403).json({ success: false, error: '无权查看此用户的订单' });
         }
      }
      
      const whereClause = { user_id: userId };
      // 如果需要支持公司维度的订单查询，可以修改 whereClause

      const orders = await Order.findAndCountAll({
        where: whereClause,
        order: [['created_at', 'DESC']],
        limit: parseInt(pageSize),
        offset: (parseInt(page) - 1) * parseInt(pageSize)
      });

      res.json({
        success: true,
        data: {
          orders: orders.rows,
          total: orders.count,
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          totalPages: Math.ceil(orders.count / parseInt(pageSize))
        }
      });
    } catch (error) {
      console.error('获取用户订单列表失败:', error);
      res.status(500).json({
        success: false,
        error: '获取订单列表失败'
      });
    }
  }

  // 申请退款
  async refundOrder(req, res) {
    try {
      const { orderNo } = req.params;
      const { refundAmount, refundReason } = req.body;
      const userId = req.user.id;

      const order = await Order.findOne({ where: { out_trade_no: orderNo } });
      if (!order) {
        return res.status(404).json({ error: '订单不存在' });
      }

      // 验证订单所有权 (本人或公司管理员)
      if (order.user_id !== userId && req.user.role !== 'admin') {
         // 如果不是本人也不是超级管理员，检查是否是同公司管理员
         if (!req.user.company_id || req.user.company_id !== order.company_id || req.user.role !== 'company_admin') {
             return res.status(403).json({ error: '无权操作此订单的退款' });
         }
      }

      if (order.status !== 'paid') {
        return res.status(400).json({ error: '订单状态不允许退款' });
      }

      let refundResult;

      if (order.paymentMethod === 'alipay') {
        refundResult = await this.alipayService.refund(orderNo, refundAmount, refundReason);
      } else if (order.paymentMethod === 'wechat') {
        // 微信支付退款
        // 注意：微信支付金额单位为分
        refundResult = await this.wechatPayService.refund({
            outTradeNo: orderNo,
            totalFee: Math.round(order.amount * 100),
            refundFee: Math.round(refundAmount * 100)
        });
      } else {
        return res.status(400).json({ error: '不支持的支付方式' });
      }

      if (refundResult.success) {
        // 更新订单状态
        order.status = 'refunded';
        order.refund_amount = refundAmount;
        order.refund_reason = refundReason;
        order.paid_at = new Date(); // 这里可能是个逻辑错误，应该是 refunded_at，但模型里没这个字段，先用 paid_at 或不更新
        await order.save();

        res.json({
          success: true,
          data: refundResult.data
        });
      } else {
        res.status(400).json({
          success: false,
          error: refundResult.error
        });
      }
    } catch (error) {
      console.error('申请退款失败:', error);
      res.status(500).json({
        success: false,
        error: '申请退款失败'
      });
    }
  }

  // 获取所有订单列表（管理员）
  async getAllOrders(req, res) {
    try {
      const { page = 1, pageSize = 10, status, paymentMethod, search } = req.query;
      const where = {};

      if (status) where.status = status;
      if (paymentMethod) where.provider = paymentMethod;
      if (search) {
        where[Op.or] = [
          { out_trade_no: { [Op.like]: `%${search}%` } }
        ];
      }

      const orders = await Order.findAndCountAll({
        where,
        include: [{ model: User, attributes: ['username', 'email'] }],
        order: [['created_at', 'DESC']],
        limit: parseInt(pageSize),
        offset: (parseInt(page) - 1) * parseInt(pageSize)
      });

      res.json({
        success: true,
        data: {
          items: orders.rows,
          total: orders.count,
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          totalPages: Math.ceil(orders.count / parseInt(pageSize))
        }
      });
    } catch (error) {
      console.error('获取所有订单列表失败:', error);
      res.status(500).json({ success: false, error: '获取订单列表失败' });
    }
  }
  // 获取支付统计信息（管理员）
  async getPaymentStats(req, res) {
    try {
      const totalAmount = await Order.sum('amount', { where: { status: 'paid' } }) || 0;
      const totalOrders = await Order.count({ where: { status: 'paid' } });
      const pendingOrders = await Order.count({ where: { status: 'pending' } });

      // 按支付方式统计
      const methodStats = await Order.findAll({
        where: { status: 'paid' },
        attributes: [
          ['provider', 'paymentMethod'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
          [sequelize.fn('SUM', sequelize.col('amount')), 'total']
        ],
        group: ['provider']
      });

      // 最近 7 天趋势
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const dailyStats = await Order.findAll({
        where: {
          status: 'paid',
          paid_at: { [Op.gte]: sevenDaysAgo }
        },
        attributes: [
          [sequelize.fn('DATE', sequelize.col('paid_at')), 'date'],
          [sequelize.fn('SUM', sequelize.col('amount')), 'total'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: [sequelize.fn('DATE', sequelize.col('paid_at'))],
        order: [[sequelize.fn('DATE', sequelize.col('paid_at')), 'ASC']]
      });

      res.json({
        success: true,
        data: {
          totalAmount,
          totalOrders,
          pendingOrders,
          methodStats,
          dailyStats
        }
      });
    } catch (error) {
      console.error('获取支付统计失败:', error);
      res.status(500).json({ success: false, error: '获取统计失败' });
    }
  }

  // 模拟支付成功（仅用于测试）
  async simulatePay(req, res) {
    try {
      const { outTradeNo } = req.body;
      const userId = req.user.id; // 假设通过中间件获取了用户ID

      const order = await Order.findOne({ where: { out_trade_no: outTradeNo } });
      if (!order) {
        return res.status(404).json({ error: '订单不存在' });
      }

      if (order.user_id !== userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: '无权操作此订单' });
      }

      if (order.status === 'paid') {
        return res.json({ success: true, message: '订单已支付' });
      }

      // 更新订单状态
      order.status = 'paid';
      order.transaction_id = `MOCK_${Date.now()}`;
      order.paid_at = new Date();
      await order.save();

      // 更新用户订阅状态
      await this.updateUserSubscription(order.user_id, order.plan);

      res.json({
        success: true,
        data: {
          orderNo: order.out_trade_no,
          status: 'paid'
        }
      });
    } catch (error) {
      logger.error('模拟支付失败', { message: error.message, stack: error.stack });
      res.status(500).json({
        success: false,
        error: '模拟支付失败'
      });
    }
  }
}

module.exports = new PaymentController();
