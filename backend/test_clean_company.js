const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: '/Users/yangyong/工作/Projects/SuperResumeMaster/backend/database.sqlite',
  logging: false
});

const OptimizedResumeParseService = require('./services/optimizedResumeParseService');

async function testCleanCompanyName() {
  try {
    console.log('测试cleanCompanyName方法...');

    const parseService = new OptimizedResumeParseService();

    const testCases = [
      '境选品平台结合了公司在境外的资源优势拓展公司业务 山东享用宝信息技术有限公司',
      '系统及驾校APP的 策划需求文档撰写设计等工作 山东珍生康业生物科技有限公司',
      'VfKaWOainPXRMxZr 山东涅普顿健康产业有限公司',
      '计以及公司公众号商城淘宝拼多多等电商运营相关事宜 烟台市加华电子商务有限公司',
      '万加 烟台海格尔网络科技有限公司',
      'S类项目和电商类产品具有丰富的产品经验 工作经历 烟台贰伍叁网络科技有限公司'
    ];

    for (const testCase of testCases) {
      console.log(`\n原始文本: "${testCase}"`);
      const cleaned = parseService.cleanCompanyName(testCase);
      console.log(`清理后: "${cleaned}"`);
    }

  } catch (error) {
    console.error('测试cleanCompanyName失败:', error);
  } finally {
    await sequelize.close();
  }
}

testCleanCompanyName();