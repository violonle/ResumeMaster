require('dotenv').config();
const { AnalysisResult, Resume } = require('../models');

async function main() {
  const rows = await AnalysisResult.findAll({
    where: { type: 'single' },
    include: [{ model: Resume, as: 'Resume', attributes: ['id', 'name', 'file_name'] }],
    order: [['id', 'DESC']],
    limit: 500
  });

  const bad = [];
  for (const r of rows) {
    const dims = r.dimensions || {};
    const vals = ['skills', 'experience', 'education', 'stability', 'potential', 'teamwork'].map(k => Number(dims[k] || 0));
    const zeroCount = vals.filter(v => v === 0).length;
    if (zeroCount >= 4) {
      bad.push({
        id: r.id,
        resume_id: r.resume_id,
        name: (r.Resume && r.Resume.name) || null,
        overall_score: r.overall_score,
        zeroCount,
        dimensions: dims
      });
    }
  }

  console.log('checked:', rows.length, 'bad>=4 zeros:', bad.length);
  bad.slice(0, 30).forEach(b => {
    console.log(`${b.id}\tresume:${b.resume_id}\t${b.name || ''}\toverall:${b.overall_score}\tzeros:${b.zeroCount}\t${JSON.stringify(b.dimensions)}`);
  });
}

main().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});

