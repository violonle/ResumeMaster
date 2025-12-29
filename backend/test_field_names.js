const OptimizedResumeParseService = require('./services/optimizedResumeParseService');
const EnhancedResumeParseService = require('./services/enhancedResumeParseService');
const ImprovedResumeParseService = require('./services/improvedResumeParseService');
const ResumeParseService = require('./services/resumeParseService');

const testResumeText = `
张三
前端开发工程师
邮箱：zhangsan@example.com
电话：13800138000
地址：北京市海淀区

教育经历
2018-2022 北京理工大学 计算机科学与技术 本科

工作经历
2022.07-2024.01 字节跳动 前端开发工程师
负责抖音Web端开发使用React + TypeScript技术栈
优化页面性能首屏加载时间提升40%

技能
JavaScript, TypeScript, React, Vue.js, Angular, Node.js
`;

async function testFieldNames() {
  console.log('=== 测试简历解析服务字段名格式 ===\n');

  console.log('1. OptimizedResumeParseService:');
  const optimizedService = new OptimizedResumeParseService();
  const optimizedResult = await optimizedService.parseResumeContent(testResumeText);
  console.log('解析结果字段:', Object.keys(optimizedResult));
  console.log('job_title:', optimizedResult.job_title);
  console.log('work_experience:', optimizedResult.work_experience ? optimizedResult.work_experience.length : 0, '条记录');
  if (optimizedResult.work_experience && optimizedResult.work_experience.length > 0) {
    console.log('第一条工作经历字段:', Object.keys(optimizedResult.work_experience[0]));
  }

  console.log('\n2. EnhancedResumeParseService:');
  const enhancedService = new EnhancedResumeParseService();
  const enhancedResult = await enhancedService.parseResumeContent(testResumeText);
  console.log('解析结果字段:', Object.keys(enhancedResult));
  console.log('job_title:', enhancedResult.job_title);
  console.log('work_experience:', enhancedResult.work_experience ? enhancedResult.work_experience.length : 0, '条记录');
  if (enhancedResult.work_experience && enhancedResult.work_experience.length > 0) {
    console.log('第一条工作经历字段:', Object.keys(enhancedResult.work_experience[0]));
  }

  console.log('\n3. ImprovedResumeParseService:');
  const improvedService = new ImprovedResumeParseService();
  const improvedResult = await improvedService.parseResumeContent(testResumeText);
  console.log('解析结果字段:', Object.keys(improvedResult));
  console.log('job_title:', improvedResult.job_title);
  console.log('work_experience:', improvedResult.work_experience ? improvedResult.work_experience.length : 0, '条记录');
  if (improvedResult.work_experience && improvedResult.work_experience.length > 0) {
    console.log('第一条工作经历字段:', Object.keys(improvedResult.work_experience[0]));
  }

  console.log('\n4. ResumeParseService:');
  const resumeService = new ResumeParseService();
  const resumeResult = await resumeService.parseResumeContent(testResumeText);
  console.log('解析结果字段:', Object.keys(resumeResult));
  console.log('job_title:', resumeResult.job_title);
  console.log('work_experience:', resumeResult.work_experience ? resumeResult.work_experience.length : 0, '条记录');
  if (resumeResult.work_experience && resumeResult.work_experience.length > 0) {
    console.log('第一条工作经历字段:', Object.keys(resumeResult.work_experience[0]));
  }

  console.log('\n=== 字段名格式验证完成 ===');
}

testFieldNames().catch(console.error);
