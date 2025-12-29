const { sequelize, User } = require('./backend/models');
const bcrypt = require('./backend/node_modules/bcryptjs');

async function simulateFrontendLogin() {
  try {
    await sequelize.authenticate();
    console.log('数据库连接成功\n');
    
    console.log('模拟前端登录流程：\n');
    console.log('========================================\n');
    
    const testCases = [
      { identifier: 'admin@resumemaster.com', password: 'admin123', expectedUser: 'admin' },
      { identifier: 'admin', password: 'admin123', expectedUser: 'admin' },
      { identifier: 'test@example.com', password: 'user123', expectedUser: 'testuser' },
      { identifier: 'testuser', password: 'user123', expectedUser: 'testuser' }
    ];
    
    for (const tc of testCases) {
      console.log(`测试用例: 输入 "${tc.identifier}" / "${tc.password}"`);
      
      const isEmail = /@/.test(tc.identifier);
      const isPhone = /^1[3-9]\d{9}$/.test(tc.identifier);
      
      let loginData;
      if (isEmail) {
        loginData = { email: tc.identifier, password: tc.password };
      } else if (isPhone) {
        loginData = { phone: tc.identifier, password: tc.password };
      } else {
        loginData = { username: tc.identifier, password: tc.password };
      }
      
      console.log(`  发送请求: ${JSON.stringify(loginData)}`);
      
      const whereConditions = {};
      if (loginData.email) whereConditions.email = loginData.email;
      if (loginData.phone) whereConditions.phone = loginData.phone;
      if (loginData.username) whereConditions.username = loginData.username;
      
      const { Op } = require('sequelize');
      const user = await User.findOne({
        where: {
          [Op.or]: Object.keys(whereConditions).map(key => ({ [key]: whereConditions[key] }))
        }
      });
      
      if (!user) {
        console.log(`  ❌ 用户不存在`);
      } else {
        console.log(`  ✅ 找到用户: ${user.username} (ID: ${user.id})`);
        
        const isPasswordValid = await bcrypt.compare(tc.password, user.password_hash);
        
        if (isPasswordValid) {
          console.log(`  ✅ 密码验证成功`);
          
          const result = {
            success: true,
            data: {
              user: {
                id: user.id,
                username: user.username,
                email: user.email,
                phone: user.phone,
                avatar: user.avatar,
                company_name: user.company_name,
                company_id: user.company_id
              },
              token: 'mock_token'
            },
            message: '登录成功'
          };
          
          console.log(`  返回数据: user=${result.data.user.username}, token=${result.data.token}`);
          
          const u = result.data.user;
          const idf = tc.identifier;
          const isEmailCheck = /@/.test(idf);
          const matched = isEmailCheck ? (u.email === idf) : (u.phone === idf || u.username === idf);
          
          console.log(`  前端匹配检查:`);
          console.log(`    输入: ${idf}`);
          console.log(`    用户邮箱: ${u.email}`);
          console.log(`    用户手机: ${u.phone}`);
          console.log(`    用户名: ${u.username}`);
          console.log(`    匹配结果: ${matched ? '✅ 匹配' : '❌ 不匹配'}`);
          
          if (!matched) {
            console.log(`  ⚠️ 前端会显示"您还不是注册用户，请注册"`);
          } else {
            console.log(`  ✅ 前端会跳转到 dashboard.html`);
          }
        } else {
          console.log(`  ❌ 密码验证失败`);
          console.log(`  ⚠️ 前端会显示"密码错误，请重试"`);
        }
      }
      
      console.log('----------------------------------------\n');
    }
    
    await sequelize.close();
  } catch (err) {
    console.error('测试失败:', err);
  }
}

simulateFrontendLogin();
