const { Resume } = require('./models');
const OptimizedResumeParseService = require('./services/optimizedResumeParseService');

async function testDetailedSectionExtraction() {
    try {
        const resume = await Resume.findByPk(112);
        if (!resume) {
            console.log('简历ID 112不存在');
            return;
        }

        const parseService = new OptimizedResumeParseService();
        const sections = parseService.extractAllSections(resume.raw_text);

        console.log('=== 详细章节提取结果 ===');
        console.log('\n--- Summary章节 ---');
        console.log('内容:', sections.summary);
        console.log('长度:', sections.summary ? sections.summary.length : 0);

        console.log('\n--- Experience章节 ---');
        console.log('内容:', sections.experience);
        console.log('长度:', sections.experience ? sections.experience.length : 0);

        console.log('\n--- Education章节 ---');
        console.log('内容:', sections.education);
        console.log('长度:', sections.education ? sections.education.length : 0);

        console.log('\n--- Projects章节 ---');
        console.log('内容:', sections.projects);
        console.log('长度:', sections.projects ? sections.projects.length : 0);

        console.log('\n--- Skills章节 ---');
        console.log('内容:', sections.skills);
        console.log('长度:', sections.skills ? sections.skills.length : 0);

        console.log('\n=== 原始文本中的工作经历部分 ===');
        const lines = resume.raw_text.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('工作经历') || lines[i].match(/^\d{4}\.\d{1,2}[-–]/)) {
                console.log(`行 ${i + 1}: ${lines[i].substring(0, 80)}`);
            }
        }

    } catch (error) {
        console.error('测试失败:', error);
    }
}

testDetailedSectionExtraction();
