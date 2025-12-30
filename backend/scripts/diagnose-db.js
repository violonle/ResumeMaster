const sequelize = require('../config/db');
const { AnalysisResult } = require('../models');

async function diagnose() {
  try {
    console.log('--- 数据库诊断开始 ---');
    const results = await AnalysisResult.findAll({
      limit: 5,
      order: [['id', 'DESC']]
    });

    if (results.length === 0) {
      console.log('❌ 数据库中没有任何分析结果。');
    } else {
      results.forEach((res, index) => {
        console.log(`\n[结果 #${index + 1}] ID: ${res.id}`);
        console.log(`Resume ID: ${res.resume_id}`);
        console.log(`Overall Score: ${res.overall_score}`);
        console.log(`Dimensions: ${JSON.stringify(res.dimensions)}`);
        console.log(`Summary: ${res.summary ? res.summary.substring(0, 50) + '...' : '空'}`);
        console.log(`Has Strengths: ${res.strengths && res.strengths.length > 0}`);
                        console.log(`Detailed Analysis (keys): ${res.detailed_analysis ? Object.keys(typeof res.detailed_analysis === 'string' ? JSON.parse(res.detailed_analysis) : res.detailed_analysis).join(', ') : '空'}`);
                        if (res.detailed_analysis) {
                            const detail = typeof res.detailed_analysis === 'string' ? JSON.parse(res.detailed_analysis) : res.detailed_analysis;
                            console.log(`Report Object Keys: ${detail.evaluation_report ? Object.keys(detail.evaluation_report).join(', ') : '无 report 字段'}`);
                        }
                        console.log(`AI Provider: ${res.ai_provider}`);
        console.log(`Created At: ${res.analysis_date}`);
      });
    }
    console.log('\n--- 数据库诊断结束 ---');
    process.exit(0);
  } catch (error) {
    console.error('❌ 诊断失败:', error);
    process.exit(1);
  }
}

diagnose();
