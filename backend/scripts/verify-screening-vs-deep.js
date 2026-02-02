process.argv[1] = process.argv[1] || 'x';

const DomesticAIService = require('../services/domesticAIService');
DomesticAIService.prototype.analyzeResume = async function () {
  return {
    success: true,
    data: { overall_score: 78 },
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

  const makeReqRes = (resumeId, scene) => {
    const req = {
      body: {
        resumeIds: [resumeId],
        options: { scene }
      },
      user: {
        id: user.id,
        company_id: user.company_id || null
      }
    };
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.payload = payload;
        return this;
      }
    };
    return { req, res };
  };

  const quick = await Resume.create({
    user_id: user.id,
    company_id: user.company_id || null,
    file_name: 'quick.pdf',
    file_size: 1,
    file_type: 'pdf',
    file_path: '',
    status: 'uploaded',
    score: 0,
    parsed_data: { content: 'x' },
    recruitment_status: 'applied'
  });

  const quickRR = makeReqRes(quick.id, 'analysis');
  await aiController.batchAnalyzeResumes(quickRR.req, quickRR.res);
  const quickCnt = await AnalysisResult.count({ where: { resume_id: quick.id } });
  const quickAfter = await Resume.findByPk(quick.id);
  await quick.destroy();

  const deep = await Resume.create({
    user_id: user.id,
    company_id: user.company_id || null,
    file_name: 'deep.pdf',
    file_size: 1,
    file_type: 'pdf',
    file_path: '',
    status: 'uploaded',
    score: 0,
    parsed_data: { content: 'x' },
    recruitment_status: 'applied'
  });

  const deepRR = makeReqRes(deep.id, 'deep_analysis');
  await aiController.batchAnalyzeResumes(deepRR.req, deepRR.res);
  const deepCnt = await AnalysisResult.count({ where: { resume_id: deep.id } });
  const deepRow = await AnalysisResult.findOne({ where: { resume_id: deep.id }, order: [['id', 'DESC']] });
  await AnalysisResult.destroy({ where: { resume_id: deep.id } });
  await deep.destroy();

  const ok =
    quickRR.res.payload &&
    quickRR.res.payload.success === true &&
    quickCnt === 0 &&
    quickAfter &&
    Number(quickAfter.score) === 78 &&
    deepRR.res.payload &&
    deepRR.res.payload.success === true &&
    deepCnt === 1 &&
    deepRow &&
    deepRow.type === 'single';

  console.log(
    JSON.stringify(
      {
        quick: { ok: quickRR.res.payload?.success === true, score: quickAfter?.score, analysisResults: quickCnt },
        deep: { ok: deepRR.res.payload?.success === true, analysisResults: deepCnt, type: deepRow?.type },
        overall: ok
      },
      null,
      2
    )
  );

  if (!ok) process.exit(2);
};

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    try {
      await sequelize.close();
    } catch (_) {}
  });

