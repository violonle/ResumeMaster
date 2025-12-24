const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');
const { authenticate } = require('../middleware/auth');
const Permission = require('../middleware/permission');

// 创建发票
router.post('/create', authenticate, Permission.requireSubscription, Permission.rateLimit(100, 24 * 60 * 60 * 1000), invoiceController.createInvoice);

// 获取所有发票列表（管理员）
router.get('/all', authenticate, Permission.rateLimit(500, 60 * 60 * 1000), invoiceController.getAllInvoices);

// 获取用户发票列表
router.get('/list', authenticate, Permission.rateLimit(500, 60 * 60 * 1000), invoiceController.getUserInvoices);

// 获取发票详情
router.get('/:invoiceId', authenticate, Permission.rateLimit(500, 60 * 60 * 1000), invoiceController.getInvoiceDetails);

// 下载发票PDF
router.get('/:invoiceId/download', authenticate, Permission.requireSubscription, Permission.checkApiLimit('export'), Permission.rateLimit(200, 24 * 60 * 60 * 1000), invoiceController.downloadInvoice);

// 更新发票信息
router.put('/:invoiceId', authenticate, Permission.requireSubscription, Permission.rateLimit(200, 24 * 60 * 60 * 1000), invoiceController.updateInvoice);

// 申请红字发票
router.post('/:invoiceId/red', authenticate, Permission.requireSubscription, Permission.rateLimit(50, 24 * 60 * 60 * 1000), invoiceController.applyRedInvoice);

// 获取发票统计信息
router.get('/stats/summary', authenticate, Permission.rateLimit(200, 60 * 60 * 1000), invoiceController.getInvoiceStats);

// 验证发票信息
router.post('/validate', authenticate, Permission.requireSubscription, Permission.rateLimit(200, 24 * 60 * 60 * 1000), invoiceController.validateInvoiceData);

// 获取可开票订单
router.get('/orders/invoiceable', authenticate, Permission.rateLimit(200, 60 * 60 * 1000), invoiceController.getInvoiceableOrders);

module.exports = router;
