const jwt = require('jsonwebtoken');
const { jwtSecret, jwtExpiration } = require('../config/auth');
const { User } = require('../models');

// 生成JWT令牌
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email },
    jwtSecret,
    { expiresIn: jwtExpiration }
  );
};

// 验证JWT令牌
const verifyToken = (token) => {
  return jwt.verify(token, jwtSecret);
};

// 认证中间件
const authenticate = async (req, res, next) => {
  console.log(`[Auth] authenticate check: Path=${req.path}`);
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '访问令牌缺失'
        }
      });
    }

    const decoded = verifyToken(token);
    const user = await User.findByPk(decoded.id, {
      attributes: ['id', 'username', 'email', 'role', 'company_id']
    });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: '无效的访问令牌'
        }
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('JWT Verification Error:', error.message);
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: '令牌验证失败'
      }
    });
  }
};

module.exports = {
  generateToken,
  verifyToken,
  authenticate
};