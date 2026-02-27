const bcrypt = require('bcryptjs');
const db = require('./models');

const NEW_PASSWORD = 'Longkou7';
const USERS_TO_UPDATE = [
  { phone: '18605355138' },
  { username: 'demo' }
];

async function changePasswords() {
  try {
    console.log('开始修改SQLite数据库用户密码...');
    
    // 加密新密码
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(NEW_PASSWORD, salt);
    console.log('新密码已加密:', hashedPassword.substring(0, 40) + '...');
    
    for (const userData of USERS_TO_UPDATE) {
      console.log('\n' + '='.repeat(50));
      
      if (userData.phone) {
        console.log(`修改手机号用户: ${userData.phone}`);
        
        // 查找现有用户
        const existingUser = await db.User.findOne({
          where: { phone: userData.phone }
        });
        
        if (existingUser) {
          console.log('✅ 用户存在，更新密码...');
          await existingUser.update({
            password_hash: hashedPassword
          });
          console.log('✅ 密码更新成功！');
          console.log('用户信息:', {
            id: existingUser.id,
            username: existingUser.username,
            phone: existingUser.phone,
            role: existingUser.role
          });
        } else {
          console.log('❌ 用户不存在，尝试创建...');
          const newUser = await db.User.create({
            username: `user-${userData.phone}`,
            phone: userData.phone,
            password_hash: hashedPassword,
            role: 'user',
            subscription_status: 'inactive',
            email_verified: false,
            phone_verified: true,
            login_count: 0,
            is_active: true
          });
          console.log('✅ 用户创建成功！');
          console.log('用户信息:', {
            id: newUser.id,
            username: newUser.username,
            phone: newUser.phone,
            role: newUser.role
          });
        }
      } else if (userData.username) {
        console.log(`修改用户名用户: ${userData.username}`);
        
        // 查找现有用户
        const existingUser = await db.User.findOne({
          where: { username: userData.username }
        });
        
        if (existingUser) {
          console.log('✅ 用户存在，更新密码...');
          await existingUser.update({
            password_hash: hashedPassword
          });
          console.log('✅ 密码更新成功！');
          console.log('用户信息:', {
            id: existingUser.id,
            username: existingUser.username,
            email: existingUser.email,
            role: existingUser.role
          });
        } else {
          console.log('❌ 用户不存在，尝试创建...');
          const newUser = await db.User.create({
            username: userData.username,
            email: `${userData.username}@example.com`,
            password_hash: hashedPassword,
            role: 'user',
            subscription_status: 'inactive',
            email_verified: false,
            phone_verified: false,
            login_count: 0,
            is_active: true
          });
          console.log('✅ 用户创建成功！');
          console.log('用户信息:', {
            id: newUser.id,
            username: newUser.username,
            email: newUser.email,
            role: newUser.role
          });
        }
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('🎉 所有用户密码修改完成！');
    console.log('新密码:', NEW_PASSWORD);
    
  } catch (error) {
    console.error('❌ 密码修改失败:', error);
  } finally {
    await db.sequelize.close();
  }
}

changePasswords();