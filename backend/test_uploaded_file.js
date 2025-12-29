const fs = require('fs');
const path = require('path');

async function checkUploadedFile() {
  try {
    const uploadedFilePath = '/Users/yangyong/工作/Projects/SuperResumeMaster/backend/uploads/resumes/test_resume.txt';
    
    if (fs.existsSync(uploadedFilePath)) {
      const fileContent = fs.readFileSync(uploadedFilePath, 'utf-8');
      console.log('上传的文件内容:');
      console.log(fileContent);
      console.log('\n是否包含换行符:', fileContent.includes('\n'));
      console.log('是否包含"教育背景":', fileContent.includes('教育背景'));
      console.log('是否包含"工作经历":', fileContent.includes('工作经历'));
    } else {
      console.log('上传的文件不存在');
    }
  } catch (err) {
    console.error('错误:', err);
  }
}

checkUploadedFile();
