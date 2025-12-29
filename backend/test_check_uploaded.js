const fs = require('fs');
const path = require('path');

async function checkUploadedFileContent() {
  try {
    const uploadedFilePath = '/Users/yangyong/工作/Projects/SuperResumeMaster/backend/uploads/resumes/test_resume.txt';
    
    if (fs.existsSync(uploadedFilePath)) {
      const fileContent = fs.readFileSync(uploadedFilePath, 'utf-8');
      console.log('上传的文件内容:');
      console.log(fileContent);
      console.log('\n文件内容长度:', fileContent.length);
      console.log('是否包含换行符:', fileContent.includes('\n'));
      console.log('是否包含"教育背景":', fileContent.includes('教育背景'));
      console.log('是否包含"工作经历":', fileContent.includes('工作经历'));
      
      const { extractTextFromFile } = require('./services/textExtractor');
      const extractedText = await extractTextFromFile(uploadedFilePath);
      console.log('\n提取的文本内容:');
      console.log(extractedText);
      console.log('\n提取的文本长度:', extractedText.length);
      console.log('是否包含换行符:', extractedText.includes('\n'));
      console.log('是否包含"教育背景":', extractedText.includes('教育背景'));
      console.log('是否包含"工作经历":', extractedText.includes('工作经历'));
    } else {
      console.log('上传的文件不存在');
    }
  } catch (err) {
    console.error('错误:', err);
  }
}

checkUploadedFileContent();
