const DomesticAIService = require('../services/domesticAIService');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function testConnection() {
  console.log('开始测试 AI 服务连通性...');
  
  try {
    const aiService = new DomesticAIService();
    
    // 打印当前环境变量中的 Key (只打印前几位)
    console.log('环境变量检查:');
    ['DEEPSEEK_API_KEY', 'QWEN_API_KEY', 'GLM_API_KEY', 'SILICONFLOW_API_KEY'].forEach(key => {
      const val = process.env[key];
      console.log(`  ${key}: ${val ? val.substring(0, 8) + '...' : '未配置'}`);
    });

    console.log('\n正在检查服务状态 (checkServiceStatus)...');
    const status = await aiService.checkServiceStatus();
    console.log('服务状态结果:', JSON.stringify(status, null, 2));
    
    // 尝试一次简单的调用
    console.log('\n正在尝试发起一次简单的测试请求 (analyzeResume with dummy text)...');
    const dummyText = "姓名：张三\n职位：Java开发工程师\n经验：3年Java开发经验，熟悉Spring Boot。";
    
    const startTime = Date.now();
    const result = await aiService.analyzeResume(dummyText, '', null, 'deep_analysis');
    const duration = Date.now() - startTime;
    
    console.log(`\n测试请求完成，耗时: ${duration}ms`);
    console.log('请求结果 Success:', result.success);
    if (result.success) {
      console.log('返回数据预览:', JSON.stringify(result.data).substring(0, 200) + '...');
    } else {
      console.error('请求失败:', result.error);
    }

  } catch (error) {
    console.error('测试过程中发生未捕获的错误:', error);
  }
}

testConnection();
