const sequelize = require('./config/db');
const { Resume } = require('./models');

async function checkSkillsData() {
  try {
    console.log('检查简历技能数据...\n');

    await sequelize.authenticate();
    console.log('✓ 数据库连接成功\n');

    const resume = await Resume.findByPk(70);

    if (!resume) {
      console.log('✗ 未找到ID为70的简历');
      return;
    }

    console.log('=== 简历 ID 70 ===');
    console.log('文件名:', resume.file_name);
    console.log('\n');

    console.log('=== 新字段 skills ===');
    console.log('类型:', typeof resume.skills);
    console.log('值:', resume.skills);
    console.log('长度:', resume.skills ? resume.skills.length : 0);
    console.log('\n');

    console.log('=== parsed_data 中的 skills ===');
    if (resume.parsed_data) {
      console.log('类型:', typeof resume.parsed_data.skills);
      console.log('值:', resume.parsed_data.skills);
      console.log('长度:', resume.parsed_data.skills ? resume.parsed_data.skills.length : 0);
    } else {
      console.log('parsed_data 为空');
    }
    console.log('\n');

    console.log('=== 其他相关字段 ===');
    console.log('tags:', resume.tags);
    console.log('parsed_data.tags:', resume.parsed_data ? resume.parsed_data.tags : 'N/A');

  } catch (error) {
    console.error('✗ 检查失败:', error.message);
    console.error(error);
  } finally {
    await sequelize.close();
  }
}

checkSkillsData();