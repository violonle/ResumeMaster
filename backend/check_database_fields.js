const { sequelize } = require('./models');
const Resume = require('./models').Resume;

async function checkDatabaseFields() {
  try {
    const resume = await Resume.findByPk(112);
    if (resume) {
      console.log('简历ID 112的数据库字段:');
      console.log('work_experience类型:', typeof resume.work_experience);
      console.log('work_experience值:', resume.work_experience);
      console.log('work_experience是否为数组:', Array.isArray(resume.work_experience));
      
      console.log('\neducation类型:', typeof resume.education);
      console.log('education值:', resume.education);
      console.log('education是否为数组:', Array.isArray(resume.education));
      
      console.log('\nskills类型:', typeof resume.skills);
      console.log('skills值:', resume.skills);
      console.log('skills是否为数组:', Array.isArray(resume.skills));
      
      console.log('\nprojects类型:', typeof resume.projects);
      console.log('projects值:', resume.projects);
      console.log('projects是否为数组:', Array.isArray(resume.projects));
      
      console.log('\nsummary类型:', typeof resume.summary);
      console.log('summary值:', resume.summary);
      
      console.log('\nparsed_data:', JSON.stringify(resume.parsed_data, null, 2));
    } else {
      console.log('未找到简历ID 112');
    }
  } catch (error) {
    console.error('查询失败:', error.message);
  } finally {
    await sequelize.close();
  }
}

checkDatabaseFields();
