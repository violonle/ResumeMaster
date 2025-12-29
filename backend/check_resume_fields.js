const sequelize = require('./config/db');

async function checkResumeTableStructure() {
  try {
    await sequelize.authenticate();
    console.log('数据库连接成功');

    const queryInterface = sequelize.getQueryInterface();
    
    // 获取resumes表的结构
    const [results] = await sequelize.query("PRAGMA table_info(resumes)");
    
    console.log('\n=== Resumes 表当前字段 ===');
    results.forEach(field => {
      console.log(`- ${field.name} (${field.type})`);
    });

    // 检查需要添加的字段
    const requiredFields = [
      { name: 'experience_years', type: 'INTEGER', comment: '工作经验（年）' },
      { name: 'highest_education', type: 'STRING(50)', comment: '最高学历' },
      { name: 'job_status', type: 'STRING(50)', comment: '求职状态' },
      { name: 'expected_salary', type: 'STRING(100)', comment: '期望薪资' },
      { name: 'work_experience', type: 'JSON', comment: '工作经历' },
      { name: 'education', type: 'JSON', comment: '教育经历' },
      { name: 'skills', type: 'JSON', comment: '技能专长' },
      { name: 'summary', type: 'TEXT', comment: '个人优势' },
      { name: 'projects', type: 'JSON', comment: '项目经历' },
      { name: 'name', type: 'STRING(100)', comment: '姓名' },
      { name: 'phone', type: 'STRING(50)', comment: '电话' },
      { name: 'email', type: 'STRING(100)', comment: '邮箱' },
      { name: 'location', type: 'STRING(200)', comment: '城市/地址' },
      { name: 'job_title', type: 'STRING(100)', comment: '职位' }
    ];

    const existingFields = results.map(r => r.name);
    const missingFields = requiredFields.filter(f => !existingFields.includes(f.name));

    console.log('\n=== 需要添加的字段 ===');
    if (missingFields.length === 0) {
      console.log('✅ 所有必需字段都已存在');
    } else {
      missingFields.forEach(field => {
        console.log(`- ${field.name} (${field.type}): ${field.comment}`);
      });
    }

    await sequelize.close();
  } catch (error) {
    console.error('检查表结构失败:', error);
    await sequelize.close();
  }
}

checkResumeTableStructure();
