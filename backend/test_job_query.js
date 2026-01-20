const { Job, Resume } = require('./models');
const sequelize = require('./config/db');

async function testQuery() {
  try {
    await sequelize.authenticate();
    console.log('Connection has been established successfully.');
    
    // Test Job Query
    const job = await Job.findOne();
    console.log('Job found:', job ? job.toJSON() : 'None');

    // Test Resume Query
    const resume = await Resume.findOne();
    console.log('Resume found:', resume ? resume.toJSON() : 'None');

  } catch (error) {
    console.error('Unable to connect to the database or query failed:', error);
  } finally {
    await sequelize.close();
  }
}

testQuery();
