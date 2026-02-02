const sequelize = require('./backend/config/db');

async function checkSchema() {
  try {
    const [results] = await sequelize.query('DESCRIBE users');
    console.log('Users table schema:');
    console.table(results);

    const [resumeJobsResults] = await sequelize.query('DESCRIBE resume_jobs');
    console.log('\nResume Jobs table schema:');
    console.table(resumeJobsResults);
  } catch (error) {
    console.error('Error describing tables:', error);
  } finally {
    await sequelize.close();
  }
}

checkSchema();
