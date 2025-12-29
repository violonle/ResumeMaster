const { Resume } = require('./models');

async function checkDatabaseStorage() {
  try {
    console.log('=== 检查数据库存储 ===\n');
    
    const resume = await Resume.findOne({
      where: {
        id: 90
      }
    });
    
    if (resume) {
      console.log('简历ID:', resume.id);
      console.log('文件名:', resume.file_name);
      console.log('\nraw_text字段:');
      console.log('是否包含换行符:', resume.raw_text ? resume.raw_text.includes('\n') : false);
      console.log('是否包含"教育背景":', resume.raw_text ? resume.raw_text.includes('教育背景') : false);
      console.log('是否包含"工作经历":', resume.raw_text ? resume.raw_text.includes('工作经历') : false);
      console.log('\nraw_text内容:');
      console.log(resume.raw_text);
      
      console.log('\n\nparsed_data.rawText字段:');
      console.log('是否包含换行符:', resume.parsed_data?.rawText ? resume.parsed_data.rawText.includes('\n') : false);
      console.log('是否包含"教育背景":', resume.parsed_data?.rawText ? resume.parsed_data.rawText.includes('教育背景') : false);
      console.log('是否包含"工作经历":', resume.parsed_data?.rawText ? resume.parsed_data.rawText.includes('工作经历') : false);
      console.log('\nparsed_data.rawText内容:');
      console.log(resume.parsed_data?.rawText);
      
      console.log('\n\n工作经历:');
      console.log(JSON.stringify(resume.work_experience, null, 2));
      
      console.log('\n\n教育背景:');
      console.log(JSON.stringify(resume.education, null, 2));
    } else {
      console.log('未找到简历');
    }
  } catch (err) {
    console.error('错误:', err);
  }
}

checkDatabaseStorage();