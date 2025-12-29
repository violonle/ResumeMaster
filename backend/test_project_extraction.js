const fs = require('fs');
const path = require('path');
const OptimizedResumeParseService = require('./services/optimizedResumeParseService');

const parseService = new OptimizedResumeParseService();

const testResumeContent = `姓名：张三
电话：13800138000
邮箱：zhangsan@example.com
地址：北京市朝阳区

个人优势
具有5年全栈开发经验，熟悉前后端技术栈，有多个大型项目开发经验。

工作经历
2020.01-至今 某某科技有限公司 高级前端工程师
负责公司核心产品的前端架构设计和开发
使用Vue3、TypeScript等技术栈
带领5人前端团队完成多个项目

2018.06-2019.12 某某互联网公司 前端开发工程师
负责公司官网和后台管理系统开发
使用React、Redux等技术栈

教育背景
2014.09-2018.06 某某大学 计算机科学与技术 本科

项目经验
2022.03-2023.08 电商平台项目负责人
负责电商平台整体架构设计和开发
使用Vue3、Node.js、MySQL等技术
实现了商品管理、订单处理、支付等功能
项目上线后用户量达到10万+

2020.06-2021.12 企业管理系统核心开发者
负责企业管理系统的前端开发
使用React、TypeScript、Ant Design
实现了权限管理、数据统计、报表生成等功能

2019.03-2020.05 移动端APP参与者
参与移动端APP的开发
使用React Native、Redux
实现了用户登录、数据展示等功能

技能专长
前端：Vue3、React、TypeScript、JavaScript
后端：Node.js、Express、Java、Spring Boot
数据库：MySQL、MongoDB、Redis
工具：Git、Webpack、Docker
`;

async function testProjectExtraction() {
    console.log('=== 测试项目经验提取功能 ===\n');
    
    const result = await parseService.parseResumeContent(testResumeContent);
    
    console.log('项目经验提取结果:');
    console.log(JSON.stringify(result.projects, null, 2));
    
    console.log('\n工作年限计算结果:');
    console.log('experience_years:', result.experience_years);
    
    console.log('\n工作经历提取结果:');
    console.log(JSON.stringify(result.work_experience, null, 2));
    
    console.log('\n教育背景提取结果:');
    console.log(JSON.stringify(result.education, null, 2));
    
    console.log('\n技能提取结果:');
    console.log(JSON.stringify(result.skills, null, 2));
}

testProjectExtraction().catch(console.error);