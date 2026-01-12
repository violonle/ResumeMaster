const { Resume } = require('../backend/models');
const logger = require('../backend/utils/logger');

async function checkResumes() {
  try {
    const resumes = await Resume.findAll({ limit: 5 });
    if (resumes.length === 0) {
      console.log('No resumes found in the database.');
    } else {
      console.log(`Found ${resumes.length} resumes:`);
      resumes.forEach(r => {
        console.log(`ID: ${r.id}, File: ${r.file_name}, Status: ${r.status}`);
      });
    }
    process.exit(0);
  } catch (error) {
    console.error('Error querying resumes:', error);
    process.exit(1);
  }
}

checkResumes();
