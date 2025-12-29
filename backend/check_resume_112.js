const { sequelize } = require('./models');
const Resume = require('./models').Resume;

async function checkResume() {
  try {
    const resume = await Resume.findByPk(112);
    if (resume) {
      console.log('简历ID 112的数据:');
      console.log('姓名:', resume.name);
      console.log('邮箱:', resume.email);
      console.log('电话:', resume.phone);
      console.log('职位:', resume.job_title);
      console.log('工作经历数量:', Array.isArray(resume.work_experience) ? resume.work_experience.length : 0);
      console.log('教育经历数量:', Array.isArray(resume.education) ? resume.education.length : 0);
      console.log('技能数量:', Array.isArray(resume.skills) ? resume.skills.length : 0);
      console.log('项目数量:', Array.isArray(resume.projects) ? resume.projects.length : 0);
      console.log('个人优势长度:', resume.summary ? resume.summary.length : 0);
      console.log('原始文本长度:', resume.raw_text ? resume.raw_text.length : 0);
      
      console.log('\n个人优势内容:');
      console.log(resume.summary ? resume.summary.substring(0, 500) : '无');
      
      console.log('\n工作经历:');
      if (Array.isArray(resume.work_experience)) {
        resume.work_experience.forEach((exp, idx) => {
          console.log(`  ${idx + 1}. ${exp.company} - ${exp.position} (${exp.startDate} - ${exp.endDate})`);
        });
      }
      
      console.log('\n教育经历:');
      if (Array.isArray(resume.education)) {
        resume.education.forEach((edu, idx) => {
          console.log(`  ${idx + 1}. ${edu.school} - ${edu.major} (${edu.startDate} - ${edu.endDate})`);
        });
      }
      
      console.log('\n技能:');
      if (Array.isArray(resume.skills)) {
        console.log(resume.skills.join(', '));
      }
      
      console.log('\n项目:');
      if (Array.isArray(resume.projects)) {
        resume.projects.forEach((proj, idx) => {
          console.log(`  ${idx + 1}. ${proj.name} (${proj.startDate} - ${proj.endDate})`);
        });
      }
    } else {
      console.log('未找到简历ID 112');
    }
  } catch (error) {
    console.error('查询失败:', error.message);
  } finally {
    await sequelize.close();
  }
}

checkResume();
