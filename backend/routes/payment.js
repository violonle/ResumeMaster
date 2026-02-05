const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticate } = require('../middleware/auth');
const { authenticateToken, requireAdmin } = require('../middleware/adminAuth');

// 支付相关路由

// 获取支付配置状态（移动端和桌面端都需要先检查哪些支付方式可用）
router.get('/config', (req, res) => paymentController.getPaymentConfig(req, res));

// 创建支付订单（需要认证）
router.post('/create-order', authenticate, (req, res) => paymentController.createPaymentOrder(req, res));

// 查询支付订单状态
router.get('/query-status/:orderNo/:paymentMethod', authenticate, (req, res) => paymentController.queryPaymentStatus(req, res));

// 获取用户订单列表
router.get('/user-orders/:userId', authenticate, (req, res) => paymentController.getUserOrders(req, res));

// 获取所有订单（管理员）
router.get('/orders', authenticateToken, requireAdmin, (req, res) => paymentController.getAllOrders(req, res));

// 获取支付统计信息（管理员）
router.get('/stats', authenticateToken, requireAdmin, (req, res) => paymentController.getPaymentStats(req, res));

// 申请退款
router.post('/refund/:orderNo', authenticate, (req, res) => paymentController.refundOrder(req, res));

// 模拟支付（仅用于测试，需要认证）
router.post('/simulate', authenticate, (req, res) => paymentController.simulatePay(req, res));

// 微信支付回调（无需认证）
router.post('/wechat-notify', (req, res) => paymentController.wechatNotify(req, res));

// 支付宝支付回调（无需认证）
router.post('/alipay-notify', (req, res) => paymentController.alipayNotify(req, res));

module.exports = router;