const { sequelize } = require('./models');

async function analyzeRawTextFormat() {
    try {
        console.log('分析raw_text格式...');

        const [results] = await sequelize.query(`
            SELECT id, file_name, raw_text
            FROM resumes
            WHERE id = 70
        `);

        if (results.length === 0) {
            console.log('未找到ID为70的简历');
            return;
        }

        const resume = results[0];
        const content = resume.raw_text;

        console.log('=== 查找所有包含"有限公司"的文本片段 ===');
        const companyPattern = /([^\n]{0,200}有限公司[^\n]{0,50})/g;
        let match;
        let count = 0;
        while ((match = companyPattern.exec(content)) !== null && count < 10) {
            count++;
            console.log(`片段${count}: ${match[1]}`);
            console.log();
        }

        console.log('\n=== 查找所有包含日期的文本片段 ===');
        const datePattern = /([^\n]{0,100}\d{4}\.\d{2}[-–]\d{4}\.\d{2}[^\n]{0,50})/g;
        count = 0;
        while ((match = datePattern.exec(content)) !== null && count < 10) {
            count++;
            console.log(`片段${count}: ${match[1]}`);
            console.log();
        }

        console.log('\n=== 查找所有包含"至今"的文本片段 ===');
        const todayPattern = /([^\n]{0,100}\d{4}\.\d{2}[-–]至今[^\n]{0,50})/g;
        count = 0;
        while ((match = todayPattern.exec(content)) !== null && count < 10) {
            count++;
            console.log(`片段${count}: ${match[1]}`);
            console.log();
        }

    } catch (error) {
        console.error('分析raw_text格式失败:', error);
    } finally {
        await sequelize.close();
    }
}

analyzeRawTextFormat();
