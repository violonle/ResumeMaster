const sequelize = require('./config/db');

async function addRawTextField() {
  try {
    await sequelize.authenticate();
    console.log('数据库连接成功');

    const queryInterface = sequelize.getQueryInterface();

    console.log('正在添加 raw_text 字段到 resumes 表...');
    await queryInterface.addColumn('resumes', 'raw_text', {
      type: sequelize.Sequelize.TEXT('long'),
      allowNull: true
    });

    console.log('✅ raw_text 字段添加成功！');

    await sequelize.close();
  } catch (error) {
    if (error.message.includes('Duplicate column name') || error.message.includes('already exists')) {
      console.log('⚠️  raw_text 字段已存在，跳过创建');
    } else {
      console.error('添加字段失败:', error);
    }
    await sequelize.close();
  }
}

addRawTextField();
