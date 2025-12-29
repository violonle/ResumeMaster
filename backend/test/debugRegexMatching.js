const EnhancedResumeParseService = require('../services/enhancedResumeParseService');

async function debugRegexMatching() {
    console.log('=== 调试正则表达式匹配 ===\n');
    
    const parser = new EnhancedResumeParseService();
    
    // 测试用例
    const educationSection = '2016.09 - 2020.06 北京大学 计算机科学与技术 本科';
    
    console.log('教育背景段落:', educationSection);
    console.log('段落长度:', educationSection.length);
    
    // 测试不同的解析模式
    const patterns = [
        // 时间 + 学校 + 专业 + 学历（更宽松，适应清理后的文本）
        /(\d{4})\s*[-–年至]+\s*(\d{4}|至今|Present|Now)\s*([^\s]+大学|学院|University|College|School)(.*)/i,
        // 学校 + 时间模式（更宽松）
        /([^\s]+大学|学院|University|College|School).*?(\d{4})\s*[-–年至]+\s*(\d{4}|至今|Present|Now)/i,
        // 时间 + 学校模式（最宽松）
        /(\d{4})\s*[-–年至]+\s*(\d{4}|至今|Present|Now)\s*(.+?)(?=\s|$)/i,
        // 更简单的模式
        /(\d{4})\s*[-–]\s*(\d{4})\s*(.+)/,
        // 最简模式
        /(\d{4})\s*.*\s*(\d{4})\s*(.+)/
    ];
    
    for (let i = 0; i < patterns.length; i++) {
        console.log(`\n--- 测试模式 ${i + 1} ---`);
        console.log('正则表达式:', patterns[i].toString());
        
        const match = patterns[i].exec(educationSection);
        if (match) {
            console.log('✅ 匹配成功!');
            console.log('完整匹配:', match[0]);
            console.log('捕获组:');
            match.forEach((group, index) => {
                if (index > 0) {
                    console.log(`  组${index}: "${group}"`);
                }
            });
        } else {
            console.log('❌ 未匹配');
        }
    }
    
    // 测试字符分析
    console.log('\n--- 字符分析 ---');
    for (let i = 0; i < educationSection.length; i++) {
        const char = educationSection[i];
        const charCode = educationSection.charCodeAt(i);
        console.log(`位置 ${i}: "${char}" (编码: ${charCode})`);
        if (i > 20) break; // 只显示前20个字符
    }
    
    console.log('\n=== 调试完成 ===');
}

// 运行调试
debugRegexMatching().catch(console.error);