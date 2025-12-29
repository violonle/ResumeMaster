const { sequelize, Resume } = require('./models/index');

async function checkEducationSection() {
    try {
        await sequelize.authenticate();
        console.log('数据库连接成功');
        
        const resume = await Resume.findByPk(94);
        if (!resume) {
            console.log('未找到ID为94的简历');
            return;
        }
        
        const content = resume.raw_text;
        
        console.log('=== 查找教育经历部分 ===');
        const educationIndex = content.indexOf('教育经历');
        console.log('教育经历位置:', educationIndex);
        
        if (educationIndex >= 0) {
            const educationSection = content.substring(educationIndex, educationIndex + 500);
            console.log('\n教育经历部分内容:');
            console.log(educationSection);
        }
        
        await sequelize.close();
    } catch (error) {
        console.error('错误:', error);
    }
}

checkEducationSection();