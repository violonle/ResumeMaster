const { sequelize } = require('./models');

async function checkResume() {
  try {
    const Resume = sequelize.models.Resume;
    const resume = await Resume.findByPk(10);
    if (resume) {
      console.log('Resume 10 found:', resume.toJSON());
    } else {
      console.log('Resume 10 not found');
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

checkResume();
