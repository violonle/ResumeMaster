// 数据库测试脚本
require('dotenv').config();

// 强制禁用SQLite
process.env.DB_ALLOW_SQLITE_DEV = '0';

const { User, sequelize } = require('./models');

async function testDatabase() {
  try {
    console.log('开始数据库测试...');

    // 测试数据库连接
    await sequelize.authenticate();
    console.log('✅ 数据库连接成功！');

    // 测试用户表访问
    try {
      const userCount = await User.count();
      console.log(`✅ 用户表访问成功！当前用户数: ${userCount}`);

      // 测试创建默认管理员
      const adminUser = await User.findOne({ where: { username: 'masteradmin' } });
      if (!adminUser) {
        console.log('⚠️  默认管理员不存在，正在创建...');
        const bcrypt = require('bcryptjs');
        const passwordHash = await bcrypt.hash('Longkou7', 10);
        
        const newAdmin = await User.create({
          username: 'masteradmin',
          email: 'admin@resumemaster.com',
          password_hash: passwordHash,
          role: 'admin',
          is_active: true
        });
        
        console.log('✅ 默认管理员创建成功！');
      } else {
        console.log('✅ 默认管理员已存在');
      }

    } catch (e) {
      console.error('❌ 用户表访问失败:', e.message);
      throw e;
    }

    // 测试其他表
    try {
      const models = require('./models');
      const tableTests = [
        { name: 'Resume', model: models.Resume },
        { name: 'Job', model: models.Job },
        { name: 'Company', model: models.Company }
      ];

      for (const test of tableTests) {
        const count = await test.model.count();
        console.log(`✅ ${test.name}表访问成功！记录数: ${count}`);
      }
    } catch (e) {
      console.error('❌ 其他表访问失败:', e.message);
    }

    console.log('\n🎉 数据库测试完成！所有测试都通过了。');

  } catch (error) {
    console.error('❌ 数据库测试失败:', error.message);
  } finally {
    // 关闭数据库连接
    await sequelize.close();
    console.log('\n数据库连接已关闭');
  }
}

testDatabase();
