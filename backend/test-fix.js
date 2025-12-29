// 测试脚本：验证TXT简历解析修复
const { Resume } = require('./models');
const ResumeParseService = require('./services/resumeParseService');
const { extractTextFromFile } = require('./services/textExtractor');

const resumeParseService = new ResumeParseService();

// 测试TXT文件解析
async function testTxtParsing() {
    try {
        console.log('开始测试TXT简历解析...');
        
        // 创建一个简单的测试TXT内容
        const testContent = `
        姓名：张三
        电话：13800138000
        邮箱：zhangsan@example.com
        职位：软件工程师
        技能：JavaScript, React, Node.js
        工作经历：
        2020-2022 某科技公司 前端开发工程师
        2022-至今 某互联网公司 全栈开发工程师
        `;
        
        // 测试cleanText函数
        const cleanText = require('./services/textExtractor').cleanText;
        const cleanedContent = cleanText(testContent);
        console.log('清理后的文本内容:', cleanedContent);
        
        // 测试parseResumeContent函数
        const parsedResult = await resumeParseService.parseResumeContent(cleanedContent, 'txt');
        console.log('解析结果:', JSON.stringify(parsedResult, null, 2));
        
        console.log('测试完成：TXT简历解析正常工作');
        return true;
    } catch (error) {
        console.error('测试失败:', error);
        return false;
    }
}

// 运行测试
testTxtParsing().then(success => {
    process.exit(success ? 0 : 1);
});
