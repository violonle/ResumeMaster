const fs = require('fs');
const path = require('path');
const { sequelize, Resume } = require('./models/index');

async function checkResumeContent() {
    try {
        await sequelize.authenticate();
        console.log('数据库连接成功');
        
        const resume = await Resume.findByPk(94);
        if (!resume) {
            console.log('未找到ID为94的简历');
            return;
        }
        
        console.log('=== 简历原始内容 ===');
        const content = resume.raw_text;
        if (!content) {
            console.log('原始内容为空');
            return;
        }
        
        console.log('原始内容长度:', content.length);
        console.log('\n=== 完整原始内容 ===');
        console.log(content);
        
        await sequelize.close();
    } catch (error) {
        console.error('错误:', error);
    }
}

checkResumeContent();