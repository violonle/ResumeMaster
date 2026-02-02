
const { Job, ResumeJob, Resume } = require('./models');
const { Op } = require('sequelize');

async function check() {
  try {
    console.log('--- Checking Jobs ---');
    const jobs = await Job.findAll({
      attributes: ['id', 'title', 'status', 'enable_auto_screening', 'auto_reject_score']
    });
    console.log('Jobs:', JSON.stringify(jobs, null, 2));

    console.log('\n--- Checking ResumeJobs ---');
    const resumeJobs = await ResumeJob.findAll({
      attributes: ['id', 'resume_id', 'job_id', 'status', 'match_score']
    });
    console.log('ResumeJobs:', JSON.stringify(resumeJobs, null, 2));

    console.log('\n--- Checking Resumes (top 10) ---');
    const resumes = await Resume.findAll({
      limit: 10,
      attributes: ['id', 'file_name', 'status', 'recruitment_status', 'score', 'is_talent_pool']
    });
    console.log('Resumes:', JSON.stringify(resumes, null, 2));

    const pendingResumesCount = await Resume.count({
      where: {
        recruitment_status: {
          [Op.in]: ['投递', '待快评', 'applied', 'new']
        }
      }
    });
    console.log('\nTotal Resumes with pending-like recruitment_status:', pendingResumesCount);

  } catch (error) {
    console.error('Error checking DB:', error);
  } finally {
    process.exit();
  }
}

check();
