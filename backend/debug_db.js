
const { Job, ResumeJob, Resume, sequelize } = require('./models');
const { Op } = require('sequelize');

async function checkData() {
    try {
        console.log('--- Checking Database State ---');
        
        const jobs = await Job.findAll({
            attributes: ['id', 'title', 'status']
        });
        console.log('Jobs found:', jobs.length);
        jobs.forEach(j => console.log(`- [${j.id}] ${j.title} (${j.status})`));

        for (const job of jobs) {
            const relations = await ResumeJob.findAll({
                where: { job_id: job.id },
                include: [{ model: Resume, attributes: ['id', 'candidate_name'] }]
            });
            console.log(`\nJob ID ${job.id} (${job.title}) has ${relations.length} candidates:`);
            relations.forEach(r => {
                console.log(`  - Candidate: ${r.Resume ? r.Resume.candidate_name : 'Unknown'}, Status: ${r.status}`);
            });
        }

    } catch (error) {
        console.error('Error checking data:', error);
    } finally {
        await sequelize.close();
    }
}

checkData();
