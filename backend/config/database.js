// 数据库配置
module.exports = {
  development: {
    username: 'root',
    password: '123456',
    database: process.env.DB_NAME || 'superresumemaster',
    host: '127.0.0.1',
    dialect: 'mysql'
  },
  production: {
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: 'superresumemaster',
    host: process.env.DB_HOST,
    dialect: 'mysql'
  }
};