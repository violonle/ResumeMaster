
const { Resume, Job, ResumeJob } = require('./models');
const { Op } = require('sequelize');

async function checkFrontendCandidates() {
    try {
        console.log('[DB] Checking for candidates related to Frontend...');
        
        // Search in resumes table
        const resumes = await Resume.findAll({
            where: {
                [Op.or]: [
                    { job_title: { [Op.like]: '%前端%' } },
                    { name: { [Op.like]: '%前端%' } },
                    { raw_text: { [Op.like]: '%前端%' } }
                ]
            }
        });

        console.log(`Found ${resumes.length} resumes matching "前端"`);
        resumes.forEach(r => {
            console.log(`ID: ${r.id}, Name: ${r.name}, Title: ${r.job_title}, Status: ${r.status}`);
        });

        // Search for Job 2
        const job2 = await Job.findByPk(2);
        if (job2) {
            console.log(`Job 2 Info: ID: ${job2.id}, Title: ${job2.title}`);
        } else {
            console.log('Job 2 not found');
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkFrontendCandidates();
