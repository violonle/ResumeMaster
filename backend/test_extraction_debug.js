
const path = require('path');
const { extractTextFromFile } = require('./services/textExtractor');

const filePath = '/Users/yangyong/工作/Projects/SuperResumeMaster/backend/uploads/resumes/__低代码开发工程师_长沙_4-6K_肖彦文_6年.pdf';

(async () => {
  console.log('Testing text extraction for:', filePath);
  try {
    const text = await extractTextFromFile(filePath);
    console.log('Extraction Result Length:', text.length);
    console.log('Extraction Result Preview:', text.substring(0, 500));
    
    if (!text || text.trim().length === 0) {
        console.error('FAILED: No text extracted.');
    } else {
        console.log('SUCCESS: Text extracted.');
    }
  } catch (error) {
    console.error('ERROR:', error);
  }
})();
