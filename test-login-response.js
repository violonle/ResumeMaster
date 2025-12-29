const { sequelize, User } = require('./backend/models');
const bcrypt = require('./backend/node_modules/bcryptjs');

async function testLoginResponse() {
  try {
    await sequelize.authenticate();
    console.log('数据库连接成功\n');
    
    const user = await User.findOne({
      where: { email: 'admin@resumemaster.com' },
      attributes: ['id', 'username', 'email', 'phone', 'password_hash', 'avatar', 'company_name', 'company_id']
    });
    
    if (!user) {
      console.log('用户不存在');
      return;
    }
    
    console.log('模拟后端返回的数据结构：\n');
    console.log('========================================');
    
    const isPasswordValid = await bcrypt.compare('admin123', user.password_hash);
    
    if (isPasswordValid) {
      const backendResponse = {
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
      
      console.log('后端返回:', JSON.stringify(backendResponse, null, 2));
      console.log('\n========================================\n');
      
      console.log('前端 userAuth.login 返回的数据结构：\n');
      
      const frontendResponse = {
        success: true,
        user: backendResponse.data.user,
        token: backendResponse.data.token
      };
      
      console.log('前端返回:', JSON.stringify(frontendResponse, null, 2));
      console.log('\n========================================\n');
      
      console.log('前端登录逻辑测试：\n');
      
      const identifier = 'admin@resumemaster.com';
      const result = frontendResponse;
      
      const u = result.user || (result.data && result.data.user) || {};
      console.log('提取的用户信息:', JSON.stringify(u, null, 2));
      
      const idf = identifier;
      const isEmail = /@/.test(idf);
      const matched = isEmail ? (u.email === idf) : (u.phone === idf || u.username === idf);
      
      console.log('\n匹配检查:');
      console.log('  输入:', idf);
      console.log('  isEmail:', isEmail);
      console.log('  用户邮箱:', u.email);
      console.log('  用户手机:', u.phone);
      console.log('  用户名:', u.username);
      console.log('  匹配结果:', matched ? '✅ 匹配' : '❌ 不匹配');
      
      if (!matched) {
        console.log('  ⚠️ 前端会显示"您还不是注册用户，请注册"');
      } else {
        console.log('  ✅ 前端会跳转到 dashboard.html');
      }
    } else {
      console.log('密码验证失败');
    }
    
    await sequelize.close();
  } catch (err) {
    console.error('测试失败:', err);
  }
}

testLoginResponse();
