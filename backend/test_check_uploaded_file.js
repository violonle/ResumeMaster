const { Resume } = require('./models');

async function checkUploadedFile() {
  try {
    await require('./config/db').sync();

    const resume = await Resume.findOne({
      where: {
        id: 88
      }
    });

    if (resume) {
      console.log('简历ID:', resume.id);
      console.log('文件名:', resume.file_name);
      console.log('文件路径:', resume.file_path);
      console.log('文件类型:', resume.file_type);
      console.log('文件大小:', resume.file_size);

      const fs = require('fs');
      if (fs.existsSync(resume.file_path)) {
        console.log('文件存在: 是');
        const fileContent = fs.readFileSync(resume.file_path, 'utf-8');
        console.log('文件内容长度:', fileContent.length);
        console.log('文件内容是否包含换行符:', fileContent.includes('\n'));
        console.log('文件内容是否包含"教育背景":', fileContent.includes('教育背景'));
        console.log('文件内容是否包含"工作经历":', fileContent.includes('工作经历'));
        console.log('\n文件内容前100字符:');
        console.log(fileContent.substring(0, 100));
      } else {
        console.log('文件存在: 否');
      }
    } else {
      console.log('未找到ID为88的简历');
    }
  } catch (err) {
    console.error('错误:', err);
  } finally {
    process.exit(0);
  }
}

checkUploadedFile();
