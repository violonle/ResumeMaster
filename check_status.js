const { Job, Resume, ResumeJob, SystemConfig } = require('./backend/models');
const { Op } = require('sequelize');

async function checkData() {
  try {
    const jobCount = await Job.count();
    const resumeCount = await Resume.count();
    const resumeJobCount = await ResumeJob.count();
    console.log('--- Database Statistics ---');
    console.log('Total Jobs:', jobCount);
    console.log('Total Resumes:', resumeCount);
    console.log('Total Resume-Job Associations:', resumeJobCount);

    if (jobCount > 0) {
      const jobs = await Job.findAll({ limit: 5 });
      console.log('\n--- Sample Jobs ---');
      jobs.forEach(j => console.log(`ID: ${j.id}, Title: ${j.title}, UserID: ${j.user_id}, CompanyID: ${j.company_id}`));
    }

    const smsConfig = await SystemConfig.findOne({ where: { key: 'sms' } });
    console.log('\n--- SMS Config ---');
    if (smsConfig) {
      console.log('SMS Config Value:', smsConfig.value);
    } else {
      console.log('SMS Config not found in SystemConfig table.');
      // Check for individual sms keys
      const keys = ['sms.provider', 'sms.accessKeyId', 'sms.accessKeySecret', 'sms.signName', 'sms.enabled', 'sms.interview.templateCode'];
      const rows = await SystemConfig.findAll({ where: { key: { [Op.in]: keys } } });
      if (rows.length > 0) {
        rows.forEach(r => console.log(`${r.key}: ${r.value}`));
      } else {
        console.log('No individual SMS config keys found.');
      }
    }

    // Check for candidates for a specific job (e.g. jobId=8)
    const testJobId = 8;
    const candidates = await ResumeJob.findAll({
      where: { job_id: testJobId },
      include: [{ model: Resume }]
    });
    console.log(`\n--- Candidates for Job ID ${testJobId} ---`);
    console.log(`Count: ${candidates.length}`);
    candidates.forEach(c => {
      console.log(`Resume ID: ${c.resume_id}, Name: ${c.Resume?.name || c.Resume?.file_name}`);
    });

  } catch (err) {
    console.error('Error checking data:', err);
  } finally {
    process.exit();
  }
}

checkData();
