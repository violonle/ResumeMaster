const EnhancedResumeParseService = require('../services/enhancedResumeParseService');
const path = require('path');
const fs = require('fs');

async function debugSkillsExtraction() {
    console.log('=== 调试技能段落提取功能 ===\n');
    
    const parser = new EnhancedResumeParseService();
    
    // 测试用例: 中文TXT简历 (使用更真实的格式)
    const testContent = `个人简历
    
基本信息:
姓名: 张三
性别: 男
年龄: 28岁
电话: 13812345678
邮箱: zhangsan@example.com
现居地: 北京市海淀区

教育背景:
2016.09 - 2020.06 北京大学 计算机科学与技术 本科

工作经历:
2020.07 - 至今 腾讯科技有限公司 软件工程师
负责后端服务开发和维护, 参与多个重要项目

技能专长:
Java, Python, JavaScript, React, Spring Boot, MySQL, Redis

个人优势:
拥有扎实的技术基础, 良好的团队合作精神, 学习能力强`;
    
    console.log('测试内容:', testContent);
    console.log('内容长度:', testContent.length);
    
    // 调试段落提取
    console.log('\n--- 开始调试技能段落提取 ---');
    
    // 测试技能段落的提取
    const sectionNames = ['技能特长', '专业技能', 'Skills', 'Technical Skills', '技能'];
    console.log('查找的关键词:', sectionNames.join(', '));
    
    // 测试 extractSection 方法
    const skillsSection = parser.extractSection(testContent, sectionNames);
    console.log('提取到的技能段落:', skillsSection);
    
    if (skillsSection) {
        console.log('段落长度:', skillsSection.length);
        console.log('段落预览:', skillsSection.substring(0, 100));
        
        // 测试技能解析
        console.log('\n--- 测试技能解析 ---');
        const skills = parser.extractSkills(skillsSection);
        console.log('解析到的技能:', skills);
    } else {
        console.log('技能段落提取失败');
        
        // 详细调试 extractSection 方法
        console.log('\n--- 详细调试 extractSection 方法 ---');
        
        // 手动测试每个关键词
        for (const name of sectionNames) {
            console.log(`\n测试关键词: "${name}"`);
            
            // 创建测试用的正则表达式
            const patterns = [
                new RegExp(`${name}[:：]\\s*([\\s\\S]*?)(?=(?:${parser.getAllSectionHeaders().join('|')})|$)`, 'i'),
                new RegExp(`${name}[:：]\\s*([^.。！？;；]{5,1000}?)(?=[.。！？;；]|(?:${parser.getAllSectionHeaders().join('|')})|$)`, 'i'),
                new RegExp(`${name}[:：]\\s*([^\\n\\r]+?)(?:\\n|$)`, 'i'),
                new RegExp(`${name}[:：]\\s*([^。，；\\n\\r]{5,1000})(?=[。，；]|$)`, 'i')
            ];
            
            for (let i = 0; i < patterns.length; i++) {
                console.log(`  模式 ${i + 1}:`, patterns[i].toString());
                const match = testContent.match(patterns[i]);
                if (match && match[1]) {
                    console.log(`  ✅ 匹配成功: "${match[1].trim()}"`);
                    break;
                } else {
                    console.log(`  ❌ 未匹配`);
                }
            }
        }
    }
    
    // 测试整体解析
    console.log('\n--- 测试整体解析 ---');
    const result = await parser.parseResumeContent(testContent);
    
    console.log('解析结果:');
    console.log('姓名:', result.name);
    console.log('邮箱:', result.email);
    console.log('电话:', result.phone);
    console.log('城市:', result.location);
    console.log('技能:', result.skills);
    console.log('工作经历:', result.experience);
    console.log('教育经历:', result.education);
    
    console.log('\n=== 调试完成 ===');
}

// 运行调试
if (require.main === module) {
    debugSkillsExtraction().catch(console.error);
}

module.exports = debugSkillsExtraction;