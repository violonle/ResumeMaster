// 修改用户密码脚本
require('dotenv').config();

// 强制使用MySQL连接
process.env.DB_ALLOW_SQLITE_DEV = '0';

const { User } = require('./models');
const bcrypt = require('bcryptjs');

async function changePasswords() {
  try {
    console.log('开始修改用户密码...');
    
    const newPassword = 'Longkou7';
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    console.log('新密码已加密:', hashedPassword.substring(0, 20) + '...');
    
    // 修改手机号为18605355138的用户
    console.log('\n修改手机号用户: 18605355138');
    const phoneUser = await User.findOne({ where: { phone: '18605355138' } });
    
    if (phoneUser) {
      await phoneUser.update({ password_hash: hashedPassword });
      console.log('✅ 手机号用户密码修改成功！');
      console.log('用户信息:', {
        id: phoneUser.id,
        username: phoneUser.username,
        phone: phoneUser.phone,
        role: phoneUser.role
      });
    } else {
      console.log('❌ 手机号用户不存在，尝试创建...');
      // 创建新用户
      const newPhoneUser = await User.create({
        username: 'user-18605355138',
        phone: '18605355138',
        password_hash: hashedPassword,
        role: 'user',
        is_active: true
      });
      console.log('✅ 手机号用户创建成功！');
      console.log('用户信息:', {
        id: newPhoneUser.id,
        username: newPhoneUser.username,
        phone: newPhoneUser.phone,
        role: newPhoneUser.role
      });
    }
    
    // 修改用户名为demo的用户
    console.log('\n修改用户名用户: demo');
    const demoUser = await User.findOne({ where: { username: 'demo' } });
    
    if (demoUser) {
      await demoUser.update({ password_hash: hashedPassword });
      console.log('✅ 用户名用户密码修改成功！');
      console.log('用户信息:', {
        id: demoUser.id,
        username: demoUser.username,
        phone: demoUser.phone,
        role: demoUser.role
      });
    } else {
      console.log('❌ 用户名用户不存在，尝试创建...');
      // 创建新用户
      const newDemoUser = await User.create({
        username: 'demo',
        email: 'demo@example.com',
        password_hash: hashedPassword,
        role: 'user',
        is_active: true
      });
      console.log('✅ 用户名用户创建成功！');
      console.log('用户信息:', {
        id: newDemoUser.id,
        username: newDemoUser.username,
        email: newDemoUser.email,
        role: newDemoUser.role
      });
    }
    
    console.log('\n🎉 所有用户密码修改完成！');
    console.log('新密码: Longkou7');
    
  } catch (error) {
    console.error('修改密码失败:', error.message);
    console.error('错误详情:', error);
  }
}

changePasswords();
