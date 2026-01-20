const { Sequelize } = require('sequelize');
const path = require('path');

// Initialize Sequelize with SQLite
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'database.sqlite'),
  logging: false
});

async function checkColumns() {
  try {
    const [jobColumns] = await sequelize.query("PRAGMA table_info(jobs)");
    console.log("Job Columns:", jobColumns.map(c => c.name));

    const [resumeColumns] = await sequelize.query("PRAGMA table_info(resumes)");
    console.log("Resume Columns:", resumeColumns.map(c => c.name));
    
  } catch (error) {
    console.error("Error checking columns:", error);
  }
}

checkColumns();
