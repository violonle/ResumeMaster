const sequelize = require('../config/db');
const models = require('../models'); // Ensure models are loaded
const bcrypt = require('bcryptjs');

async function initDatabase() {
  try {
    console.log('正在初始化 SQLite 数据库...');
    
    // Sync all models
    await sequelize.sync({ force: true }); // force: true will drop existing tables
    console.log('✅ 数据库表结构创建成功');

    // Create default admin user
    const User = models.User;
    const hashedPassword = await bcrypt.hash('Longkou7', 10);
    
    await User.create({
      username: 'masteradmin',
      email: 'admin@resumemaster.com',
      password_hash: hashedPassword,
      role: 'admin',
      is_active: true
    });
    
    console.log('✅ 默认管理员用户创建成功');
    console.log('   账号: masteradmin');
    console.log('   密码: Longkou7');

  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    process.exit(1);
  }
}

initDatabase();
