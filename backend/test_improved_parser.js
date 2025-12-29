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

    console.log('=== 使用改进解析器解析简历 ===');
    console.log('文件名:', resume.file_name);
    console.log('文件类型:', resume.file_type);
    
    const parser = new ImprovedResumeParseService();
    const parsedData = await parser.parseResumeContent(resume.raw_text, resume.file_type);
    
    console.log('\n=== 解析结果 ===');
    console.log('姓名:', parsedData.name);
    console.log('职位:', parsedData.jobTitle);
    console.log('邮箱:', parsedData.email);
    console.log('电话:', parsedData.phone);
    console.log('位置:', parsedData.location);
    console.log('工作年限:', parsedData.experience_years);
    
    console.log('\n=== 个人优势 ===');
    console.log('长度:', parsedData.summary ? parsedData.summary.length : 0);
    if (parsedData.summary) {
      console.log('前200字符:', parsedData.summary.substring(0, 200));
    }
    
    console.log('\n=== 工作经历 ===');
    console.log('数量:', parsedData.workExperience ? parsedData.workExperience.length : 0);
    if (parsedData.workExperience && parsedData.workExperience.length > 0) {
      parsedData.workExperience.forEach((exp, i) => {
        console.log(`\n工作经历 ${i + 1}:`);
        console.log('  公司:', exp.company);
        console.log('  职位:', exp.position);
        console.log('  时间:', exp.startDate, '-', exp.endDate);
        console.log('  描述长度:', exp.description ? exp.description.length : 0);
      });
    }
    
    console.log('\n=== 教育经历 ===');
    console.log('数量:', parsedData.education ? parsedData.education.length : 0);
    if (parsedData.education && parsedData.education.length > 0) {
      parsedData.education.forEach((edu, i) => {
        console.log(`\n教育经历 ${i + 1}:`);
        console.log('  学校:', edu.school);
        console.log('  学历:', edu.degree);
        console.log('  专业:', edu.major);
        console.log('  时间:', edu.startDate, '-', edu.endDate);
      });
    }
    
    console.log('\n=== 项目经历 ===');
    console.log('数量:', parsedData.projects ? parsedData.projects.length : 0);
    if (parsedData.projects && parsedData.projects.length > 0) {
      parsedData.projects.forEach((proj, i) => {
        console.log(`\n项目经历 ${i + 1}:`);
        console.log('  项目名称:', proj.name);
        console.log('  角色:', proj.role);
        console.log('  时间:', proj.startDate, '-', proj.endDate);
        console.log('  描述长度:', proj.description ? proj.description.length : 0);
      });
    }
    
    console.log('\n=== 技能 ===');
    console.log('数量:', parsedData.skills ? parsedData.skills.length : 0);
    if (parsedData.skills && parsedData.skills.length > 0) {
      console.log('前10个技能:', parsedData.skills.slice(0, 10).join(', '));
    }
    
    console.log('\n=== 更新数据库 ===');
    await resume.update({
      parsed_data: parsedData
    });
    
    console.log('✅ 简历重新解析并更新成功！');
    
    await sequelize.close();
  } catch (err) {
    console.error('测试失败:', err);
  }
}

testImprovedParser();
