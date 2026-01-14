const { Resume } = require('./backend/models');

async function checkResume() {
  try {
    const resume = await Resume.findByPk(18);
    if (!resume) {
      console.log('Resume 18 not found');
      return;
    }
    console.log('ID:', resume.id);
    console.log('Name:', resume.name);
    console.log('Phone:', resume.phone);
    console.log('Email:', resume.email);
    console.log('Parsed Data Phone:', resume.parsed_data?.phone);
    console.log('Parsed Data Basic Info Phone:', resume.parsed_data?.basic_info?.phone);
    console.log('Recruitment Status:', resume.recruitment_status);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

checkResume();
