const { extractTextFromFile } = require('./services/textExtractor');
const OptimizedResumeParseService = require('./services/optimizedResumeParseService');

const optimizedResumeParseService = new OptimizedResumeParseService();

const testResumeText = `张三
电话：13800138000
邮箱：zhangsan@example.com

教育背景
清华大学 计算机科学与技术 本科 2015.09-2019.06

工作经历
腾讯 高级软件工程师 2019.07-至今
负责核心业务系统的开发和维护`;

async function testParsingProcess() {
  try {
    console.log('=== 测试解析过程 ===\n');
    
    console.log('1. 原始文本:');
    console.log('是否包含换行符:', testResumeText.includes('\n'));
    console.log('是否包含"教育背景":', testResumeText.includes('教育背景'));
    console.log('是否包含"工作经历":', testResumeText.includes('工作经历'));
    console.log('\n原始文本内容:');
    console.log(testResumeText);
    
    const parsedData = await optimizedResumeParseService.parseResumeContent(testResumeText, 'txt');
    
    console.log('\n\n2. 解析后的rawText:');
    console.log('是否包含换行符:', parsedData.rawText.includes('\n'));
    console.log('是否包含"教育背景":', parsedData.rawText.includes('教育背景'));
    console.log('是否包含"工作经历":', parsedData.rawText.includes('工作经历'));
    console.log('\n解析后的rawText内容:');
    console.log(parsedData.rawText);
    
    console.log('\n\n3. 解析结果:');
    console.log('姓名:', parsedData.name);
    console.log('电话:', parsedData.phone);
    console.log('邮箱:', parsedData.email);
    console.log('教育背景:', JSON.stringify(parsedData.education, null, 2));
    console.log('工作经历:', JSON.stringify(parsedData.work_experience, null, 2));
    
  } catch (err) {
    console.error('错误:', err);
  }
}

testParsingProcess();