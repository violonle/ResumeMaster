
const { Resume, ResumeJob, Job } = require('./models');

async function checkCandidatesData() {
    try {
        const jobs = await Job.findAll({
            where: { id: [2, 3] }
        });
        
        console.log('--- Jobs ---');
        jobs.forEach(j => console.log(`Job ID: ${j.id}, Title: ${j.title}, CompanyID: ${j.company_id}, UserID: ${j.user_id}`));
        
        const candidates = await ResumeJob.findAll({
            where: { job_id: [2, 3] },
            include: [{ model: Resume }]
        });
        
        console.log('\n--- Candidates ---');
        candidates.forEach(c => {
            console.log(`Resume ID: ${c.resume_id}, Job ID: ${c.job_id}, Status: ${c.status}`);
            if (c.Resume) {
                console.log(`  Resume Name: ${c.Resume.name}, CompanyID: ${c.Resume.company_id}, UserID: ${c.Resume.user_id}`);
                console.log(`  Phone: ${c.Resume.phone}, Email: ${c.Resume.email}`);
            } else {
                console.log('  Resume not found for this association!');
            }
        });
    } catch (err) {
        console.error(err);
    }
}

checkCandidatesData();
