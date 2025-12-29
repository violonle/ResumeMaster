const { Resume } = require('./models');

async function showRawText() {
    try {
        const resume = await Resume.findOne({ where: { id: 112 } });
        
        if (!resume) {
            console.error('未找到简历ID 112');
            return;
        }
        
        const lines = resume.raw_text.split('\n');
        
        console.log('=== 原始文本第1-30行 ===');
        lines.slice(0, 30).forEach((line, index) => {
            console.log(`${index + 1}: ${line}`);
        });
        console.log('=== 原始文本结束 ===\n');
        
    } catch (error) {
        console.error('查询失败:', error);
    }
}

showRawText();
