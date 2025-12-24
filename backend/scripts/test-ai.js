/**
 * AI分析功能测试脚本
 */
const AIAnalysisService = require('../services/aiAnalysisService');

async function testAIAnalysis() {
    console.log('🚀 开始测试AI分析功能...\n');

    const aiService = new AIAnalysisService();

    // 1. 测试服务状态
    console.log('📊 测试AI服务状态...');
    const status = aiService.getServiceStatus();
    console.log('服务状态:', JSON.stringify(status, null, 2));
    console.log('');

    // 2. 测试模拟分析
    console.log('🔧 测试模拟分析（降级模式）...');
    const sampleResume = `
张三
前端开发工程师

教育背景：
2020-2024 北京理工大学 计算机科学与技术 本科

工作经历：
2024.07-至今 阿里巴巴 前端开发工程师
- 使用React技术栈开发电商平台
- 负责前端页面开发与优化
- 参与项目架构设计

技能：
- JavaScript, React, Vue.js
- HTML5, CSS3, TypeScript
- Node.js, Webpack
- Git, MySQL

项目经验：
- 电商后台管理系统：基于React + Ant Design
- 移动端H5应用：响应式设计，Vue.js + Vant
`;

    try {
        const analysisResult = await aiService.analyzeResume(sampleResume, {
            title: '高级前端开发工程师',
            requirements: '3年以上前端开发经验，熟练使用React和Vue',
            salary: '20-30K',
            location: '北京'
        });

        console.log('✅ 模拟分析成功!');
        console.log('分析结果:');
        console.log(`  - 综合评分: ${analysisResult.overall_score}`);
        console.log(`  - 主要优势: ${analysisResult.strengths.join(', ')}`);
        console.log(`  - 改进建议: ${analysisResult.weaknesses.join(', ')}`);
        console.log(`  - AI提供商: ${analysisResult.aiProvider}`);
        console.log('');

    } catch (error) {
        console.error('❌ 模拟分析失败:', error.message);
    }

    // 3. 测试文档提取
    console.log('📄 测试文档提取功能...');
    try {
        // 创建一个测试文本文件
        const fs = require('fs');
        const testFile = 'uploads/test-resume.txt';
        
        if (!fs.existsSync('uploads')) {
            fs.mkdirSync('uploads');
        }
        
        fs.writeFileSync(testFile, sampleResume);
        
        const content = await aiService.extractDocumentContent(testFile);
        console.log('✅ 文档提取成功!');
        console.log(`  - 提取内容长度: ${content.length} 字符`);
        
        // 清理测试文件
        fs.unlinkSync(testFile);
        
    } catch (error) {
        console.log('⚠️ 文档提取功能需要安装相应依赖:', error.message);
        console.log('  - PDF: npm install pdf-parse');
        console.log('  - DOCX: npm install mammoth');
    }

    console.log('\n🎉 AI分析功能测试完成!');
    console.log('\n📋 测试总结:');
    console.log(`  - 可用AI提供商: ${status.availableProviders.join(', ') || '无'}`);
    console.log(`  - 当前提供商: ${status.provider}`);
    console.log(`  - 服务状态: ${status.isOperational ? '运行中' : '模拟模式'}`);
    
    if (status.availableProviders.length === 0) {
        console.log('\n⚠️ 提示: 当前使用模拟分析，请配置AI API密钥以启用真实AI分析:');
        console.log('  - OpenAI: 设置 OPENAI_API_KEY');
        console.log('  - Anthropic: 设置 ANTHROPIC_API_KEY');
        console.log('  - Google AI: 设置 GOOGLE_API_KEY');
        console.log('  - 本地模型: 设置 LOCAL_API_URL');
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    testAIAnalysis();
}

module.exports = testAIAnalysis;