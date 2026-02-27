const bcrypt = require('bcryptjs');
const { User, sequelize } = require('./models');

async function addUser() {
  try {
    // 检查数据库连接
    await sequelize.authenticate();
    console.log('Database connection established.');

    const username = '18605355138';
    const password = 'Longkou7';
    const phone = '18605355138';

    // 检查用户是否已存在
    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      console.log(`User ${username} already exists.`);
      process.exit(0);
    }

    // 加密密码 (使用 bcryptjs，10 轮)
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // 创建普通用户
    const newUser = await User.create({
      username,
      phone,
      password_hash,
      role: 'user',
      is_active: true
    });

    console.log('User created successfully:');
    console.log({
      id: newUser.id,
      username: newUser.username,
      phone: newUser.phone,
      role: newUser.role,
      is_active: newUser.is_active
    });

  } catch (error) {
    console.error('Error adding user:', error);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

addUser();
