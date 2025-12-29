const { sequelize } = require('./models');

async function checkFullRawText() {
    try {
        console.log('检查简历ID 70的完整raw_text内容...');

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

        console.log('\n=== 完整raw_text内容 ===');
        console.log(resume.raw_text);

    } catch (error) {
        console.error('检查raw_text失败:', error);
    } finally {
        await sequelize.close();
    }
}

checkFullRawText();
