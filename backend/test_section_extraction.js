const { Resume } = require('./models');
const OptimizedResumeParseService = require('./services/optimizedResumeParseService');

async function testSectionExtraction() {
    try {
        const resume = await Resume.findByPk(112);
        if (!resume) {
            console.log('简历ID 112不存在');
            return;
        }

        const parseService = new OptimizedResumeParseService();
        const sections = parseService.extractAllSections(resume.raw_text);

        console.log('=== 章节提取结果 ===');
        console.log('Summary章节:', sections.summary ? sections.summary.substring(0, 100) : '空');
        console.log('Experience章节:', sections.experience ? sections.experience.substring(0, 100) : '空');
        console.log('Education章节:', sections.education ? sections.education.substring(0, 100) : '空');
        console.log('Projects章节:', sections.projects ? sections.projects.substring(0, 100) : '空');
        console.log('Skills章节:', sections.skills ? sections.skills.substring(0, 100) : '空');
        console.log('===================');

        console.log('\n=== 章节评分 ===');
        console.log('Summary评分:', parseService.scoreSectionContent(sections.summary, 'summary'));
        console.log('Experience评分:', parseService.scoreSectionContent(sections.experience, 'experience'));
        console.log('Education评分:', parseService.scoreSectionContent(sections.education, 'education'));
        console.log('Projects评分:', parseService.scoreSectionContent(sections.projects, 'projects'));
        console.log('Skills评分:', parseService.scoreSectionContent(sections.skills, 'skills'));
        console.log('===================');

    } catch (error) {
        console.error('测试失败:', error);
    }
}

testSectionExtraction();
