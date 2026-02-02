const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/auth');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: '访问令牌缺失' });
  }

  const secret = process.env.JWT_SECRET || jwtSecret;
  jwt.verify(token, secret, (err, user) => {
    if (err) {
      console.error('[AdminAuth] JWT Verify Error:', err.message, 'Secret used:', secret.substring(0, 3) + '...');
      return res.status(403).json({ 
        message: '访问令牌无效', 
        error: err.message,
        code: 'INVALID_TOKEN'
      });
    }
    req.user = user;
    next();
  });
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: '需要管理员权限' });
  }
  next();
};

module.exports = {
  authenticateToken,
  requireAdmin
};