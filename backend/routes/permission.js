const express = require('express');
const router = express.Router();
const permissionController = require('../controllers/permissionController');
const { authenticate } = require('../middleware/auth');

// 获取用户权限信息
router.get('/me', authenticate, permissionController.getUserPermissions);

// 检查特定权限
router.get('/check/:permission', authenticate, permissionController.checkPermission);

// 获取权限列表
router.get('/list', authenticate, permissionController.getPermissionList);

// 记录权限检查失败
router.post('/log-denied', authenticate, permissionController.logPermissionDenied);

// 获取权限使用统计
router.get('/stats', authenticate, permissionController.getPermissionStats);

module.exports = router;