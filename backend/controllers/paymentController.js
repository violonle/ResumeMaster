const WechatPayService = require('../services/wechatPayService');
const AlipayService = require('../services/alipayService');
const logger = require('../utils/logger');
const { Order, User, Subscription } = require('../models');
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
        orderNo,
        userId,
        company_id: user.company_id || null,
        planType,
        paymentMethod,
        amount,
        status: 'pending',
        createdAt: new Date()
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
        const order = await Order.findOne({ where: { orderNo: outTradeNo } });
        if (order && order.status === 'pending') {
          order.status = 'paid';
          order.transactionId = transactionId;
          order.paidAt = new Date();
          await order.save();

          // 更新用户订阅状态
          await this.updateUserSubscription(order.userId, order.planType);
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
        const order = await Order.findOne({ where: { orderNo: outTradeNo } });
        if (order && order.status === 'pending') {
          order.status = 'paid';
          order.transactionId = tradeNo;
          order.paidAt = new Date();
          await order.save();

          // 更新用户订阅状态
          await this.updateUserSubscription(order.userId, order.planType);
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
      
      const whereClause = { userId };
      // 如果需要支持公司维度的订单查询，可以修改 whereClause

      const orders = await Order.findAndCountAll({
        where: whereClause,
        order: [['createdAt', 'DESC']],
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

      const order = await Order.findOne({ where: { orderNo } });
      if (!order) {
        return res.status(404).json({ error: '订单不存在' });
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
        order.refundAmount = refundAmount;
        order.refundReason = refundReason;
        order.refundedAt = new Date();
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
      if (paymentMethod) where.paymentMethod = paymentMethod;
      if (search) {
        where[Op.or] = [
          { orderNo: { [Op.like]: `%${search}%` } }
        ];
      }

      const orders = await Order.findAndCountAll({
        where,
        include: [{ model: User, attributes: ['username', 'email'] }],
        order: [['createdAt', 'DESC']],
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
  // 模拟支付成功（仅用于测试）
  async simulatePay(req, res) {
    try {
      const { outTradeNo } = req.body;
      const userId = req.user.id; // 假设通过中间件获取了用户ID

      const order = await Order.findOne({ where: { orderNo: outTradeNo } });
      if (!order) {
        return res.status(404).json({ error: '订单不存在' });
      }

      if (order.userId !== userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: '无权操作此订单' });
      }

      if (order.status === 'paid') {
        return res.json({ success: true, message: '订单已支付' });
      }

      // 更新订单状态
      order.status = 'paid';
      order.transactionId = `MOCK_${Date.now()}`;
      order.paidAt = new Date();
      await order.save();

      // 更新用户订阅状态
      await this.updateUserSubscription(order.userId, order.planType);

      res.json({
        success: true,
        data: {
          orderNo: order.orderNo,
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
