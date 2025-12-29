const OptimizedResumeParseService = require('./services/optimizedResumeParseService');
const { Resume } = require('./models');

async function testResumeParsing() {
  try {
    const resume = await Resume.findByPk(112);
    if (!resume) {
      console.log('未找到简历ID 112');
      return;
    }

    console.log('原始文本长度:', resume.raw_text ? resume.raw_text.length : 0);
    console.log('原始文本前200字符:', resume.raw_text ? resume.raw_text.substring(0, 200) : '无');

    const parseService = new OptimizedResumeParseService();
    const parsedData = await parseService.parseResumeContent(resume.raw_text, 'txt');

    console.log('\n=== 解析结果 ===');
    console.log('姓名:', parsedData.name);
    console.log('邮箱:', parsedData.email);
    console.log('电话:', parsedData.phone);
    console.log('职位:', parsedData.job_title);
    console.log('工作经历数量:', Array.isArray(parsedData.work_experience) ? parsedData.work_experience.length : 0);
    console.log('教育经历数量:', Array.isArray(parsedData.education) ? parsedData.education.length : 0);
    console.log('技能数量:', Array.isArray(parsedData.skills) ? parsedData.skills.length : 0);
    console.log('项目数量:', Array.isArray(parsedData.projects) ? parsedData.projects.length : 0);
    console.log('个人优势长度:', parsedData.summary ? parsedData.summary.length : 0);

    console.log('\n=== 工作经历详情 ===');
    if (Array.isArray(parsedData.work_experience)) {
      parsedData.work_experience.forEach((exp, idx) => {
        console.log(`${idx + 1}. ${exp.company} - ${exp.position} (${exp.startDate} - ${exp.endDate})`);
        console.log(`   描述长度: ${exp.description ? exp.description.length : 0}`);
      });
    }

    console.log('\n=== 教育经历详情 ===');
    if (Array.isArray(parsedData.education)) {
      parsedData.education.forEach((edu, idx) => {
        console.log(`${idx + 1}. ${edu.school} - ${edu.major} (${edu.startDate} - ${edu.endDate})`);
      });
    }

    console.log('\n=== 技能详情 ===');
    if (Array.isArray(parsedData.skills)) {
      console.log(parsedData.skills.join(', '));
    }

    console.log('\n=== 项目详情 ===');
    if (Array.isArray(parsedData.projects)) {
      parsedData.projects.forEach((proj, idx) => {
        console.log(`${idx + 1}. ${proj.name} (${proj.startDate} - ${proj.endDate})`);
      });
    }

    console.log('\n=== 个人优势内容 ===');
    console.log(parsedData.summary ? parsedData.summary.substring(0, 500) : '无');

  } catch (error) {
    console.error('测试失败:', error.message);
    console.error(error.stack);
  } finally {
    await require('./models').sequelize.close();
  }
}

testResumeParsing();
