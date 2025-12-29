const OptimizedResumeParseService = require('./services/optimizedResumeParseService');
const { Resume } = require('./models');

async function testResumeParsing() {
    try {
        console.log('开始测试简历解析...');
        
        const resume = await Resume.findOne({ where: { id: 112 } });
        
        if (!resume) {
            console.error('未找到简历ID 112');
            return;
        }
        
        console.log('原始文本长度:', resume.raw_text.length);
        console.log('\n=== 原始文本前500行 ===');
        const lines = resume.raw_text.split('\n');
        lines.slice(0, 500).forEach((line, index) => {
            console.log(`${index + 1}: ${line}`);
        });
        console.log('\n=== 原始文本结束 ===\n');
        
        const parseService = new OptimizedResumeParseService();
        const sections = parseService.extractAllSections(resume.raw_text);
        
        console.log('\n=== 章节内容 ===');
        for (const [key, content] of Object.entries(sections)) {
            console.log(`\n${key} (${content.length} chars):`);
            console.log(content);
        }
        console.log('\n=== 章节内容结束 ===\n');
        
        console.log('\n=== 测试教育提取 ===');
        const educationResult = parseService.extractEducation(resume.raw_text);
        console.log('教育提取结果:', JSON.stringify(educationResult, null, 2));
        console.log('=== 教育提取结束 ===\n');
        
        console.log('\n=== 测试技能提取 ===');
        const skillsResult = parseService.extractSkills(resume.raw_text);
        console.log('技能提取结果:', JSON.stringify(skillsResult, null, 2));
        console.log('=== 技能提取结束 ===\n');
        
        const parsedData = await parseService.parseResumeContent(resume.raw_text);
        
        console.log('\n=== 解析结果 ===');
        console.log('姓名:', parsedData.name);
        console.log('邮箱:', parsedData.email);
        console.log('电话:', parsedData.phone);
        console.log('职位:', parsedData.job_title);
        console.log('工作经历数量:', Array.isArray(parsedData.work_experience) ? parsedData.work_experience.length : 0);
        console.log('教育经历数量:', Array.isArray(parsedData.education) ? parsedData.education.length : 0);
        console.log('技能数量:', Array.isArray(parsedData.skills) ? parsedData.skills.length : 0);
        console.log('项目经历数量:', Array.isArray(parsedData.projects) ? parsedData.projects.length : 0);
        console.log('个人优势长度:', parsedData.summary ? parsedData.summary.length : 0);
        
        if (Array.isArray(parsedData.work_experience) && parsedData.work_experience.length > 0) {
            console.log('\n=== 工作经历 ===');
            parsedData.work_experience.forEach((exp, index) => {
                console.log(`\n工作经历 ${index + 1}:`);
                console.log('  公司:', exp.company);
                console.log('  职位:', exp.position);
                console.log('  开始时间:', exp.startDate);
                console.log('  结束时间:', exp.endDate);
                const desc = Array.isArray(exp.description) ? exp.description.join('\n') : exp.description;
                console.log('  描述:', desc ? desc.substring(0, 100) + '...' : '无');
            });
        }
        
        if (Array.isArray(parsedData.education) && parsedData.education.length > 0) {
            console.log('\n=== 教育经历 ===');
            parsedData.education.forEach((edu, index) => {
                console.log(`\n教育经历 ${index + 1}:`);
                console.log('  学校:', edu.school);
                console.log('  专业:', edu.major);
                console.log('  学历:', edu.degree);
                console.log('  开始时间:', edu.startDate);
                console.log('  结束时间:', edu.endDate);
            });
        }
        
        console.log('\n=== 个人优势 ===');
        console.log(parsedData.summary || '无');
        
        console.log('\n=== 技能 ===');
        console.log(Array.isArray(parsedData.skills) ? parsedData.skills.join(', ') : '无');
        
        console.log('\n测试完成！');
        
    } catch (error) {
        console.error('测试失败:', error);
    }
}

testResumeParsing();