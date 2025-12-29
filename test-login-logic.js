const { sequelize, User } = require('./backend/models');
const bcrypt = require('./backend/node_modules/bcryptjs');

async function testLoginLogic() {
  try {
    await sequelize.authenticate();
    console.log('数据库连接成功\n');
    
    const users = await User.findAll({
      where: { username: ['admin', 'testuser'] },
      attributes: ['id', 'username', 'email', 'phone', 'password_hash']
    });
    
    console.log('测试前端登录逻辑：\n');
    console.log('========================================');
    
    for (const user of users) {
      console.log(`\n用户: ${user.username}`);
      console.log(`邮箱: ${user.email}`);
      console.log(`手机: ${user.phone}`);
      
      const testCases = [
        { identifier: user.email, password: user.username === 'admin' ? 'admin123' : 'user123' },
        { identifier: user.username, password: user.username === 'admin' ? 'admin123' : 'user123' }
      ];
      
      for (const tc of testCases) {
        if (!tc.identifier) continue;
        
        console.log(`\n测试: 输入标识符 = "${tc.identifier}"`);
        
        const isEmail = /@/.test(tc.identifier);
        console.log(`  isEmail = ${isEmail}`);
        
        const u = { email: user.email, phone: user.phone, username: user.username };
        const matched = isEmail ? (u.email === tc.identifier) : (u.phone === tc.identifier || u.username === tc.identifier);
        
        console.log(`  用户邮箱: ${u.email}`);
        console.log(`  用户手机: ${u.phone}`);
        console.log(`  用户名: ${u.username}`);
        console.log(`  匹配结果: ${matched ? '✅ 匹配' : '❌ 不匹配'}`);
        
        if (!matched) {
          console.log(`  ⚠️ 这会导致前端显示"您还不是注册用户，请注册"`);
        }
      }
    }
    
    console.log('\n========================================');
    await sequelize.close();
  } catch (err) {
    console.error('测试失败:', err);
  }
}

testLoginLogic();
