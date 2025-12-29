const path = require('path');
const fs = require('fs');
const { extractTextFromFile } = require('../services/enhancedTextExtractor');
const EnhancedResumeParseService = require('../services/enhancedResumeParseService');

async function debugImportProcess() {
  console.log('=== 调试简历导入过程 ===\n');
  
  // 创建测试文件
  const testDir = path.join(__dirname, 'test_files');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  
  // 测试用例1: 英文PDF简历
  const testPDFContent = `
JOHN SMITH
Software Engineer

Contact Information:
Email: john.smith@email.com
Phone: +1-555-123-4567
Location: San Francisco, CA

EDUCATION:
Bachelor of Science in Computer Science
Stanford University, 2018-2022

WORK EXPERIENCE:
2022-Present: Google Inc. - Software Engineer
Working on cloud infrastructure and distributed systems

TECHNICAL SKILLS:
Python, Java, Go, Kubernetes, AWS, Docker, SQL

PERSONAL STRENGTHS:
Strong problem-solving skills, excellent communication, team leadership experience
  `;
  
  // 测试用例2: 中文TXT简历
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
  const pdfPath = path.join(testDir, 'test_resume.pdf');
  const txtPath = path.join(testDir, 'test_resume.txt');
  
  // 由于我们不能直接创建PDF，先用TXT文件模拟PDF内容
  fs.writeFileSync(txtPath, testTXTContent, 'utf8');
  
  console.log('1. 测试TXT文件导入:');
  console.log('文件内容预览:');
  console.log(testTXTContent.substring(0, 200) + '...');
  
  try {
    console.log('\n--- 开始提取TXT文本 ---');
    const txtExtractedText = await extractTextFromFile(txtPath);
    console.log('提取到的文本长度:', txtExtractedText.length);
    console.log('提取到的文本内容:');
    console.log(txtExtractedText);
    
    console.log('\n--- 开始解析简历内容 ---');
    const parser = new EnhancedResumeParseService();
    const parsedResult = await parser.parseResumeContent(txtExtractedText, 'txt');
    
    console.log('解析结果:');
    console.log('姓名:', parsedResult.name);
    console.log('邮箱:', parsedResult.email);
    console.log('电话:', parsedResult.phone);
    console.log('城市:', parsedResult.location);
    console.log('工作经验:', parsedResult.experience);
    console.log('学历:', parsedResult.education);
    console.log('技能:', parsedResult.skills);
    console.log('工作经历:', parsedResult.experience);
    console.log('教育经历:', parsedResult.education);
    console.log('个人优势:', parsedResult.summary);
    
    // 检查是否有解析错误
    if (parsedResult.parseError) {
      console.log('解析错误:', parsedResult.parseError);
    }
    
    // 统计提取成功率
    const fields = ['name', 'email', 'phone', 'location', 'experience', 'education', 'skills'];
    const extractedFields = fields.filter(field => parsedResult[field] && parsedResult[field].toString().trim() !== '');
    console.log(`\n提取成功率: ${extractedFields.length}/${fields.length}`);
    console.log('成功提取的字段:', extractedFields);
    
  } catch (error) {
    console.error('TXT处理失败:', error);
  }
  
  // 模拟PDF处理（使用相同的TXT内容）
  console.log('\n\n2. 测试PDF文件导入（模拟）:');
  try {
    console.log('\n--- 开始提取PDF文本（模拟） ---');
    const pdfExtractedText = await extractTextFromFile(txtPath); // 用TXT文件模拟PDF
    console.log('提取到的文本长度:', pdfExtractedText.length);
    console.log('提取到的文本内容:');
    console.log(pdfExtractedText.substring(0, 300) + '...');
    
    console.log('\n--- 开始解析PDF简历内容 ---');
    const parser = new EnhancedResumeParseService();
    const parsedResult = await parser.parseResumeContent(pdfExtractedText, 'pdf');
    
    console.log('解析结果:');
    console.log('姓名:', parsedResult.name);
    console.log('邮箱:', parsedResult.email);
    console.log('电话:', parsedResult.phone);
    console.log('城市:', parsedResult.location);
    
  } catch (error) {
    console.error('PDF处理失败:', error);
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
  debugImportProcess().catch(console.error);
}

module.exports = { debugImportProcess };