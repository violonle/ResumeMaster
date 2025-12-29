const { Sequelize } = require('sequelize');
const path = require('path');

// 优先从环境变量获取数据库配置，支持 Docker 部署
const isProduction = process.env.NODE_ENV === 'production';
const dbDialect = process.env.DB_DIALECT || 'sqlite';

let sequelize;

if (dbDialect === 'mysql' || process.env.DB_HOST) {
  console.log('🚀 Connecting to MySQL database...');
  console.log('   Host:', process.env.DB_HOST || 'db');
  console.log('   Port:', process.env.DB_PORT || 3306);
  console.log('   Database:', process.env.DB_NAME || 'superresumemaster');
  
  // MySQL 配置 (用于 Docker/生产环境)
  sequelize = new Sequelize(
    process.env.DB_NAME || 'superresumemaster',
    process.env.DB_USER || 'root',
    process.env.DB_PASSWORD || 'YourStrongPassword',
    {
      host: process.env.DB_HOST || 'db', // Docker Compose 中的服务名
      port: process.env.DB_PORT || 3306,
      dialect: 'mysql',
      logging: isProduction ? false : console.log,
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
      }
    }
  );
} else {
  console.log('📁 Connecting to SQLite database...');
  console.log('   Path:', path.join(__dirname, '../database.sqlite'));
  
  // SQLite 配置 (用于 开发环境)
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '../database.sqlite'),
    logging: isProduction ? false : console.log,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  });
  console.log('Connecting to SQLite database...');
}

module.exports = sequelize;
