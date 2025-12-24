// JWT密钥配置
module.exports = {
  jwtSecret: process.env.JWT_SECRET || 'superresumemaster_secret_key',
  jwtExpiration: '24h'
};