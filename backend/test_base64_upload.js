const fs = require('fs');
const path = require('path');
const { extractTextFromFile } = require('./services/textExtractor');
const OptimizedResumeParseService = require('./services/optimizedResumeParseService');

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

async function testBase64UploadProcess() {
  try {
    const TEST_FILE = 'test_base64_upload.txt';
    const optimizedResumeParseService = new OptimizedResumeParseService();

    console.log('=== 1. 原始文本 ===');
    console.log('长度:', testResumeText.length);
    console.log('是否包含换行符:', testResumeText.includes('\n'));
    console.log('是否包含"教育背景":', testResumeText.includes('教育背景'));
    console.log('是否包含"工作经历":', testResumeText.includes('工作经历'));

    fs.writeFileSync(TEST_FILE, testResumeText, 'utf-8');
    console.log('\n✓ 写入文件');

    const fileContent = fs.readFileSync(TEST_FILE, 'utf-8');
    console.log('\n=== 2. 读取文件内容 ===');
    console.log('长度:', fileContent.length);
    console.log('是否包含换行符:', fileContent.includes('\n'));
    console.log('是否包含"教育背景":', fileContent.includes('教育背景'));
    console.log('是否包含"工作经历":', fileContent.includes('工作经历'));

    const base64Content = Buffer.from(fileContent).toString('base64');
    console.log('\n=== 3. Base64编码 ===');
    console.log('Base64长度:', base64Content.length);

    const decodedContent = Buffer.from(base64Content, 'base64').toString('utf-8');
    console.log('\n=== 4. Base64解码 ===');
    console.log('解码后长度:', decodedContent.length);
    console.log('解码后是否包含换行符:', decodedContent.includes('\n'));
    console.log('解码后是否包含"教育背景":', decodedContent.includes('教育背景'));
    console.log('解码后是否包含"工作经历":', decodedContent.includes('工作经历'));

    const extractedText = await extractTextFromFile(TEST_FILE);
    console.log('\n=== 5. 提取的文本 (extractTextFromFile) ===');
    console.log('长度:', extractedText.length);
    console.log('是否包含换行符:', extractedText.includes('\n'));
    console.log('是否包含"教育背景":', extractedText.includes('教育背景'));
    console.log('是否包含"工作经历":', extractedText.includes('工作经历'));

    const parsedData = await optimizedResumeParseService.parseResumeContent(extractedText, 'txt');
    console.log('\n=== 6. 解析后的数据 ===');
    console.log('rawText长度:', parsedData.rawText.length);
    console.log('rawText是否包含换行符:', parsedData.rawText.includes('\n'));
    console.log('rawText是否包含"教育背景":', parsedData.rawText.includes('教育背景'));
    console.log('rawText是否包含"工作经历":', parsedData.rawText.includes('工作经历'));

    fs.unlinkSync(TEST_FILE);
    console.log('\n✓ 删除测试文件');
  } catch (err) {
    console.error('错误:', err);
  } finally {
    process.exit(0);
  }
}

testBase64UploadProcess();
