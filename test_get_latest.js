
const { AnalysisResult, Resume, Job } = require('./backend/models');
const { getLatestAnalysisResult } = require('./backend/controllers/analysisController');

async function testGetLatest() {
  try {
    // 模拟 req, res
    const req = {
      params: { resumeId: '1' }, // 假设 1 是一个存在的简历 ID
      user: { id: 1, company_id: null }
    };
    const res = {
      json: (data) => {
        console.log('API Response:', JSON.stringify(data, null, 2));
      },
      status: (code) => ({
        json: (data) => {
          console.log(`API Error (${code}):`, JSON.stringify(data, null, 2));
        }
      })
    };

    console.log('Testing getLatestAnalysisResult...');
    await getLatestAnalysisResult(req, res);
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    process.exit();
  }
}

testGetLatest();
