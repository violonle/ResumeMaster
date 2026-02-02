
// 强制设置本地数据库连接，必须在 require models 之前
process.env.DB_HOST = 'localhost';
process.env.DB_USER = 'root';
process.env.DB_PASSWORD = 'Longkou7~!@';
process.env.DB_NAME = 'superresumemaster';
process.env.DB_PORT = '3306';

const { sequelize } = require('./backend/models');

async function migrate() {

  try {
    console.log('--- 正在为 MySQL 数据库手动执行表结构更新 ---');
    const dialect = sequelize.getDialect();
    console.log('当前数据库类型:', dialect);

    const queryInterface = sequelize.getQueryInterface();
    const tableDesc = await queryInterface.describeTable('jobs');

    const columnsToAdd = [
      { name: 'enable_auto_screening', type: 'BOOLEAN', default: 'TRUE' },
      { name: 'auto_reject_score', type: 'INTEGER', default: '60' },
      { name: 'notify_high_score', type: 'BOOLEAN', default: 'TRUE' },
      { name: 'high_score_threshold', type: 'INTEGER', default: '85' },
      { name: 'enable_deep_analysis', type: 'BOOLEAN', default: 'FALSE' }
    ];

    for (const col of columnsToAdd) {
      if (!tableDesc[col.name]) {
        console.log(`添加字段: ${col.name}`);
        await sequelize.query(`ALTER TABLE jobs ADD COLUMN ${col.name} ${col.type} DEFAULT ${col.default}`);
      } else {
        console.log(`字段已存在: ${col.name}`);
      }
    }

    console.log('--- 迁移完成 ---');
  } catch (error) {
    console.error('迁移出错:', error);
  } finally {
    process.exit();
  }
}

migrate();
