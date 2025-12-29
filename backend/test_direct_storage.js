const { Resume } = require('./models');
const OptimizedResumeParseService = require('./services/optimizedResumeParseService');

const optimizedResumeParseService = new OptimizedResumeParseService();

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

async function testDirectStorage() {
  try {
    console.log('=== 测试直接存储到数据库 ===\n');
    
    console.log('1. 原始文本:');
    console.log('是否包含换行符:', testResumeText.includes('\n'));
    console.log('是否包含"教育背景":', testResumeText.includes('教育背景'));
    console.log('是否包含"工作经历":', testResumeText.includes('工作经历'));
    
    const parsedData = await optimizedResumeParseService.parseResumeContent(testResumeText, 'txt');
    
    console.log('\n2. 解析后的rawText:');
    console.log('是否包含换行符:', parsedData.rawText.includes('\n'));
    console.log('是否包含"教育背景":', parsedData.rawText.includes('教育背景'));
    console.log('是否包含"工作经历":', parsedData.rawText.includes('工作经历'));
    
    console.log('\n3. 解析结果:');
    console.log('教育背景数量:', parsedData.education.length);
    console.log('工作经历数量:', parsedData.work_experience.length);
    
    const resumeData = {
      user_id: 13,
      file_name: 'test_direct.txt',
      file_size: testResumeText.length,
      file_type: 'txt',
      file_path: '/tmp/test_direct.txt',
      status: 'uploaded',
      source: 'manual_pool',
      is_talent_pool: true,
      parsed_data: parsedData,
      raw_text: testResumeText
    };
    
    console.log('\n4. 存储前的数据:');
    console.log('raw_text是否包含换行符:', resumeData.raw_text.includes('\n'));
    console.log('parsed_data.rawText是否包含换行符:', resumeData.parsed_data.rawText.includes('\n'));
    
    const resume = await Resume.create(resumeData);
    
    console.log('\n5. 从数据库读取的数据:');
    console.log('raw_text是否包含换行符:', resume.raw_text.includes('\n'));
    console.log('parsed_data.rawText是否包含换行符:', resume.parsed_data.rawText.includes('\n'));
    
    console.log('\n6. raw_text内容:');
    console.log(resume.raw_text);
    
    console.log('\n7. parsed_data.rawText内容:');
    console.log(resume.parsed_data.rawText);
    
    console.log('\n8. 工作经历:');
    console.log(JSON.stringify(resume.work_experience, null, 2));
    
    console.log('\n9. 教育背景:');
    console.log(JSON.stringify(resume.education, null, 2));
    
  } catch (err) {
    console.error('错误:', err);
  }
}

testDirectStorage();