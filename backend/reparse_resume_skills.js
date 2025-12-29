const sequelize = require('./config/db');
const { Resume } = require('./models');
const OptimizedResumeParseService = require('./services/optimizedResumeParseService');

async function reparseResumeSkills() {
  try {
    console.log('重新解析简历ID 70的技能信息...\n');

    await sequelize.authenticate();
    console.log('✓ 数据库连接成功\n');

    const resume = await Resume.findByPk(70);

    if (!resume) {
      console.log('✗ 未找到ID为70的简历');
      return;
    }

    console.log('=== 原始简历信息 ===');
    console.log('文件名:', resume.file_name);
    console.log('原始技能字段:', resume.skills);
    console.log('parsed_data.skills:', resume.parsed_data ? resume.parsed_data.skills : 'N/A');
    console.log('\n');

    const parseService = new OptimizedResumeParseService();
    const parsed = await parseService.parseResumeContent(resume.raw_text);

    console.log('=== 新解析结果 ===');
    console.log('提取的技能:', parsed.skills);
    console.log('技能数量:', parsed.skills.length);
    console.log('\n');

    const newParsedData = resume.parsed_data || {};
    newParsedData.skills = parsed.skills;

    await resume.update({
      skills: parsed.skills,
      parsed_data: newParsedData
    });

    console.log('✓ 简历技能信息已更新\n');

    const updatedResume = await Resume.findByPk(70);
    console.log('=== 更新后的简历信息 ===');
    console.log('技能字段:', updatedResume.skills);
    console.log('parsed_data.skills:', updatedResume.parsed_data.skills);

  } catch (error) {
    console.error('✗ 重新解析失败:', error.message);
    console.error(error);
  } finally {
    await sequelize.close();
  }
}

reparseResumeSkills();
