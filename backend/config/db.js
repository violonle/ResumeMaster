const { Sequelize } = require('sequelize');
const path = require('path');

// 使用 SQLite 进行开发，避免 MySQL 依赖
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../database.sqlite'),
  logging: (process.env.NODE_ENV === 'development') ? console.log : false, // 生产环境关闭SQL日志
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

module.exports = sequelize;
