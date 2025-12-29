const { sequelize } = require('./models');

async function testCompanyPattern() {
    try {
        console.log('测试公司名称提取模式...');

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

        console.log('=== 测试模式: /([^\d\n]{2,30}(?:有限公司|网络科技有限公司|信息技术有限公司|健康产业有限公司|电子商务有限公司|科技有限公司))\s*([^0-9\n]{2,20})\s*(\d{4}\.\d{2}[-–]\d{4}\.\d{2})/ ===');
        const pattern = /([^\d\n]{2,30}(?:有限公司|网络科技有限公司|信息技术有限公司|健康产业有限公司|电子商务有限公司|科技有限公司))\s*([^0-9\n]{2,20})\s*(\d{4}\.\d{2}[-–]\d{4}\.\d{2})/;
        let match;
        let count = 0;
        while ((match = pattern.exec(content)) !== null && count < 10) {
            count++;
            console.log(`匹配${count}:`);
            console.log(`  公司: "${match[1].trim()}"`);
            console.log(`  职位: "${match[2].trim()}"`);
            console.log(`  日期: ${match[3]}`);
            console.log();
        }
        console.log(`共找到${count}个匹配\n`);

        console.log('=== 测试模式: /([^\d\n]{2,30}(?:有限公司|网络科技有限公司|信息技术有限公司|健康产业有限公司|电子商务有限公司|科技有限公司))\s*([^0-9\n]{2,20})\s*(\d{4}\.\d{2}[-–]至今)/ ===');
        const pattern2 = /([^\d\n]{2,30}(?:有限公司|网络科技有限公司|信息技术有限公司|健康产业有限公司|电子商务有限公司|科技有限公司))\s*([^0-9\n]{2,20})\s*(\d{4}\.\d{2}[-–]至今)/;
        count = 0;
        while ((match = pattern2.exec(content)) !== null && count < 10) {
            count++;
            console.log(`匹配${count}:`);
            console.log(`  公司: "${match[1].trim()}"`);
            console.log(`  职位: "${match[2].trim()}"`);
            console.log(`  日期: ${match[3]}`);
            console.log();
        }
        console.log(`共找到${count}个匹配\n`);

    } catch (error) {
        console.error('测试模式匹配失败:', error);
    } finally {
        await sequelize.close();
    }
}

testCompanyPattern();
