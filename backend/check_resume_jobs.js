const { Job, Resume, ResumeJob, User } = require('./models');
const sequelize = require('./config/db');

async function checkResumeJobs() {
  try {
    await sequelize.authenticate();
    const rjs = await ResumeJob.findAll({
      include: [
        { model: Job, attributes: ['id', 'title'] },
        { model: Resume, attributes: ['id', 'name', 'file_name'] }
      ]
    });
    console.log(`Found ${rjs.length} resume-job associations:`);
    rjs.forEach(rj => {
      console.log(`- RJ ID: ${rj.id}, Job: ${rj.Job ? rj.Job.title : 'None'} (ID: ${rj.job_id}), Resume: ${rj.Resume ? (rj.Resume.name || rj.Resume.file_name) : 'None'} (ID: ${rj.resume_id})`);
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sequelize.close();
  }
}

checkResumeJobs();
