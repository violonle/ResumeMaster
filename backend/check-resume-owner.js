const { sequelize } = require('./models');

async function checkResumeOwner() {
  try {
    const Resume = sequelize.models.Resume;
    const resume = await Resume.findByPk(10);
    if (resume) {
      console.log('Resume 10 UserID:', resume.user_id);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

checkResumeOwner();
