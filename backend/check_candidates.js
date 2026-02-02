require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { Resume, ResumeJob, Job } = require('./models');

async function checkCandidates() {
  try {
    const jobs = await Job.findAll();
    console.log('All Jobs:');
    jobs.forEach(j => {
      console.log(`Job ID: ${j.id}, Title: ${j.title}, Company ID: ${j.company_id}`);
    });

    // Check Job 2
    console.log('\nJob 2 (Senior Frontend):');
    const job2 = await Job.findByPk(2);
    if (job2) {
      console.log('Job 2:', job2.title);
      const candidates2 = await ResumeJob.findAll({ where: { job_id: 2 } });
      console.log('Job 2 candidates count:', candidates2.length);
      candidates2.forEach(c => console.log(`- Resume ID: ${c.resume_id}, Status: ${c.status}`));
    } else {
      console.log('Job 2 not found');
    }

    // Check Job 3 (Product Manager)
    const job3 = await Job.findByPk(3);
    console.log('\nJob 3 (Product Manager):', job3 ? job3.title : 'Not found');
    const links3 = await ResumeJob.findAll({ where: { job_id: 3 } });
    console.log('Job 3 candidates count:', links3.length);
    links3.forEach(l => {
      console.log(`- Resume ID: ${l.resume_id}, Status: ${l.status}`);
    });

    // Check Job 4 (Frontend Dev)
    const job4 = await Job.findByPk(4);
    console.log('\nJob 4 (Frontend Dev):', job4 ? job4.title : 'Not found');
    const links4 = await ResumeJob.findAll({ where: { job_id: 4 } });
    console.log('Job 4 candidates count:', links4.length);
    links4.forEach(l => {
      console.log(`- Resume ID: ${l.resume_id}, Status: ${l.status}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkCandidates();
