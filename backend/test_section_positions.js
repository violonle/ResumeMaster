const { Resume } = require('./models');
const OptimizedResumeParseService = require('./services/optimizedResumeParseService');

async function testSectionPositions() {
    try {
        const resume = await Resume.findByPk(112);
        if (!resume) {
            console.log('简历ID 112不存在');
            return;
        }

        const parseService = new OptimizedResumeParseService();
        
        const sectionDefinitions = [
            { key: 'summary', titles: ['个人优势', '个人简介', '自我评价', 'Summary', 'Profile', 'About Me', '个人总结', '个人介绍', '自我介绍'] },
            { key: 'experience', titles: ['工作经历', '工作经验', 'Work Experience', 'Professional Experience', '职业经历', '工作'] },
            { key: 'education', titles: ['教育背景', '教育经历', 'Education', 'Educational Background', '学历信息', '学习经历', '教育情况', '学历'] },
            { key: 'projects', titles: ['项目经验', '项目经历', 'Projects', 'Project Experience'] },
            { key: 'skills', titles: ['技能专长', '专业技能', 'Skills', 'Technical Skills', '技能', '技术栈', '核心技能', '掌握技能', '专业能力', '技能特长', '技术能力', '技能证书'] }
        ];

        const allSectionTitles = sectionDefinitions.flatMap(def => def.titles);
        const sectionPattern = new RegExp(`^(${allSectionTitles.join('|')})[:：]?\\s*$`, 'im');
        const sectionPatternWithContent = new RegExp(`^(${allSectionTitles.join('|')})[:：]?\\s+(.+)$`, 'im');
        const sectionPatternAtStart = new RegExp(`^(${allSectionTitles.join('|')})`, 'im');

        const lines = resume.raw_text.split('\n');
        const allSectionPositions = [];

        for (let i = 0; i < lines.length; i++) {
            const trimmedLine = lines[i].trim();
            
            if (trimmedLine.length === 0) {
                continue;
            }

            if (sectionPattern.test(trimmedLine)) {
                const matchedTitle = trimmedLine.match(sectionPattern)[1];
                const sectionKey = parseService.findSectionKey(matchedTitle, sectionDefinitions);
                
                if (sectionKey) {
                    allSectionPositions.push({ index: i, key: sectionKey, title: matchedTitle, type: 'exact' });
                }
            } else if (sectionPatternWithContent.test(trimmedLine)) {
                const match = trimmedLine.match(sectionPatternWithContent);
                const matchedTitle = match[1];
                const sectionContent = match[2];
                const sectionKey = parseService.findSectionKey(matchedTitle, sectionDefinitions);
                
                if (sectionKey) {
                    allSectionPositions.push({ index: i, key: sectionKey, title: matchedTitle, type: 'withContent', content: sectionContent });
                }
            } else if (sectionPatternAtStart.test(trimmedLine)) {
                const match = trimmedLine.match(sectionPatternAtStart);
                const matchedTitle = match[1];
                const sectionKey = parseService.findSectionKey(matchedTitle, sectionDefinitions);
                
                if (sectionKey) {
                    const inlineContent = trimmedLine.substring(matchedTitle.length).trim();
                    allSectionPositions.push({ index: i, key: sectionKey, title: matchedTitle, type: 'atStart', content: inlineContent });
                }
            }
        }

        console.log('=== 所有检测到的章节位置 ===');
        allSectionPositions.forEach(pos => {
            console.log(`行 ${pos.index + 1}: [${pos.type}] ${pos.title} -> ${pos.key}`);
            if (pos.content) {
                console.log(`  内容: ${pos.content.substring(0, 50)}...`);
            }
        });

        console.log('\n=== 按章节类型分组 ===');
        const grouped = {};
        allSectionPositions.forEach(pos => {
            if (!grouped[pos.key]) {
                grouped[pos.key] = [];
            }
            grouped[pos.key].push(pos);
        });

        Object.keys(grouped).forEach(key => {
            console.log(`\n${key}: ${grouped[key].length} 个位置`);
            grouped[key].forEach(pos => {
                console.log(`  行 ${pos.index + 1}: ${pos.title}`);
            });
        });

    } catch (error) {
        console.error('测试失败:', error);
    }
}

testSectionPositions();
