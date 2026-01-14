const { Resume } = require('./backend/models');

async function checkResumeText() {
  try {
    const resume = await Resume.findByPk(18);
    if (!resume) {
      console.log('Resume 18 not found');
      return;
    }
    console.log('Raw Text excerpt:', resume.raw_text?.substring(0, 500));
    console.log('Parsed Data Basic Info:', JSON.stringify(resume.parsed_data?.basic_info || resume.parsed_data, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

checkResumeText();
