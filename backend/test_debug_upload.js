const fs = require('fs');
const path = require('path');
const { extractTextFromFile } = require('./services/textExtractor');

const TEST_RESUME_FILE = path.join(__dirname, 'test_resume_debug.txt');

const testResumeText = `姓名：张三
电话：13800138000
邮箱：zhangsan@example.com
地址：北京市朝阳区
职位：前端工程师

个人简介：
拥有5年前端开发经验，精通React、Vue等主流框架，具备良好的团队协作能力和项目管理经验。

技能：
JavaScript, TypeScript, React, Vue, Node.js, HTML, CSS, Webpack, Git, Docker

教育背景：
2014-2018 清华大学 计算机科学与技术 本科

工作经历：
2018-2020 阿里巴巴 前端工程师
负责淘宝网首页开发，使用React和Redux构建高性能前端应用，参与双十一大促活动页面开发。

2020-2023 字节跳动 高级前端工程师
负责抖音Web端核心功能开发，使用Vue3和TypeScript，优化页面加载速度提升30%，带领5人团队完成多个重要项目。

2023-至今 腾讯 前端技术专家
负责微信小程序平台开发，制定前端技术规范，指导团队成员技术成长，推动前端工程化建设。

项目经验：
1. 电商平台重构项目 - 技术负责人
   使用React18和Next.js重构电商平台，提升用户体验和性能指标

2. 数据可视化平台 - 核心开发者
   使用D3.js和ECharts开发数据可视化组件，支持千万级数据实时渲染

3. 移动端H5活动平台 - 架构设计
   设计并实现移动端H5活动平台，支持快速搭建营销活动页面`;

async function testDebug() {
  try {
    console.log('=== 调试文件上传过程 ===\n');
    
    fs.writeFileSync(TEST_RESUME_FILE, testResumeText, 'utf-8');
    console.log('1. 创建测试文件');
    console.log('原始文本是否包含换行符:', testResumeText.includes('\n'));
    console.log('原始文本是否包含"教育背景":', testResumeText.includes('教育背景'));
    console.log('原始文本是否包含"工作经历":', testResumeText.includes('工作经历'));
    
    const fileContent = fs.readFileSync(TEST_RESUME_FILE, 'utf-8');
    console.log('\n2. 读取文件内容');
    console.log('读取的文件内容是否包含换行符:', fileContent.includes('\n'));
    console.log('读取的文件内容是否包含"教育背景":', fileContent.includes('教育背景'));
    console.log('读取的文件内容是否包含"工作经历":', fileContent.includes('工作经历'));
    
    const fileBase64 = Buffer.from(fileContent, 'utf-8').toString('base64');
    console.log('\n3. 转换为base64');
    const decodedContent = Buffer.from(fileBase64, 'base64').toString('utf-8');
    console.log('解码后的内容是否包含换行符:', decodedContent.includes('\n'));
    console.log('解码后的内容是否包含"教育背景":', decodedContent.includes('教育背景'));
    console.log('解码后的内容是否包含"工作经历":', decodedContent.includes('工作经历'));
    
    const extractedText = await extractTextFromFile(TEST_RESUME_FILE);
    console.log('\n4. 提取文本');
    console.log('提取的文本是否包含换行符:', extractedText.includes('\n'));
    console.log('提取的文本是否包含"教育背景":', extractedText.includes('教育背景'));
    console.log('提取的文本是否包含"工作经历":', extractedText.includes('工作经历'));
    console.log('\n提取的文本内容:');
    console.log(extractedText);
    
    fs.unlinkSync(TEST_RESUME_FILE);
    console.log('\n✓ 清理测试文件');
  } catch (err) {
    console.error('错误:', err);
  }
}

testDebug();