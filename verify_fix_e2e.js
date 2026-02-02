
const { Resume, Job, ResumeJob, User, AnalysisResult, sequelize } = require('./backend/models');
const aiAnalysisCoreService = require('./backend/services/aiAnalysisCoreService');
const logger = require('./backend/utils/logger');

async function testFix() {
    console.log('🚀 Starting end-to-end fix verification...');
    
    try {
        // 1. Get a test user and resume
        const user = await User.findOne({ where: { username: 'masteradmin' } });
        if (!user) throw new Error('masteradmin user not found');

        const resume = await Resume.findOne({ order: [['id', 'DESC']] });
        if (!resume) throw new Error('No resume found in database');

        const job = await Job.findOne({ order: [['id', 'DESC']] });
        if (!job) throw new Error('No job found in database');

        console.log(`📝 Testing with Resume ID: ${resume.id}, Job ID: ${job.id}, User: ${user.username}`);

        // 2. Prepare test data
        const text = resume.raw_text || '这是一个测试简历。精通 Java, React, Node.js。有5年开发经验。';
        const jobDescription = {
            id: job.id,
            title: job.title,
            description: job.description,
            requirements: job.requirements
        };
        const options = { scene: 'deep_analysis', jobId: job.id };

        // 3. Trigger analysis core logic (simulating what the worker does)
        console.log('\nStep 3: Executing processAnalysis...');
        const result = await aiAnalysisCoreService.processAnalysis(
            resume.id,
            text,
            jobDescription,
            user,
            options,
            null,
            null,
            true // force
        );

        console.log('\n✅ Analysis Result:', JSON.stringify(result, null, 2));

        // 4. Verify database records
        const latestResult = await AnalysisResult.findOne({
            where: { resume_id: resume.id, type: 'single' },
            order: [['id', 'DESC']]
        });

        if (latestResult) {
            console.log('\n✅ AnalysisResult created successfully!');
            console.log(`- Score: ${latestResult.overall_score}`);
            console.log(`- Summary length: ${latestResult.summary?.length || 0}`);
            console.log(`- Dimensions: ${JSON.stringify(latestResult.dimensions)}`);
        } else {
            console.error('\n❌ AnalysisResult was NOT created.');
        }

        const updatedResume = await Resume.findByPk(resume.id);
        console.log(`\n✅ Resume status: ${updatedResume.status}`);
        console.log(`✅ Resume score: ${updatedResume.score}`);

    } catch (error) {
        console.error('\n❌ Test failed:', error);
    } finally {
        // We don't want to close the connection if we're running in a larger context, 
        // but for a standalone script we should.
        // await sequelize.close();
    }
}

testFix();
