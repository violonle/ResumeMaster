
const axios = require('axios');
const { User, Company, Job, ResumeJob, Resume, sequelize } = require('./backend/models');
const DomesticAIService = require('./backend/services/domesticAIService');
const aiService = new DomesticAIService();
const { Op } = require('sequelize');

async function testPrediction() {
    try {
        console.log('--- Starting AI Prediction Test ---');
        
        // 1. Get a test user
        const user = await User.findOne({ where: { username: 'admin' } }) || await User.findOne();
        if (!user) {
            console.error('No user found in database');
            return;
        }
        console.log(`Using user: ${user.username} (ID: ${user.id})`);

        const userId = user.id;
        const companyId = user.company_id;

        // 2. Prepare context data (same logic as in dashboard.js route)
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

        // 3. Call AI Service directly
        console.log('Calling AI Service...');
        const startTime = Date.now();
        const aiResult = await aiService.generateRecruitmentForecast(contextData, userCtx);
        const duration = Date.now() - startTime;

        console.log(`AI Result (Success: ${aiResult.success}, Duration: ${duration}ms):`);
        console.log(JSON.stringify(aiResult, null, 2));

        if (aiResult.success) {
            console.log('✅ AI Prediction working correctly!');
        } else {
            console.log('❌ AI Prediction failed!');
            console.log('Error:', aiResult.error);
        }

    } catch (error) {
        console.error('Test failed with error:', error);
    } finally {
        await sequelize.close();
    }
}

testPrediction();
