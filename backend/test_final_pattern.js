const { sequelize } = require('./models');

async function testFinalPattern() {
    try {
        console.log('测试最终的工作经历提取模式...');

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

        console.log('=== 测试模式1: /([^\\d\\n]{2,30}(?:有限公司|网络科技有限公司|信息技术有限公司|健康产业有限公司|电子商务有限公司|科技有限公司|健康产业有限公司|生物科技有限公司|网络科技有限公司))\\s+([^0-9\\n]{2,20})\\s*(\\d{4}\\.\\d{2}[-–]\\d{4}\\.\\d{2})/gi ===');
        const pattern1 = /([^\d\n]{2,30}(?:有限公司|网络科技有限公司|信息技术有限公司|健康产业有限公司|电子商务有限公司|科技有限公司|健康产业有限公司|生物科技有限公司|网络科技有限公司))\s+([^0-9\n]{2,20})\s*(\d{4}\.\d{2}[-–]\d{4}\.\d{2})/gi;
        let match;
        let count = 0;
        while ((match = pattern1.exec(content)) !== null && count < 10) {
            count++;
            console.log(`匹配${count}:`);
            console.log(`  公司: "${match[1].trim()}"`);
            console.log(`  职位: "${match[2].trim()}"`);
            console.log(`  日期: ${match[3].trim()}`);
            console.log();
        }
        console.log(`模式1共匹配${count}次\n`);

        console.log('=== 测试模式2: /([^\\d\\n]{2,30}(?:有限公司|网络科技有限公司|信息技术有限公司|健康产业有限公司|电子商务有限公司|科技有限公司|健康产业有限公司|生物科技有限公司|网络科技有限公司))\\s+([^0-9\\n]{2,20})\\s*(\\d{4}\\.\\d{2}[-–]至今)/gi ===');
        const pattern2 = /([^\d\n]{2,30}(?:有限公司|网络科技有限公司|信息技术有限公司|健康产业有限公司|电子商务有限公司|科技有限公司|健康产业有限公司|生物科技有限公司|网络科技有限公司))\s+([^0-9\n]{2,20})\s*(\d{4}\.\d{2}[-–]至今)/gi;
        count = 0;
        while ((match = pattern2.exec(content)) !== null && count < 10) {
            count++;
            console.log(`匹配${count}:`);
            console.log(`  公司: "${match[1].trim()}"`);
            console.log(`  职位: "${match[2].trim()}"`);
            console.log(`  日期: ${match[3].trim()}`);
            console.log();
        }
        console.log(`模式2共匹配${count}次\n`);

        console.log('=== 测试模式3: /([^\\d\\n]{2,30}(?:有限公司|网络科技有限公司|信息技术有限公司|健康产业有限公司|电子商务有限公司|科技有限公司|健康产业有限公司|生物科技有限公司|网络科技有限公司))\\s+([^0-9\\n]{2,20})\\s*(\\d{4}[-–年]+\\d{4}|至今)/gi ===');
        const pattern3 = /([^\d\n]{2,30}(?:有限公司|网络科技有限公司|信息技术有限公司|健康产业有限公司|电子商务有限公司|科技有限公司|健康产业有限公司|生物科技有限公司|网络科技有限公司))\s+([^0-9\n]{2,20})\s*(\d{4}[-–年]+\d{4}|至今)/gi;
        count = 0;
        while ((match = pattern3.exec(content)) !== null && count < 10) {
            count++;
            console.log(`匹配${count}:`);
            console.log(`  公司: "${match[1].trim()}"`);
            console.log(`  职位: "${match[2].trim()}"`);
            console.log(`  日期: ${match[3].trim()}`);
            console.log();
        }
        console.log(`模式3共匹配${count}次\n`);

    } catch (error) {
        console.error('测试模式匹配失败:', error);
    } finally {
        await sequelize.close();
    }
}

testFinalPattern();
