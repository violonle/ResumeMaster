
const { Job, ResumeJob, Resume, sequelize } = require('./models');
const { Op } = require('sequelize');


async function check() {
    console.log('--- DB Check Start ---');
    try {
        const jobs = await Job.findAll();
        console.log(`Jobs found: ${jobs.length}`);
        
        const rjs = await ResumeJob.findAll();
        console.log(`ResumeJobs found: ${rjs.length}`);


        jobs.forEach(j => {
            const count = rjs.filter(rj => rj.job_id === j.id).length;
            console.log(`- Job [${j.id}] ${j.title}: ${count} candidates (User: ${j.user_id}, Company: ${j.company_id})`);
        });

        const frontendJob = jobs.find(j => j.title.includes('前端开发'));
        if (frontendJob) {
            const frontendRJs = rjs.filter(rj => rj.job_id === frontendJob.id);
            for (const rj of frontendRJs) {
                const resume = await Resume.findByPk(rj.resume_id);
                console.log(`  - Resume ID: ${rj.resume_id}, Name: ${resume ? resume.name : 'Unknown'}, Status: ${rj.status} (User: ${rj.user_id})`);
            }
        }


    } catch (e) {
        console.error('Error during check:', e);
    } finally {
        await sequelize.close();
        console.log('--- DB Check End ---');
    }
}

check();
