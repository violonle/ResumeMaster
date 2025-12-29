const { sequelize, Resume } = require('./models');

async function checkResume() {
  try {
    await sequelize.authenticate();
    
    const resume = await Resume.findByPk(70);
    if (resume) {
      console.log('=== 简历ID 70 ===');
      console.log('skills字段:', resume.skills);
      console.log('skills类型:', typeof resume.skills);
      console.log('skills长度:', resume.skills ? resume.skills.length : 0);
      
      console.log('\nparsed_data.skills字段:', resume.parsed_data && resume.parsed_data.skills);
      console.log('parsed_data.skills类型:', typeof (resume.parsed_data && resume.parsed_data.skills));
      console.log('parsed_data.skills长度:', resume.parsed_data && resume.parsed_data.skills ? resume.parsed_data.skills.length : 0);
      
      console.log('\n所有字段:', Object.keys(resume.dataValues));
    } else {
      console.log('未找到ID为70的简历');
    }
    
    await sequelize.close();
  } catch (err) {
    console.error('查询失败:', err);
  }
}

checkResume();