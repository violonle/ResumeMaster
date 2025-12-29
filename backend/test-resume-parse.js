const ResumeParseService = require('./services/resumeParseService');
const fs = require('fs');

async function testResumeParse() {
  const resumeParseService = new ResumeParseService();
  
  const testContent = fs.readFileSync('./uploads/resumes/test_resume.txt', 'utf8');
  console.log('测试简历内容:');
  console.log(testContent);
  console.log('\n====================\n');
  
  const parsed = await resumeParseService.parseResumeContent(testContent, 'txt');
  
  console.log('解析结果:');
  console.log('姓名:', parsed.name);
  console.log('电话:', parsed.phone);
  console.log('邮箱:', parsed.email);
  console.log('地址:', parsed.location);
  console.log('职位:', parsed.jobTitle);
  console.log('技能:', parsed.skills);
  console.log('工作年限:', parsed.experience_years);
  console.log('教育背景:', parsed.education);
  console.log('工作经历:', parsed.experience);
  console.log('个人简介:', parsed.summary);
}

testResumeParse().catch(console.error);