const fs = require('fs');
const path = require('path');
const { extractTextFromFile } = require('./services/textExtractor');
const OptimizedResumeParseService = require('./services/optimizedResumeParseService');

const parseService = new OptimizedResumeParseService();

async function testFileParsing(filePath, fileType) {
  console.log('\n========================================');
  console.log(`测试文件: ${path.basename(filePath)}`);
  console.log(`文件类型: ${fileType}`);
  console.log('========================================');

  try {
    const text = await extractTextFromFile(filePath);
    console.log(`文本提取成功，长度: ${text.length} 字符`);
    console.log(`文本预览 (前200字符):\n${text.substring(0, 200)}`);

    const parsedData = await parseService.parseResumeContent(text, fileType);
    console.log('\n解析结果:');
    console.log(`- 姓名: ${parsedData.name || '未识别'}`);
    console.log(`- 邮箱: ${parsedData.email || '未识别'}`);
    console.log(`- 电话: ${parsedData.phone || '未识别'}`);
    console.log(`- 位置: ${parsedData.location || '未识别'}`);
    console.log(`- 职位: ${parsedData.job_title || '未识别'}`);
    console.log(`- 工作经历数量: ${parsedData.work_experience?.length || 0}`);
    console.log(`- 教育经历数量: ${parsedData.education?.length || 0}`);
    console.log(`- 技能数量: ${parsedData.skills?.length || 0}`);
    console.log(`- 项目经验数量: ${parsedData.projects?.length || 0}`);
    console.log(`- 个人简介长度: ${parsedData.summary?.length || 0}`);

    return { success: true, parsedData };
  } catch (error) {
    console.error(`解析失败: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('开始测试所有文件格式解析功能...\n');

  const testFiles = [
    {
      path: './uploads/resumes/__产品经理__烟台_5-8K_刘良东_15年.pdf',
      type: 'pdf',
      description: 'PDF格式简历'
    },
    {
      path: './uploads/resumes/__售前工程师_烟台_3-8K_孙艳丽_6年.pdf',
      type: 'pdf',
      description: 'PDF格式简历2'
    }
  ];

  const results = [];

  for (const testFile of testFiles) {
    if (fs.existsSync(testFile.path)) {
      const result = await testFileParsing(testFile.path, testFile.type);
      results.push({
        file: testFile.description,
        ...result
      });
    } else {
      console.log(`\n跳过 ${testFile.description} - 文件不存在: ${testFile.path}`);
      results.push({
        file: testFile.description,
        success: false,
        error: '文件不存在'
      });
    }
  }

  console.log('\n========================================');
  console.log('测试总结');
  console.log('========================================');
  results.forEach(result => {
    console.log(`${result.file}: ${result.success ? '✓ 成功' : '✗ 失败'}`);
    if (!result.success) {
      console.log(`  错误: ${result.error}`);
    }
  });

  const successCount = results.filter(r => r.success).length;
  console.log(`\n总计: ${successCount}/${results.length} 成功`);
}

main().catch(console.error);
