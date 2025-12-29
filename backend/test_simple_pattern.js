const { sequelize } = require('./models');

async function testSimplePattern() {
    try {
        console.log('测试简单的工作经历提取模式...');

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

        console.log('=== 查找包含"公司"和日期的行 ===');
        const lines = content.split('\n');
        lines.forEach((line, i) => {
            if (line.includes('公司') && line.match(/\d{4}\.\d{2}/)) {
                console.log(`行${i}: ${line.substring(0, 200)}`);
            }
        });

        console.log('\n=== 测试模式: /([^\d\n]+公司[^\d\n]*?)\s*(\d{4}\.\d{2}[-–]\d{4}\.\d{2})/ ===');
        const pattern = /([^\d\n]+公司[^\d\n]*?)\s*(\d{4}\.\d{2}[-–]\d{4}\.\d{2})/;
        let match;
        let count = 0;
        while ((match = pattern.exec(content)) !== null && count < 10) {
            count++;
            console.log(`匹配${count}:`);
            console.log(`  公司和职位: "${match[1].trim()}"`);
            console.log(`  日期: ${match[2]}`);
            console.log();
        }
        console.log(`共找到${count}个匹配\n`);

        console.log('=== 测试模式: /([^\d\n]+公司[^\d\n]*?)\s*(\d{4}\.\d{2}[-–]至今)/ ===');
        const pattern2 = /([^\d\n]+公司[^\d\n]*?)\s*(\d{4}\.\d{2}[-–]至今)/;
        count = 0;
        while ((match = pattern2.exec(content)) !== null && count < 10) {
            count++;
            console.log(`匹配${count}:`);
            console.log(`  公司和职位: "${match[1].trim()}"`);
            console.log(`  日期: ${match[2]}`);
            console.log();
        }
        console.log(`共找到${count}个匹配\n`);

    } catch (error) {
        console.error('测试模式匹配失败:', error);
    } finally {
        await sequelize.close();
    }
}

testSimplePattern();
