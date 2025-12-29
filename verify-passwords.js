const { sequelize, User } = require('./backend/models');
const bcrypt = require('./backend/node_modules/bcryptjs');

async function verifyPasswords() {
  try {
    await sequelize.authenticate();
    
    console.log('验证用户密码：\n');
    
    const users = await User.findAll({
      where: { username: ['admin', 'testuser'] },
      attributes: ['id', 'username', 'email', 'password_hash']
    });
    
    for (const user of users) {
      console.log(`用户: ${user.username}`);
      
      if (user.username === 'admin') {
        const testPasswords = ['admin', 'admin123', 'password', '123456'];
        for (const pwd of testPasswords) {
          const isValid = await bcrypt.compare(pwd, user.password_hash);
          console.log(`  密码 '${pwd}': ${isValid ? '✅ 正确' : '❌ 错误'}`);
        }
      } else if (user.username === 'testuser') {
        const isValid = await bcrypt.compare('user123', user.password_hash);
        console.log(`  密码 'user123': ${isValid ? '✅ 正确' : '❌ 错误'}`);
      }
      console.log('');
    }
    
    await sequelize.close();
  } catch (err) {
    console.error('验证失败:', err);
  }
}

verifyPasswords();
