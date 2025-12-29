const ImprovedResumeParseService = require('./services/improvedResumeParseService');
const { sequelize, Resume } = require('./models');

async function testImprovedParser() {
  try {
    await sequelize.authenticate();
    
    const resume = await Resume.findByPk(70);
    if (!resume) {
      console.log('未找到ID为70的简历');
      return;
    }

    const parser = new ImprovedResumeParseService();
    const result = await parser.parseResumeContent(resume.raw_text);
    
    console.log('=== 解析结果 ===');
    console.log('姓名:', result.name);
    console.log('邮箱:', result.email);
    console.log('电话:', result.phone);
    console.log('位置:', result.location);
    console.log('职位:', result.jobTitle);
    console.log('工作年限:', result.experience_years);
    
    console.log('\n=== 个人优势 ===');
    console.log(result.summary);
    
    console.log('\n=== 工作经历 ===');
    console.log('数量:', result.workExperience.length);
    result.workExperience.forEach((exp, i) => {
      console.log(`\n${i + 1}. ${exp.company} - ${exp.position}`);
      console.log(`   时间: ${exp.startDate} - ${exp.endDate}`);
      console.log(`   描述: ${exp.description.substring(0, 100)}...`);
    });
    
    console.log('\n=== 项目经历 ===');
    console.log('数量:', result.projects.length);
    result.projects.forEach((proj, i) => {
      console.log(`\n${i + 1}. ${proj.name} - ${proj.role}`);
      console.log(`   时间: ${proj.startDate} - ${proj.endDate}`);
      console.log(`   描述: ${proj.description.substring(0, 100)}...`);
    });
    
    console.log('\n=== 教育经历 ===');
    console.log('数量:', result.education.length);
    result.education.forEach((edu, i) => {
      console.log(`\n${i + 1}. ${edu.school} - ${edu.major}`);
      console.log(`   学历: ${edu.degree}`);
      console.log(`   时间: ${edu.startDate} - ${edu.endDate}`);
    });
    
    console.log('\n=== 技能 ===');
    console.log('数量:', result.skills.length);
    result.skills.forEach((skill, i) => {
      console.log(`${i + 1}. ${skill}`);
    });
    
    await sequelize.close();
  } catch (err) {
    console.error('测试失败:', err);
  }
}

testImprovedParser();
