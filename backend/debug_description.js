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

async function testExperienceDescriptionExtraction() {
  console.log('=== 调试工作经历描述提取 ===\n');

  const service = new OptimizedResumeParseService();
  const sections = service.extractAllSections(testResumeText);

  console.log('工作经历章节内容:');
  console.log('='.repeat(60));
  console.log(sections.experience || '未找到工作经历章节');
  console.log('='.repeat(60));

  console.log('\n工作经历章节行分析:');
  console.log('='.repeat(60));
  const lines = sections.experience.split('\n');
  lines.forEach((line, index) => {
    console.log(`行 ${index}: [${line.trim()}]`);
  });
  console.log('='.repeat(60));

  const result = await service.parseResumeContent(testResumeText);

  console.log('\n解析结果:');
  console.log('  工作经历数量:', result.work_experience ? result.work_experience.length : 0);

  if (result.work_experience && result.work_experience.length > 0) {
    console.log('\n工作经历详情:');
    result.work_experience.forEach((exp, index) => {
      console.log(`\n${index + 1}. ${exp.company || '未知公司'} - ${exp.position || '未知职位'}`);
      console.log(`   时间: ${exp.startDate || ''} - ${exp.endDate || ''}`);
      console.log(`   描述: ${Array.isArray(exp.description) ? exp.description.join(' ') : exp.description || '无'}`);
    });
  }

  console.log('\n=== 测试完成 ===');
}

testExperienceDescriptionExtraction().catch(console.error);