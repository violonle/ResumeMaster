process.argv[1] = process.argv[1] || 'x';

const DomesticAIService = require('../services/domesticAIService');
DomesticAIService.prototype.analyzeResume = async function (_resumeText, _jobDescription, _userCtx, scene) {
  if (scene !== 'deep_analysis') {
    return { success: true, data: { overall_score: 85 } };
  }
  return {
    success: true,
    data: {
      overall_score: 72,
      scores_percent: {
        skills: 70,
        experience: 75,
        education: 68,
        stability: 72,
        potential: 74,
        teamwork: 73
      },
      summary: 'ok',
      strengths: ['a'],
      weaknesses: ['b'],
      suggestions: ['c'],
      hiring_advice: 'd'
    },
    service: 'stub',
    model: 'stub',
    responseTime: 1
  };
};

const aiController = require('../controllers/aiController');
const { sequelize, User, Resume, AnalysisResult } = require('../models');

const run = async () => {
  await sequelize.sync({ force: false, alter: false });

  const user = await User.findOne();
  if (!user) throw new Error('No user found in DB');

  const resume = await Resume.create({
    user_id: user.id,
    company_id: user.company_id || null,
    file_name: 'zhao_xu.pdf',
    file_size: 1,
    file_type: 'pdf',
    file_path: '',
    status: 'uploaded',
    score: 0,
    parsed_data: { content: 'x' },
    recruitment_status: '投递'
  });

  await aiController.processAnalysisBackground(resume.id, 'text', null, { id: user.id, company_id: user.company_id || null }, { scene: 'deep_analysis' });
  await aiController.processAnalysisBackground(resume.id, 'text', null, { id: user.id, company_id: user.company_id || null }, { scene: 'deep_analysis' });

  const cnt = await AnalysisResult.count({ where: { resume_id: resume.id } });
  const latest = await AnalysisResult.findOne({ where: { resume_id: resume.id }, order: [['analysis_date', 'DESC']] });
  const refreshed = await Resume.findByPk(resume.id);

  const ok =
    cnt === 1 &&
    latest &&
    latest.type === 'single' &&
    Number(latest.overall_score) === 72 &&
    refreshed &&
    refreshed.recruitment_status === '投递' &&
    Number(refreshed.score) === 72;

  console.log(JSON.stringify({ ok, analysisResultCount: cnt, latestScore: latest?.overall_score, resumeStatus: refreshed?.recruitment_status, resumeScore: refreshed?.score }, null, 2));

  await AnalysisResult.destroy({ where: { resume_id: resume.id } });
  await resume.destroy();

  if (!ok) process.exit(2);
};

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    try { await sequelize.close(); } catch (_) {}
  });

