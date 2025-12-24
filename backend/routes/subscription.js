const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const { authenticate } = require('../middleware/auth');

// 获取用户订阅信息
router.get('/current', authenticate, subscriptionController.getUserSubscription);

// 获取可用订阅计划
router.get('/plans', authenticate, subscriptionController.getAvailablePlans);

// 续订订阅
router.post('/renew', authenticate, subscriptionController.renewSubscription);

// 升级订阅
router.post('/upgrade', authenticate, subscriptionController.upgradeSubscription);

// 取消订阅
router.post('/cancel', authenticate, subscriptionController.cancelSubscription);

// 获取订阅历史
router.get('/history', authenticate, subscriptionController.getSubscriptionHistory);

// 获取订阅使用统计
router.get('/usage', authenticate, subscriptionController.getSubscriptionUsage);

module.exports = router;