const path = require('path');
const { extractTextFromFile } = require('../services/enhancedTextExtractor');

async function testPDFRecognition() {
  console.log('=== 测试增强PDF识别功能 ===\n');
  
  // 测试不同类型的PDF文件
  const testFiles = [
    // 这里可以添加测试文件路径
    // '/uploads/test1.pdf',
    // '/uploads/test2.pdf'
  ];
  
  if (testFiles.length === 0) {
    console.log('请添加测试PDF文件路径到 testFiles 数组中');
    console.log('例如: testFiles.push("/uploads/sample.pdf");');
    return;
  }
  
  for (const filePath of testFiles) {
    console.log(`\n--- 测试文件: ${filePath} ---`);
    
    try {
      const startTime = Date.now();
      const text = await extractTextFromFile(filePath);
      const endTime = Date.now();
      
      console.log(`提取耗时: ${endTime - startTime}ms`);
      console.log(`提取文本长度: ${text.length} 字符`);
      
      if (text.length > 0) {
        console.log('提取内容预览:');
        console.log('--- 开始 ---');
        console.log(text.substring(0, 500)); // 显示前500字符
        console.log('--- 结束 ---');
        
        // 检测是否包含关键信息
        const hasChinese = /[\u4e00-\u9fa5]/.test(text);
        const hasEnglish = /[a-zA-Z]/.test(text);
        const hasNumbers = /\d/.test(text);
        
        console.log(`包含中文: ${hasChinese}`);
        console.log(`包含英文: ${hasEnglish}`);
        console.log(`包含数字: ${hasNumbers}`);
        
        // 检测简历相关信息
        const resumeKeywords = ['姓名', '电话', '邮箱', '学历', '工作', '经验', '技能'];
        const foundKeywords = resumeKeywords.filter(keyword => text.includes(keyword));
        console.log(`检测到简历关键词: ${foundKeywords.join(', ')}`);
        
      } else {
        console.log('警告: 未提取到任何文本内容');
      }
      
    } catch (error) {
      console.error(`处理文件失败: ${error.message}`);
    }
  }
  
  console.log('\n=== 测试完成 ===');
}

// 如果直接运行此脚本，执行测试
if (require.main === module) {
  testPDFRecognition().catch(console.error);
}

module.exports = { testPDFRecognition };