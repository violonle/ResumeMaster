const express = require('express');
const { register, login, getCurrentUser, updateCurrentUser, logout, sendCode, verifyCode, setPassword, getUserStats } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { User } = require('../models');

const router = express.Router();

// 公开路由
router.post('/register', register);
router.post('/login', login);
router.post('/send-code', sendCode);
router.post('/verify-code', verifyCode);

// 管理员登录请使用 /api/admin/login（保留此路径避免混淆，不提供硬编码回退）
router.post('/admin/login', (req, res) => {
  res.status(404).json({ message: '请使用 /api/admin/login' });
});

// 受保护路由
router.get('/user', authenticate, getCurrentUser);
router.put('/user', authenticate, updateCurrentUser);
router.get('/user/stats', authenticate, getUserStats);
router.post('/logout', authenticate, logout);
router.post('/set-password', authenticate, setPassword);

// 用户头像上传（非管理员）
const avatarDir = path.join(process.cwd(), 'uploads', 'avatars');
try { fs.mkdirSync(avatarDir, { recursive: true }) } catch (_) { }
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, avatarDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = `user_${req.user?.id || 'unknown'}_${Date.now()}${ext}`;
    cb(null, name);
  }
});
const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.mimetype);
    cb(ok ? null : new Error('不支持的图片类型'), ok);
  }
});

router.post('/user/avatar', authenticate, avatarUpload.single('avatar'), async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: { message: '未登录' } });
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ success: false, error: { message: '用户不存在' } });
    if (!req.file) return res.status(400).json({ success: false, error: { message: '未接收到文件' } });
    const relPath = `/uploads/avatars/${req.file.filename}`;
    await user.update({ avatar: relPath });
    res.json({ success: true, data: { avatar: relPath } });
  } catch (error) {
    console.error('Upload user avatar error:', error);
    res.status(500).json({ success: false, error: { message: '上传头像失败' } });
  }
});

module.exports = router;
