const { Resume } = require('./models');

async function testDatabaseStorage() {
  try {
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

    console.log('原始文本是否包含换行符:', testResumeText.includes('\n'));
    console.log('原始文本是否包含"教育背景":', testResumeText.includes('教育背景'));
    console.log('原始文本是否包含"工作经历":', testResumeText.includes('工作经历'));

    const resume = await Resume.create({
      user_id: 13,
      file_name: 'test_db_storage.txt',
      file_size: testResumeText.length,
      file_type: 'txt',
      file_path: '/tmp/test.txt',
      status: 'uploaded',
      source: 'manual_pool',
      is_talent_pool: true,
      raw_text: testResumeText
    });

    console.log('\n数据库存储的简历ID:', resume.id);
    console.log('数据库中raw_text是否包含换行符:', resume.raw_text.includes('\n'));
    console.log('数据库中raw_text是否包含"教育背景":', resume.raw_text.includes('教育背景'));
    console.log('数据库中raw_text是否包含"工作经历":', resume.raw_text.includes('工作经历'));

    const retrievedResume = await Resume.findByPk(resume.id);
    console.log('\n从数据库检索的raw_text是否包含换行符:', retrievedResume.raw_text.includes('\n'));
    console.log('从数据库检索的raw_text是否包含"教育背景":', retrievedResume.raw_text.includes('教育背景'));
    console.log('从数据库检索的raw_text是否包含"工作经历":', retrievedResume.raw_text.includes('工作经历'));

    await Resume.destroy({ where: { id: resume.id } });
    console.log('\n✓ 清理测试数据');
  } catch (err) {
    console.error('错误:', err);
  }
}

testDatabaseStorage();
