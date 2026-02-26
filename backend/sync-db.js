// 数据库同步脚本
require('dotenv').config();

// 强制禁用SQLite
process.env.DB_ALLOW_SQLITE_DEV = '0';

// 注意：在Docker环境中，DB_HOST应该是'db'而不是'127.0.0.1'
// 但是从错误信息看，本地环境可能直接连接到MySQL容器的映射端口
const dbHost = process.env.DB_HOST || '127.0.0.1';

console.log('正在连接到MySQL数据库:', {
  host: dbHost,
  port: process.env.DB_PORT || 3306,
  database: process.env.DB_NAME || 'superresumemaster',
  user: process.env.DB_USER || 'root'
});

// 直接使用模型中的sequelize实例
// 确保正确加载配置
const { sequelize } = require('./models');

// 强制设置为MySQL连接
sequelize.options.dialect = 'mysql';
sequelize.options.host = dbHost;
sequelize.options.port = Number(process.env.DB_PORT) || 3306;
sequelize.options.database = process.env.DB_NAME || 'superresumemaster';
sequelize.options.username = process.env.DB_USER || 'root';
sequelize.options.password = process.env.DB_PASSWORD || 'Longkou7~!@';



async function syncDatabase() {
  try {
    console.log('开始数据库同步...');
    console.log('环境配置:', {
      DB_HOST: process.env.DB_HOST,
      DB_PORT: process.env.DB_PORT,
      DB_NAME: process.env.DB_NAME,
      DB_USER: process.env.DB_USER
    });

    // 执行数据库同步
    await sequelize.sync({ force: false, alter: false });
    console.log('数据库同步完成！');

    // 验证同步结果
    try {
      const queryInterface = sequelize.getQueryInterface();
      const tables = await queryInterface.showAllTables();
      console.log('\n已创建的表:');
      tables.forEach(table => console.log(`- ${table}`));
      
      if (tables.includes('users')) {
        console.log('\n✅ users表已成功创建！');
      } else {
        console.log('\n❌ users表未创建！');
      }
    } catch (e) {
      console.log('验证表结构时出错:', e.message);
    }

  } catch (error) {
    console.error('数据库同步失败:', error.message);
    console.error('错误详情:', error);
  } finally {
    // 关闭数据库连接
    await sequelize.close();
    console.log('\n数据库连接已关闭');
  }
}

syncDatabase();
