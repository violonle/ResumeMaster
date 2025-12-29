const { sequelize } = require('./models');

async function checkRawText() {
    try {
        console.log('检查简历ID 70的raw_text内容...');

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
        console.log('简历信息:');
        console.log('ID:', resume.id);
        console.log('文件名:', resume.file_name);

        if (!resume.raw_text) {
            console.log('简历没有raw_text字段');
            return;
        }

        console.log('\n=== raw_text内容 (前1000字符) ===');
        console.log(resume.raw_text.substring(0, 1000));

        console.log('\n=== raw_text内容 (1000-2000字符) ===');
        console.log(resume.raw_text.substring(1000, 2000));

        console.log('\n=== raw_text内容 (2000-3000字符) ===');
        console.log(resume.raw_text.substring(2000, 3000));

        console.log('\n=== raw_text内容 (3000-4000字符) ===');
        console.log(resume.raw_text.substring(3000, 4000));

        console.log('\n=== raw_text总长度 ===');
        console.log(resume.raw_text.length);

        console.log('\n=== 检查是否包含工作经历相关关键词 ===');
        const keywords = ['工作经历', '工作经验', '以往工作', '工作背景', '烟台贰伍叁网络科技有限公司', '山东享用宝信息技术有限公司'];
        keywords.forEach(keyword => {
            const count = (resume.raw_text.match(new RegExp(keyword, 'g')) || []).length;
            console.log(`${keyword}: ${count}次`);
        });

        console.log('\n=== 检查日期格式 ===');
        const datePattern = /\d{4}\.\d{2}/g;
        const dates = resume.raw_text.match(datePattern) || [];
        console.log(`找到${dates.length}个日期格式: ${dates.slice(0, 10).join(', ')}`);

    } catch (error) {
        console.error('检查raw_text失败:', error);
    } finally {
        await sequelize.close();
    }
}

checkRawText();
