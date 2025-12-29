const { sequelize, User } = require('./backend/models');
const bcrypt = require('./backend/node_modules/bcryptjs');

async function createNormalUser() {
  try {
    await sequelize.authenticate();
    
    const hashedPassword = await bcrypt.hash('user123', 10);
    
    const user = await User.create({
      username: 'testuser',
      email: 'test@example.com',
      password_hash: hashedPassword,
      role: 'user',
      is_active: true
    });
    
    console.log('✅ 普通用户创建成功！');
    console.log('   用户名: testuser');
    console.log('   邮箱: test@example.com');
    console.log('   密码: user123');
    console.log('   角色: user');
    
    await sequelize.close();
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      console.log('ℹ️ 用户已存在，使用现有账号：');
      console.log('   用户名: testuser');
      console.log('   邮箱: test@example.com');
      console.log('   密码: user123');
    } else {
      console.error('创建用户失败:', err);
    }
    await sequelize.close();
  }
}

createNormalUser();
