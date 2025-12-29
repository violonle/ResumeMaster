const { Resume } = require('./models');

async function showDetailedRawText() {
    try {
        const resume = await Resume.findOne({ where: { id: 112 } });
        
        if (!resume) {
            console.error('未找到简历ID 112');
            return;
        }
        
        const lines = resume.raw_text.split('\n');
        
        console.log('=== 原始文本第1-50行 ===');
        lines.slice(0, 50).forEach((line, index) => {
            console.log(`${index + 1}: [${line.length} chars] ${line}`);
        });
        console.log('=== 原始文本结束 ===\n');
        
        console.log('=== 查找包含"个人优势"的行 ===');
        lines.forEach((line, index) => {
            if (line.includes('个人优势')) {
                console.log(`行 ${index + 1}: ${line}`);
            }
        });
        console.log('=== 查找结束 ===\n');
        
        console.log('=== 查找包含"自我评价"的行 ===');
        lines.forEach((line, index) => {
            if (line.includes('自我评价')) {
                console.log(`行 ${index + 1}: ${line}`);
            }
        });
        console.log('=== 查找结束 ===\n');
        
        console.log('=== 查找包含"教育背景"的行 ===');
        lines.forEach((line, index) => {
            if (line.includes('教育背景')) {
                console.log(`行 ${index + 1}: ${line}`);
            }
        });
        console.log('=== 查找结束 ===\n');
        
        console.log('=== 查找包含"工作经历"的行 ===');
        lines.forEach((line, index) => {
            if (line.includes('工作经历')) {
                console.log(`行 ${index + 1}: ${line}`);
            }
        });
        console.log('=== 查找结束 ===\n');
        
    } catch (error) {
        console.error('查询失败:', error);
    }
}

showDetailedRawText();
