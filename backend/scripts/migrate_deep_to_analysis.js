const sequelize = require('../config/db');
const { AnalysisResult } = require('../models');

async function tableExists(table) {
  const dialect = sequelize.getDialect();
  if (dialect === 'sqlite') {
    const [rows] = await sequelize.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=:t",
      { replacements: { t: table } }
    );
    return rows.length > 0;
  }
  const [rows] = await sequelize.query(
    "SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :t",
    { replacements: { t: table } }
  );
  return Number(rows[0]?.cnt || 0) > 0;
}

async function migrate() {
  try {
    console.log('=== 深度分析数据迁移开始 ===');
    await sequelize.authenticate();
    const exists = await tableExists('deep_analysis_records');
    if (!exists) {
      console.log('未检测到 deep_analysis_records 表，跳过迁移。');
      return;
    }
    const [rows] = await sequelize.query(
      "SELECT id, user_id, resume_id, job_id, company_id, type, overall_score, dimensions, details, analysis_date FROM deep_analysis_records ORDER BY id ASC"
    );
    console.log(`检测到 ${rows.length} 条待迁移记录`);
    let ok = 0, fail = 0;
    for (const r of rows) {
      try {
        await AnalysisResult.create({
          resume_id: r.resume_id,
          user_id: r.user_id,
          company_id: r.company_id || null,
          job_id: r.job_id || null,
          type: r.type === 'batch' ? 'multi' : (r.type || 'single'),
          overall_score: Number(r.overall_score) || 0,
          dimensions: typeof r.dimensions === 'string' ? JSON.parse(r.dimensions) : (r.dimensions || {}),
          detailed_analysis: typeof r.details === 'string' ? JSON.parse(r.details) : (r.details || {}),
          analysis_date: r.analysis_date || new Date()
        });
        ok++;
      } catch (e) {
        fail++;
        console.error(`迁移记录 #${r.id} 失败: ${e.message}`);
      }
    }
    console.log(`=== 迁移完成：成功 ${ok} 条，失败 ${fail} 条 ===`);
  } catch (error) {
    console.error('迁移执行失败:', error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

migrate();
