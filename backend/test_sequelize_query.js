const { Resume } = require('./models');
const sequelize = require('./config/db');

async function testSequelizeQuery() {
  try {
    console.log('=== 使用Sequelize查询简历ID 70 ===');
    
    const resume = await Resume.findByPk(70, {
      attributes: ['id', 'file_name', 'skills', 'parsed_data']
    });
    
    if (resume) {
      console.log('ID:', resume.id);
      console.log('文件名:', resume.file_name);
      console.log('skills字段:', resume.skills);
      console.log('skills类型:', typeof resume.skills);
      console.log('skills是否为数组:', Array.isArray(resume.skills));
      
      if (resume.skills) {
        console.log('skills长度:', resume.skills.length);
        console.log('skills内容:', resume.skills);
      }
      
      console.log('\n=== 完整的resume对象 ===');
      console.log(JSON.stringify(resume.toJSON(), null, 2));
    } else {
      console.log('未找到ID为70的简历');
    }
  } catch (error) {
    console.error('查询失败:', error);
  } finally {
    await sequelize.close();
  }
}

testSequelizeQuery();
