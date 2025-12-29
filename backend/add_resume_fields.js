const sequelize = require('./config/db');

async function addResumeFields() {
  try {
    await sequelize.authenticate();
    console.log('数据库连接成功');

    const queryInterface = sequelize.getQueryInterface();
    
    // 需要添加的字段
    const fieldsToAdd = [
      { name: 'experience_years', type: sequelize.Sequelize.INTEGER, comment: '工作经验（年）' },
      { name: 'highest_education', type: sequelize.Sequelize.STRING(50), comment: '最高学历' },
      { name: 'job_status', type: sequelize.Sequelize.STRING(50), comment: '求职状态' },
      { name: 'expected_salary', type: sequelize.Sequelize.STRING(100), comment: '期望薪资' },
      { name: 'work_experience', type: sequelize.Sequelize.JSON, comment: '工作经历' },
      { name: 'education', type: sequelize.Sequelize.JSON, comment: '教育经历' },
      { name: 'skills', type: sequelize.Sequelize.JSON, comment: '技能专长' },
      { name: 'summary', type: sequelize.Sequelize.TEXT, comment: '个人优势' },
      { name: 'projects', type: sequelize.Sequelize.JSON, comment: '项目经历' },
      { name: 'name', type: sequelize.Sequelize.STRING(100), comment: '姓名' },
      { name: 'phone', type: sequelize.Sequelize.STRING(50), comment: '电话' },
      { name: 'email', type: sequelize.Sequelize.STRING(100), comment: '邮箱' },
      { name: 'location', type: sequelize.Sequelize.STRING(200), comment: '城市/地址' },
      { name: 'job_title', type: sequelize.Sequelize.STRING(100), comment: '职位' }
    ];

    console.log('\n=== 开始添加字段 ===');
    
    for (const field of fieldsToAdd) {
      try {
        await queryInterface.addColumn('resumes', field.name, {
          type: field.type,
          allowNull: true,
          comment: field.comment
        });
        console.log(`✅ 添加字段: ${field.name}`);
      } catch (error) {
        if (error.message.includes('Duplicate column name') || error.message.includes('already exists')) {
          console.log(`⚠️  字段 ${field.name} 已存在，跳过`);
        } else {
          console.error(`❌ 添加字段 ${field.name} 失败:`, error.message);
        }
      }
    }

    console.log('\n✅ 所有字段添加完成！');

    await sequelize.close();
  } catch (error) {
    console.error('添加字段失败:', error);
    await sequelize.close();
  }
}

addResumeFields();
