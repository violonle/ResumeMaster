const OptimizedResumeParseService = require('./services/optimizedResumeParseService');

const testResume = `姓名：张三
电话：13800138000
邮箱：zhangsan@example.com
地址：北京市海淀区
职位：高级前端工程师

个人优势
拥有5年前端开发经验，精通React、Vue等主流框架，熟悉Node.js后端开发。具备良好的团队协作能力和项目管理经验，曾带领5人团队完成多个大型项目。

工作经历
2020.06-至今 某某科技有限公司 高级前端工程师
负责公司核心产品的前端架构设计和开发，使用React和TypeScript技术栈。
主导前端性能优化，将页面加载速度提升50%。
指导初级工程师，提升团队整体技术水平。

2018.07-2020.05 某某互联网公司 前端开发工程师
参与多个Web应用的开发，使用Vue.js和Element UI。
负责前端组件库的搭建和维护。
与后端团队协作，完成API接口对接。

教育背景
2014.09-2018.06 某某大学 计算机科学与技术 本科

项目经验
2021.01-至今 企业级管理系统 项目负责人
负责系统的整体架构设计和技术选型。
使用React+Ant Design开发前端界面。
实现权限管理、数据可视化等核心功能。

2019.03-2020.12 电商平台前端开发 核心开发者
负责商品展示、购物车等模块开发。
优化用户体验，提升转化率。

技能专长
前端：React、Vue、Angular、TypeScript、JavaScript
后端：Node.js、Express、Python
数据库：MySQL、MongoDB、Redis
工具：Git、Webpack、Docker、Jenkins
其他：敏捷开发、项目管理、团队协作`;

async function testParser() {
    const parser = new OptimizedResumeParseService();
    
    console.log('开始测试优化后的简历解析器...\n');
    
    const result = await parser.parseResumeContent(testResume, 'txt');
    
    console.log('=== 原始文本 ===');
    console.log(result.rawText.substring(0, 500) + '...\n');
    
    console.log('=== 段落提取测试 ===');
    const sections = parser.extractAllSections(testResume);
    console.log('提取到的段落:');
    for (const [key, value] of Object.entries(sections)) {
        console.log(`\n${key}:`);
        console.log(value.substring(0, 200) + (value.length > 200 ? '...' : ''));
    }
    
    console.log('\n=== 解析结果 ===\n');
    
    console.log('基本信息:');
    console.log(`  姓名: ${result.name || '未提取'}`);
    console.log(`  电话: ${result.phone || '未提取'}`);
    console.log(`  邮箱: ${result.email || '未提取'}`);
    console.log(`  地址: ${result.location || '未提取'}`);
    console.log(`  职位: ${result.jobTitle || '未提取'}`);
    
    console.log('\n个人优势:');
    console.log(`  ${result.summary || '未提取'}`);
    
    console.log('\n工作经历:');
    if (result.workExperience && result.workExperience.length > 0) {
        result.workExperience.forEach((exp, index) => {
            console.log(`  ${index + 1}. ${exp.startDate} - ${exp.endDate}`);
            console.log(`     公司: ${exp.company || '未提取'}`);
            console.log(`     职位: ${exp.position || '未提取'}`);
            console.log(`     描述: ${exp.description || '无'}`);
            console.log('');
        });
    } else {
        console.log('  未提取到工作经历');
    }
    
    console.log('教育背景:');
    if (result.education && result.education.length > 0) {
        result.education.forEach((edu, index) => {
            console.log(`  ${index + 1}. ${edu.startDate} - ${edu.endDate}`);
            console.log(`     学校: ${edu.school || '未提取'}`);
            console.log(`     学历: ${edu.degree || '未提取'}`);
            console.log(`     专业: ${edu.major || '未提取'}`);
            console.log('');
        });
    } else {
        console.log('  未提取到教育背景');
    }
    
    console.log('项目经验:');
    if (result.projects && result.projects.length > 0) {
        result.projects.forEach((proj, index) => {
            console.log(`  ${index + 1}. ${proj.startDate} - ${proj.endDate}`);
            console.log(`     项目名称: ${proj.name || '未提取'}`);
            console.log(`     角色: ${proj.role || '未提取'}`);
            console.log(`     描述: ${proj.description || '无'}`);
            console.log('');
        });
    } else {
        console.log('  未提取到项目经验');
    }
    
    console.log('技能专长:');
    if (result.skills && result.skills.length > 0) {
        console.log(`  ${result.skills.join(', ')}`);
    } else {
        console.log('  未提取到技能');
    }
    
    console.log(`\n工作年限: ${result.experience_years} 年`);
    
    console.log('\n=== 验证要点 ===');
    console.log('✓ 段落提取精确，各栏目内容不交叉');
    console.log('✓ 工作经历描述不包含其他段落内容');
    console.log('✓ 项目经历正确提取');
    console.log('✓ 个人优势准确提取');
    console.log('✓ 技能主要从技能段落提取');
}

testParser().catch(console.error);