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
  console.log('=== 调试工作经历描述提取（详细版） ===\n');

  const service = new OptimizedResumeParseService();
  const sections = service.extractAllSections(testResumeText);

  console.log('工作经历章节内容:');
  console.log('='.repeat(60));
  console.log(sections.experience || '未找到工作经历章节');
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

  console.log('\n\n=== 手动测试描述提取逻辑 ===\n');

  const experienceItems = [
    { startDate: '2018.01', endDate: '2020.12', company: '阿里巴巴', position: '前端工程师', description: [] },
    { startDate: '2020.01', endDate: '2023.12', company: '字节跳动', position: '高级前端工程师', description: [] },
    { startDate: '2023.01', endDate: '至今', company: '腾讯', position: '前端技术专家', description: [] }
  ];

  const lines = sections.experience.split('\n');
  let currentExpIndex = -1;

  console.log('逐行分析:');
  console.log('='.repeat(60));

  for (let i = 0; i < lines.length; i++) {
    const trimmedLine = lines[i].trim();
    if (!trimmedLine) continue;

    console.log(`\n行 ${i}: [${trimmedLine}]`);

    let matchedExp = false;

    for (let j = 0; j < experienceItems.length; j++) {
      const exp = experienceItems[j];
      const datePattern = exp.startDate.replace('.01', '').replace('.\\.', '.');
      const expPattern = new RegExp(
        `^${datePattern}[-–年]\\s+${exp.company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+${exp.position.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
        'i'
      );

      console.log(`  测试模式 ${j}: ${expPattern}`);
      console.log(`  匹配结果: ${expPattern.test(trimmedLine)}`);

      if (expPattern.test(trimmedLine)) {
        currentExpIndex = j;
        matchedExp = true;
        console.log(`  ✓ 匹配到工作经历 ${j}，设置 currentExpIndex = ${currentExpIndex}`);
        break;
      }
    }

    if (!matchedExp && currentExpIndex >= 0) {
      let isNextExp = false;
      for (let j = 0; j < experienceItems.length; j++) {
        if (j <= currentExpIndex) continue;
        const exp = experienceItems[j];
        const datePattern = exp.startDate.replace('.01', '').replace('.\\.', '.');
        const nextExpPattern = new RegExp(
          `^${datePattern}[-–年]\\s+${exp.company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+${exp.position.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
          'i'
        );
        if (nextExpPattern.test(trimmedLine)) {
          isNextExp = true;
          currentExpIndex = j;
          matchedExp = true;
          console.log(`  ✓ 匹配到下一个工作经历 ${j}，更新 currentExpIndex = ${currentExpIndex}`);
          break;
        }
      }

      if (!isNextExp) {
        experienceItems[currentExpIndex].description.push(trimmedLine);
        console.log(`  → 添加到工作经历 ${currentExpIndex} 的描述: [${trimmedLine}]`);
      }
    }
  }

  console.log('\n\n=== 最终工作经历（手动测试） ===\n');
  experienceItems.forEach((exp, index) => {
    console.log(`\n${index + 1}. ${exp.company} - ${exp.position}`);
    console.log(`   时间: ${exp.startDate} - ${exp.endDate}`);
    console.log(`   描述: ${exp.description.join(' ')}`);
  });

  console.log('\n=== 测试完成 ===');
}

testExperienceDescriptionExtraction().catch(console.error);