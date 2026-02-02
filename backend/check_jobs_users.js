const { Job, User } = require('./models');
const sequelize = require('./config/db');

async function checkJobs() {
  try {
    await sequelize.authenticate();
    const jobs = await Job.findAll({
      include: [{ model: User, attributes: ['username'] }]
    });
    console.log(`Found ${jobs.length} jobs:`);
    jobs.forEach(j => {
      console.log(`- ID: ${j.id}, Title: ${j.title}, User: ${j.User ? j.User.username : 'Unknown'}, UserID: ${j.user_id}, CompanyID: ${j.company_id}`);
    });
    
    const users = await User.findAll();
    console.log(`\nFound ${users.length} users:`);
    users.forEach(u => {
      console.log(`- ID: ${u.id}, Username: ${u.username}, CompanyID: ${u.company_id}`);
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sequelize.close();
  }
}

checkJobs();
