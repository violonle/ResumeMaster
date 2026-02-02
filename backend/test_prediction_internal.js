
const { User, Job, ResumeJob, sequelize } = require('./models');
const { Op } = require('sequelize');
const DomesticAIService = require('./services/domesticAIService');
const aiService = new DomesticAIService();

async function testPrediction() {
    try {
        console.log('--- Starting Prediction Test ---');
        
        // 1. Get a user
        const user = await User.findOne({ where: { username: 'masteradmin' } });
        if (!user) {
            console.error('Master admin user not found');
            return;
        }
        console.log(`User: ${user.username}, ID: ${user.id}`);

        // 2. Prepare context data (simulating routes/dashboard.js)
        const userId = user.id;
        const companyId = user.company_id;

        const userJobs = await Job.findAll({
            where: companyId ? { company_id: companyId } : { user_id: userId },
            attributes: ['id', 'title', 'department', 'status', 'created_at']
        });
        const jobIds = userJobs.map(j => j.id);

        let pipelineStats = {
            total_candidates: 0,
            status_distribution: {},
            recent_activities: []
        };

        if (jobIds.length > 0) {
            const pipeline = await ResumeJob.findAll({
                where: { job_id: { [Op.in]: jobIds } },
                attributes: ['status', 'applied_at', 'updated_at'],
                order: [['updated_at', 'DESC']]
            });
            pipelineStats.total_candidates = pipeline.length;
            pipeline.forEach(p => {
                pipelineStats.status_distribution[p.status] = (pipelineStats.status_distribution[p.status] || 0) + 1;
            });
            pipelineStats.recent_activities = pipeline.slice(0, 10).map(p => ({
                status: p.status,
                time: p.updated_at
            }));
        }

        const contextData = {
            period: '7d',
            active_jobs_count: userJobs.filter(j => j.status === 'active').length,
            jobs_sample: userJobs.slice(0, 5).map(j => j.title),
            pipeline_stats: pipelineStats
        };

        const userCtx = { 
            id: user.id, 
            company_id: user.company_id,
            role: user.role 
        };

        console.log('Context Data:', JSON.stringify(contextData, null, 2));

        // 3. Call AI Service
        console.log('Calling AI Service...');
        const result = await aiService.generateRecruitmentForecast(contextData, userCtx);
        
        console.log('AI Result:', JSON.stringify(result, null, 2));
        
    } catch (error) {
        console.error('Test Failed:', error);
    } finally {
        await sequelize.close();
        process.exit();
    }
}

testPrediction();
