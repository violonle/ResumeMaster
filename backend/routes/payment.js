const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticate } = require('../middleware/auth');
const { authenticateToken, requireAdmin } = require('../middleware/adminAuth');

// 支付相关路由

// 创建支付订单（需要认证）
router.post('/create-order', authenticate, paymentController.createPaymentOrder);

// 查询支付订单状态
router.get('/query-status/:orderNo/:paymentMethod', authenticate, paymentController.queryPaymentStatus);

// 获取用户订单列表
router.get('/user-orders/:userId', authenticate, paymentController.getUserOrders);

// 获取所有订单（管理员）
router.get('/orders', authenticateToken, requireAdmin, paymentController.getAllOrders);

// 获取支付统计信息（管理员）
router.get('/stats', authenticateToken, requireAdmin, paymentController.getPaymentStats);

// 申请退款
router.post('/refund/:orderNo', authenticate, paymentController.refundOrder);

// 模拟支付（仅用于测试，需要认证）
router.post('/simulate', authenticate, (req, res) => paymentController.simulatePay(req, res));

// 微信支付回调（无需认证）
router.post('/wechat-notify', paymentController.wechatNotify);

// 支付宝支付回调（无需认证）
router.post('/alipay-notify', paymentController.alipayNotify);

module.exports = router;