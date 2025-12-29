const { sequelize, Resume } = require('./models');
const ImprovedResumeParseService = require('./services/improvedResumeParseService');

async function reparseResume70() {
  try {
    await sequelize.authenticate();
    console.log('数据库连接成功');

    const resume = await Resume.findByPk(70);
    if (!resume) {
      console.log('未找到ID为70的简历');
      return;
    }

    console.log('\n=== 开始解析简历 ===');
    console.log('Raw Text 长度:', resume.raw_text ? resume.raw_text.length : 0);

    const parser = new ImprovedResumeParseService();
    const parsedData = await parser.parseResumeContent(resume.raw_text);

    console.log('\n=== 解析结果 ===');
    console.log('姓名:', parsedData.name);
    console.log('邮箱:', parsedData.email);
    console.log('电话:', parsedData.phone);
    console.log('位置:', parsedData.location);
    console.log('职位:', parsedData.jobTitle);
    console.log('工作年限:', parsedData.experience_years);
    console.log('个人优势长度:', parsedData.summary ? parsedData.summary.length : 0);
    console.log('工作经历数量:', parsedData.workExperience ? parsedData.workExperience.length : 0);
    console.log('项目经历数量:', parsedData.projects ? parsedData.projects.length : 0);
    console.log('教育经历数量:', parsedData.education ? parsedData.education.length : 0);
    console.log('技能数量:', parsedData.skills ? parsedData.skills.length : 0);

    console.log('\n=== 更新数据库 ===');
    await resume.update({
      parsed_data: parsedData,
      status: 'analyzed'
    });

    console.log('✅ 简历解析并更新成功！');

    await sequelize.close();
  } catch (err) {
    console.error('解析失败:', err);
    await sequelize.close();
  }
}

reparseResume70();
