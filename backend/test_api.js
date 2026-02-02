const { getAllJobs } = require('./controllers/jobController');
const { getTalentPoolResumes } = require('./controllers/libraryController');
const { User } = require('./models');

async function testControllers() {
  try {
    // 模拟 masteradmin 用户 (ID: 1, CompanyID: 1)
    const user = await User.findByPk(1);
    const req = {
      user: user,
      query: {}
    };
    
    const res = {
      json: (data) => console.log('Response:', JSON.stringify(data, null, 2)),
      status: (code) => ({
        json: (data) => console.log(`Status ${code} Response:`, JSON.stringify(data, null, 2))
      })
    };

    console.log('--- Testing getAllJobs for masteradmin ---');
    await getAllJobs(req, res);

    console.log('\n--- Testing getTalentPoolResumes for masteradmin (jobId: 8) ---');
    req.query.jobId = '8';
    await getTalentPoolResumes(req, res);

  } catch (error) {
    console.error('Error:', error);
  }
}

testControllers();
