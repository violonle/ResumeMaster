// JWT 密钥配置：只允许从环境变量 JWT_SECRET 读取，禁止内置默认密钥。
// 未配置时在加载阶段直接抛错、拒绝启动，避免服务带着公开的默认密钥运行。
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || String(jwtSecret).trim() === '') {
  throw new Error('JWT_SECRET is not set. Refusing to start: set a strong random JWT_SECRET in .env (generate: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))")');
}

module.exports = {
  jwtSecret,
  jwtExpiration: '24h'
};
