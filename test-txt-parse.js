const ResumeParseService = require('./backend/services/resumeParseService');

async function testTxtParsing() {
    try {
        // 创建测试用的TXT简历内容
        const sampleTxtContent = `
姓名：张三
电话：13800138000
邮箱：zhangsan@example.com
地址：北京市朝阳区
求职意向：前端开发工程师

教育经历：
2016-2020 北京大学 计算机科学与技术 本科

工作经历：
2020-2022 某科技公司 前端开发工程师
负责公司官网的开发和维护

2022-至今 某互联网公司 高级前端开发工程师
负责电商平台的前端架构设计

技能：JavaScript, React, Node.js, HTML5, CSS3, Git
        `;

        console.log('=== TXT简历解析测试 ===');
        console.log('\n测试内容：');
        console.log(sampleTxtContent);
        
        // 实例化解析服务
        const parseService = new ResumeParseService();
        
        // 执行解析
        const parsedResult = await parseService.parseResumeContent(sampleTxtContent, 'txt');
        
        console.log('\n=== 解析结果 ===');
        console.log('\n基本信息：');
        console.log('  姓名：', parsedResult.name || '未填写');
        console.log('  邮箱：', parsedResult.email || '未填写');
        console.log('  电话：', parsedResult.phone || '未填写');
        console.log('  地址：', parsedResult.location || '未填写');
        console.log('  求职意向：', parsedResult.jobTitle || '未填写');
        
        console.log('\n技能：');
        if (parsedResult.skills && parsedResult.skills.length > 0) {
            console.log('  ' + parsedResult.skills.join(', '));
        } else {
            console.log('  未填写');
        }
        
        console.log('\n教育经历：');
        if (parsedResult.education && parsedResult.education.length > 0) {
            parsedResult.education.forEach((edu, index) => {
                console.log(`  ${index + 1}. ${edu.startYear || ''} - ${edu.endYear || ''} ${edu.school || ''}`);
            });
        } else {
            console.log('  未填写');
        }
        
        console.log('\n工作经验：');
        console.log('  提取到的经验信息：', parsedResult.experience || '未填写');
        
        console.log('\n解析完成，根据解析规则：');
        console.log('- 邮箱和电话使用通用正则表达式，识别率较高');
        console.log('- 姓名需要明确的"姓名："前缀');
        console.log('- 技能可以通过"技能："前缀或预定义技能列表识别');
        console.log('- 教育经历需要"教育经历："前缀和年份格式');
        
    } catch (error) {
        console.error('解析测试时出错：', error);
    }
}

testTxtParsing();
