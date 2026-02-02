const jwt = require('jsonwebtoken');
const { jwtSecret, jwtExpiration } = require('../config/auth');
const { User } = require('../models');

// 生成JWT令牌
const generateToken = (user) => {
  const secret = process.env.JWT_SECRET || jwtSecret;
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    secret,
    { expiresIn: jwtExpiration }
  );
};

// 验证JWT令牌
const verifyToken = (token) => {
  try {
    const secret = process.env.JWT_SECRET || jwtSecret;
    console.log('[Auth] Attempting Verify with Secret Prefix:', secret ? secret.substring(0, 5) : 'NONE');
    const decoded = jwt.verify(token, secret);
    console.log('[Auth] JWT Verify Success for User ID:', decoded.id, 'Role:', decoded.role);
    return decoded;
  } catch (err) {
    const secret = process.env.JWT_SECRET || jwtSecret;
    console.error('[Auth] JWT Verify Error Details:');
    console.error('  Message:', err.message);
    console.error('  Full Token:', token);
    console.error('  Token Length:', token ? token.length : 0);
    console.error('  Secret Status:', !!secret);
    if (secret) {
      console.error('  Secret Prefix:', secret.substring(0, 10) + '...');
      console.error('  Secret Length:', secret.length);
    }
    console.error('  ENV JWT_SECRET Status:', !!process.env.JWT_SECRET);
    throw err;
  }
};

// 认证中间件
const authenticate = async (req, res, next) => {
  console.log(`[Auth] authenticate check: Path=${req.path}`);
  try {
    const authHeader = req.headers.authorization;
    console.log('[Auth] Incoming Authorization Header:', authHeader);
    const token = authHeader?.split(' ')[1]?.trim();
    
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
      attributes: ['id', 'username', 'email', 'role', 'company_id', 'company_name']
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