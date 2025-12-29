const { sequelize } = require('./models');

async function testPatternMatching() {
    try {
        console.log('测试工作经历提取模式匹配...');

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

        console.log('=== 测试模式1: /([^\d]+?)\s*(\d{4})\.(\d{2})[-–](\d{4})\.(\d{2})\s*/i ===');
        const pattern1 = /([^\d]+?)\s*(\d{4})\.(\d{2})[-–](\d{4})\.(\d{2})\s*/i;
        let match;
        let count = 0;
        while ((match = pattern1.exec(content)) !== null) {
            count++;
            console.log(`匹配${count}:`);
            console.log(`  公司和职位: "${match[1].trim()}"`);
            console.log(`  开始日期: ${match[2]}.${match[3]}`);
            console.log(`  结束日期: ${match[4]}.${match[5]}`);
            console.log(`  完整匹配: "${match[0]}"`);
            console.log();
        }
        console.log(`模式1共匹配${count}次\n`);

        console.log('=== 测试模式2: /([^\d]+?)\s*(\d{4})\.(\d{2})[-–](\d{4}|至今|Present|Now)\s*/i ===');
        const pattern2 = /([^\d]+?)\s*(\d{4})\.(\d{2})[-–](\d{4}|至今|Present|Now)\s*/i;
        count = 0;
        while ((match = pattern2.exec(content)) !== null) {
            count++;
            console.log(`匹配${count}:`);
            console.log(`  公司和职位: "${match[1].trim()}"`);
            console.log(`  开始日期: ${match[2]}.${match[3]}`);
            console.log(`  结束日期: ${match[4]}`);
            console.log(`  完整匹配: "${match[0]}"`);
            console.log();
        }
        console.log(`模式2共匹配${count}次\n`);

        console.log('=== 测试模式3: /([^\d]+?)\s*(\d{4})\s*[-–年至]+\s*(\d{4}|至今|Present|Now)\s*/i ===');
        const pattern3 = /([^\d]+?)\s*(\d{4})\s*[-–年至]+\s*(\d{4}|至今|Present|Now)\s*/i;
        count = 0;
        while ((match = pattern3.exec(content)) !== null) {
            count++;
            console.log(`匹配${count}:`);
            console.log(`  公司和职位: "${match[1].trim()}"`);
            console.log(`  开始日期: ${match[2]}`);
            console.log(`  结束日期: ${match[3]}`);
            console.log(`  完整匹配: "${match[0]}"`);
            console.log();
        }
        console.log(`模式3共匹配${count}次\n`);

        console.log('=== 测试简单模式: /([^\d]+?)\s*(\d{4}\.\d{2}[-–]\d{4}\.\d{2})/ ===');
        const simplePattern = /([^\d]+?)\s*(\d{4}\.\d{2}[-–]\d{4}\.\d{2})/;
        count = 0;
        while ((match = simplePattern.exec(content)) !== null) {
            count++;
            console.log(`匹配${count}:`);
            console.log(`  公司和职位: "${match[1].trim()}"`);
            console.log(`  日期: ${match[2]}`);
            console.log(`  完整匹配: "${match[0]}"`);
            console.log();
        }
        console.log(`简单模式共匹配${count}次\n`);

    } catch (error) {
        console.error('测试模式匹配失败:', error);
    } finally {
        await sequelize.close();
    }
}

testPatternMatching();
