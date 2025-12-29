const { Resume } = require('./models');
const OptimizedResumeParseService = require('./services/optimizedResumeParseService');

async function testProjectsSections() {
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

        console.log('=== Projects章节详细信息 ===');
        const projectsPositions = allSectionPositions.filter(p => p.key === 'projects');
        
        projectsPositions.forEach((pos, idx) => {
            const nextPos = allSectionPositions.find(p => p.index > pos.index);
            const startLine = pos.index + 1;
            const endLine = nextPos ? nextPos.index : lines.length;
            
            const sectionContent = lines.slice(startLine, endLine)
                .map(line => line.trim())
                .filter(line => line.length > 0 && !line.match(/^1cbd323a52b5ebf51X163964GFdUx467Vf2ZWOainPXRMxZr$/))
                .join('\n');
            
            const score = parseService.scoreSectionContent(sectionContent, 'projects');
            
            console.log(`\n--- Projects位置 ${idx + 1} (行 ${pos.index + 1}) ---`);
            console.log(`标题: ${pos.title}`);
            console.log(`类型: ${pos.type}`);
            console.log(`内容长度: ${sectionContent.length}`);
            console.log(`评分: ${score}`);
            console.log(`内容预览: ${sectionContent.substring(0, 100)}...`);
        });

    } catch (error) {
        console.error('测试失败:', error);
    }
}

testProjectsSections();
