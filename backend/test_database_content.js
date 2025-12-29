const { Resume } = require('./models');
const { Op } = require('sequelize');

async function checkDatabaseContent() {
  try {
    const resume = await Resume.findOne({
      where: {
        id: 88
      },
      order: [['upload_date', 'DESC']]
    });
    
    if (resume) {
      console.log('简历ID:', resume.id);
      console.log('文件名:', resume.file_name);
      console.log('\nraw_text是否包含换行符:', resume.raw_text ? resume.raw_text.includes('\n') : false);
      console.log('raw_text是否包含"教育背景":', resume.raw_text ? resume.raw_text.includes('教育背景') : false);
      console.log('raw_text是否包含"工作经历":', resume.raw_text ? resume.raw_text.includes('工作经历') : false);
      console.log('\nraw_text内容:');
      console.log(resume.raw_text);
      
      console.log('\n\nparsed_data.rawText是否包含换行符:', resume.parsed_data?.rawText ? resume.parsed_data.rawText.includes('\n') : false);
      console.log('parsed_data.rawText是否包含"教育背景":', resume.parsed_data?.rawText ? resume.parsed_data.rawText.includes('教育背景') : false);
      console.log('parsed_data.rawText是否包含"工作经历":', resume.parsed_data?.rawText ? resume.parsed_data.rawText.includes('工作经历') : false);
      console.log('\nparsed_data.rawText内容:');
      console.log(resume.parsed_data?.rawText);
      
      console.log('\n\nwork_experience数量:', resume.work_experience ? resume.work_experience.length : 0);
      console.log('education数量:', resume.education ? resume.education.length : 0);
      
      if (resume.work_experience && resume.work_experience.length > 0) {
        console.log('\nwork_experience内容:');
        console.log(JSON.stringify(resume.work_experience, null, 2));
      }
      
      if (resume.education && resume.education.length > 0) {
        console.log('\neducation内容:');
        console.log(JSON.stringify(resume.education, null, 2));
      }
    } else {
      console.log('未找到简历');
    }
  } catch (err) {
    console.error('错误:', err);
  }
}

checkDatabaseContent();
