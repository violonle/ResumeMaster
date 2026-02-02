const { Sequelize } = require('sequelize');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

// 强制生产环境禁用 SQLite
const allowSqlite = !isProduction && process.env.DB_ALLOW_SQLITE_DEV === '1';

let sequelize;
if (allowSqlite) {
  const path = require('path');
  console.warn('[DB] Using SQLite for development (DB_ALLOW_SQLITE_DEV=1)');
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '../database.sqlite'),
    logging: isProduction ? false : console.log,
    pool: { max: 5, min: 0, acquire: 30000, idle: 10000 }
  });
} else {
  const dialect = process.env.DB_DIALECT || 'mysql';
  
  // 校验必要环境变量
  const required = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
  const missing = required.filter((k) => !process.env[k]);
  
  if (missing.length > 0 && isProduction) {
    throw new Error(`[DB] Missing required DB env vars for production: ${missing.join(', ')}`);
  }
  
  if (missing.length > 0) {
    console.warn('[DB] Missing DB env vars:', missing.join(', '));
  }

  sequelize = new Sequelize(
    process.env.DB_NAME || 'superresumemaster',
    process.env.DB_USER || 'root',
    (process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : 'YourStrongPassword'),
    {
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT) || (dialect === 'postgres' ? 5432 : 3306),
      dialect: dialect,
      logging: isProduction ? false : console.log,
      pool: { 
        max: isProduction ? 20 : 10, 
        min: 0, 
        acquire: 30000, 
        idle: 10000 
      },
      dialectOptions: dialect === 'mysql' ? {
        charset: 'utf8mb4',
        connectTimeout: 60000
      } : (dialect === 'postgres' ? {
        // Postgres 特有配置
      } : {})
    }
  );
}

module.exports = sequelize;
