const path = require('path');
const fs = require('fs');
const { extractTextFromFile } = require('../services/enhancedTextExtractor');
const EnhancedResumeParseService = require('../services/enhancedResumeParseService');

async function debugSectionExtraction() {
  console.log('=== 调试段落提取功能 ===\n');
  
  // 创建测试文件
  const testDir = path.join(__dirname, 'test_files');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  
  // 测试用例: 中文简历
  const testTXTContent = `
个人简历

基本信息：
姓名：张三
性别：男
年龄：28岁
电话：13812345678
邮箱：zhangsan@example.com
现居地：北京市海淀区

教育背景：
2016.09 - 2020.06 北京大学 计算机科学与技术 本科

工作经历：
2020.07 - 至今 腾讯科技有限公司 软件工程师
负责后端服务开发和维护，参与多个重要项目

技能专长：
Java, Python, JavaScript, React, Spring Boot, MySQL, Redis

个人优势：
拥有扎实的技术基础，良好的团队合作精神，学习能力强
  `;
  
  // 保存测试文件
  const txtPath = path.join(testDir, 'test_resume.txt');
  fs.writeFileSync(txtPath, testTXTContent, 'utf8');
  
  console.log('原始文件内容:');
  console.log(testTXTContent);
  console.log('\n--- 开始提取文本 ---');
  
  try {
    const extractedText = await extractTextFromFile(txtPath);
    console.log('提取到的文本:');
    console.log(extractedText);
    
    console.log('\n--- 开始调试段落提取 ---');
    const parser = new EnhancedResumeParseService();
    
    // 测试各个段落的提取
    const sections = {
      education: ['教育背景', '教育经历', 'Education', 'Educational Background', '学历信息'],
      experience: ['工作经历', '工作经验', 'Work Experience', 'Professional Experience', '职业经历', '工作'],
      skills: ['技能特长', '专业技能', 'Skills', 'Technical Skills', '技能']
    };
    
    for (const [sectionType, sectionNames] of Object.entries(sections)) {
      console.log(`\n--- 测试 ${sectionType} 段落提取 ---`);
      console.log('查找的关键词:', sectionNames.join(', '));
      
      const section = parser.extractSection(extractedText, sectionNames);
      console.log(`提取到的 ${sectionType} 段落:`, section);
      
      if (section) {
        console.log(`段落长度:`, section.length);
        console.log(`段落预览:`, section.substring(0, 100));
      }
    }
    
    // 测试整体解析
    console.log('\n--- 测试整体解析 ---');
    const parsedResult = await parser.parseResumeContent(extractedText, 'txt');
    
    console.log('解析结果:');
    console.log('姓名:', parsedResult.name);
    console.log('邮箱:', parsedResult.email);
    console.log('电话:', parsedResult.phone);
    console.log('城市:', parsedResult.location);
    console.log('技能:', parsedResult.skills);
    console.log('工作经历:', JSON.stringify(parsedResult.experience, null, 2));
    console.log('教育经历:', JSON.stringify(parsedResult.education, null, 2));
    
    // 检查提取方法
    console.log('\n--- 直接测试提取方法 ---');
    console.log('直接提取工作经历:');
    const directExperience = parser.extractExperience(extractedText);
    console.log(JSON.stringify(directExperience, null, 2));
    
    console.log('\n直接提取教育经历:');
    const directEducation = parser.extractEducation(extractedText);
    console.log(JSON.stringify(directEducation, null, 2));
    
  } catch (error) {
    console.error('调试失败:', error);
  }
  
  // 清理测试文件
  try {
    fs.unlinkSync(txtPath);
    console.log('\n清理测试文件完成');
  } catch (e) {
    console.log('清理文件失败:', e.message);
  }
  
  console.log('\n=== 调试完成 ===');
}

// 如果直接运行此脚本，执行测试
if (require.main === module) {
  debugSectionExtraction().catch(console.error);
}

module.exports = { debugSectionExtraction };