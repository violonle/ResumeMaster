const EnhancedResumeParseService = require('../services/enhancedResumeParseService');
const fs = require('fs');
const path = require('path');

async function debugEducationParsing() {
    console.log('=== 调试教育背景解析 ===\n');
    
    const parser = new EnhancedResumeParseService();
    
    // 测试用例: 中文TXT简历
    const testContent = `个人简历 基本信息:  姓名: 张三 性别: 男 年龄: 28岁 电话: 13812345678 邮箱: zhangsan@example.com 现居地: 北京市海淀区 教育背景:  2016.09 - 2020.06 北京大学 计算机科学与技术 本科 工作经历:  2020.07 - 至今 腾讯科技有限公司 软件工程师 负责后端服务开发和维护, 参与多个重要项目 技能专长:  Java, Python, JavaScript, React, Spring Boot, MySQL, Redis 个人优势:  拥有扎实的技术基础, 良好的团队合作精神, 学习能力强`;
    
    console.log('测试内容:', testContent);
    console.log('\n--- 提取教育背景段落 ---');
    
    const educationSection = parser.extractSection(testContent, ['教育背景', '教育经历', 'Education', 'Educational Background', '学历信息']);
    console.log('提取到的教育背景段落:', educationSection);
    
    if (educationSection) {
        console.log('段落长度:', educationSection.length);
        console.log('段落预览:', educationSection.substring(0, 100));
        
        console.log('\n--- 测试教育背景解析模式 ---');
        
        // 测试不同的解析模式
        const patterns = [
            // 时间 + 学校 + 专业 + 学历（处理实际格式：2016.09 - 2020.06 北京大学...）
            /(\d{4})\s*[.-]\s*(\d{2})\s*[-–]\s*(\d{4})\s*[.-]\s*(\d{2})\s*(.+)/i,
            // 简化的时间 + 内容模式
            /(\d{4})\s*.*\s*(\d{4})\s*(.+)/i,
            // 最宽松的模式
            /(\d{4})\s*(.+)/i
        ];
        
        for (let i = 0; i < patterns.length; i++) {
            console.log(`\n模式 ${i + 1}:`, patterns[i].toString());
            patterns[i].lastIndex = 0; // 重置正则表达式状态
            const match = patterns[i].exec(educationSection);
            if (match) {
                console.log('匹配结果:', match);
                console.log('学校信息:', match[3]);
                if (match[4]) console.log('额外信息:', match[4]);
            } else {
                console.log('未匹配');
            }
        }
    }
    
    console.log('\n=== 调试完成 ===');
}

// 运行调试
debugEducationParsing().catch(console.error);