
const { Resume, AnalysisResult } = require('./backend/models');
const { Sequelize } = require('sequelize');

async function check() {
  try {
    const resumes = await Resume.findAll({
      where: {
        name: ['闵娟', '肖彦文']
      },
      include: [{
        model: AnalysisResult,
        as: 'analysisResults'
      }]
    });

    console.log('Found Resumes:', resumes.length);
    const results = resumes.map(r => ({
      id: r.id,
      name: r.name,
      status: r.status,
      analysisCount: r.analysisResults ? r.analysisResults.length : 0,
      latestAnalysis: r.analysisResults && r.analysisResults.length > 0 ? {
        id: r.analysisResults[0].id,
        overall_score: r.analysisResults[0].overall_score,
        dimensions: r.analysisResults[0].dimensions
      } : null
    }));

    console.log(JSON.stringify(results, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

check();
