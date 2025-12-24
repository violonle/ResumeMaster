const express = require('express');
const { authenticate } = require('../middleware/auth');
const { createOrder, getOrderStatus, alipayCallback, wechatCallback, simulatePay } = require('../controllers/paymentController');

const router = express.Router();

// 创建订单（需要登录）
router.post('/orders', authenticate, createOrder);

// 查询订单状态（需要登录）
router.get('/orders/status/:outTradeNo', authenticate, getOrderStatus);

// 支付平台回调（不需要登录）
router.post('/callback/alipay', alipayCallback);
router.post('/callback/wechat', wechatCallback);

// 演示模式：模拟支付成功（需要登录）
router.post('/simulate', authenticate, simulatePay);

module.exports = router;