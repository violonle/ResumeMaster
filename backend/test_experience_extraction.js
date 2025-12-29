const OptimizedResumeParseService = require('./services/optimizedResumeParseService');
const { Resume } = require('./models');

async function testExperienceExtraction() {
    try {
        console.log('开始测试工作经历提取...');
        
        const resume = await Resume.findOne({ where: { id: 112 } });
        
        if (!resume) {
            console.error('未找到简历ID 112');
            return;
        }
        
        const parseService = new OptimizedResumeParseService();
        
        console.log('\n=== 从原始文本提取工作经历 ===');
        const experienceFromRaw = parseService.extractExperience(resume.raw_text);
        console.log(`提取到 ${experienceFromRaw.length} 个工作经历:`);
        experienceFromRaw.forEach((exp, index) => {
            console.log(`\n工作经历 ${index + 1}:`);
            console.log('  公司:', exp.company);
            console.log('  职位:', exp.position);
            console.log('  开始时间:', exp.startDate);
            console.log('  结束时间:', exp.endDate);
        });
        
        const sections = parseService.extractAllSections(resume.raw_text);
        
        console.log('\n=== 从工作经历章节提取工作经历 ===');
        const experienceFromSection = parseService.extractExperience(sections.experience || '');
        console.log(`提取到 ${experienceFromSection.length} 个工作经历:`);
        experienceFromSection.forEach((exp, index) => {
            console.log(`\n工作经历 ${index + 1}:`);
            console.log('  公司:', exp.company);
            console.log('  职位:', exp.position);
            console.log('  开始时间:', exp.startDate);
            console.log('  结束时间:', exp.endDate);
        });
        
        console.log('\n=== 工作经历章节内容 ===');
        console.log(sections.experience);
        
        console.log('\n测试完成！');
        
    } catch (error) {
        console.error('测试失败:', error);
    }
}

testExperienceExtraction();
