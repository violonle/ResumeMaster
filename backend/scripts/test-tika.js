const path = require('path');
const tikaService = require('../services/tikaService');
const { extractTextFromFile } = require('../services/textExtractor');

async function testTika() {
    console.log('=== Apache Tika 集成测试 ===');
    
    // 1. 检查服务可用性
    console.log('\n1. 检查 Tika Server 可用性...');
    const available = await tikaService.isAvailable();
    if (!available) {
        console.warn('⚠️  Tika Server 未启动 (http://localhost:9998)');
        console.log('请确保你已经运行了 Tika Server。你可以使用 Docker 启动:');
        console.log('docker run -d -p 9998:9998 apache/tika:latest');
        return;
    }
    console.log('✅ Tika Server 已就绪');

    // 2. 测试解析一个文件
    // 寻找一个现有的测试文件
    const testFiles = [
        '../uploads/resumes/test1.pdf',
        '../uploads/resumes/test2.docx'
    ];

    for (const relativePath of testFiles) {
        const filePath = path.join(__dirname, relativePath);
        console.log(`\n2. 测试解析文件: ${path.basename(filePath)}`);
        
        try {
            const startTime = Date.now();
            const text = await extractTextFromFile(filePath);
            const duration = Date.now() - startTime;

            if (text) {
                console.log(`✅ 解析成功 (耗时: ${duration}ms)`);
                console.log('文本预览 (前200字符):');
                console.log('-----------------------------------');
                console.log(text.substring(0, 200) + '...');
                console.log('-----------------------------------');
            } else {
                console.error('❌ 解析结果为空');
            }
        } catch (error) {
            console.error(`❌ 解析出错: ${error.message}`);
        }
    }
}

testTika();
