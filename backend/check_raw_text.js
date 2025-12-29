const sequelize = require('./config/db');
const { Resume } = require('./models');

async function checkRawTextForSkills() {
  try {
    console.log('检查简历原始文本中的技能信息...\n');

    await sequelize.authenticate();
    console.log('✓ 数据库连接成功\n');

    const resume = await Resume.findByPk(70);

    if (!resume) {
      console.log('✗ 未找到ID为70的简历');
      return;
    }

    console.log('=== 原始文本 (完整内容) ===');
    console.log(resume.raw_text || '无原始文本');

  } catch (error) {
    console.error('✗ 检查失败:', error.message);
    console.error(error);
  } finally {
    await sequelize.close();
  }
}

checkRawTextForSkills();