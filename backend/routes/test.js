// 简单的路由测试文件
const express = require('express');
const router = express.Router();

// 基础测试路由
router.get('/test', (req, res) => {
  res.json({ message: '路由测试成功' });
});

module.exports = router;