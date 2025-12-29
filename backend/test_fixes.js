const { sequelize, Resume } = require('./models/index');
const OptimizedResumeParseService = require('./services/optimizedResumeParseService');

async function testFixes() {
    try {
        await sequelize.authenticate();
        console.log('数据库连接成功');
        
        const resume = await Resume.findByPk(94);
        if (!resume) {
            console.log('未找到ID为94的简历');
            return;
        }
        
        console.log('=== 测试修复效果 ===');
        console.log('简历ID:', resume.id);
        console.log('姓名:', resume.name);
        
        const parseService = new OptimizedResumeParseService();
        const parsed = await parseService.parseResumeContent(resume.raw_text);
        
        console.log('\n=== 1. 技能专长检查 ===');
        console.log('解析出的技能数量:', parsed.skills ? parsed.skills.length : 0);
        console.log('技能列表:', parsed.skills);
        
        console.log('\n=== 2. 教育经历检查 ===');
        console.log('解析出的教育经历数量:', parsed.education ? parsed.education.length : 0);
        console.log('教育经历详情:', JSON.stringify(parsed.education, null, 2));
        
        console.log('\n=== 3. 项目经历检查 ===');
        console.log('解析出的项目数量:', parsed.projects ? parsed.projects.length : 0);
        
        const hasGarbledText = parsed.projects.some(proj => 
            proj.name.includes('006d3bcd164b99021X1639m5GVZUwY23VfKaWOainPXRMxZr') ||
            proj.description.includes('006d3bcd164b99021X1639m5GVZUwY23VfKaWOainPXRMxZr') ||
            proj.role.includes('006d3bcd164b99021X1639m5GVZUwY23VfKaWOainPXRMxZr')
        );
        console.log('是否包含乱码:', hasGarbledText);
        
        console.log('\n=== 项目详情 ===');
        parsed.projects.forEach((proj, index) => {
            console.log(`\n项目 ${index + 1}:`);
            console.log('  名称:', proj.name);
            console.log('  角色:', proj.role);
            console.log('  时间:', `${proj.startDate} - ${proj.endDate}`);
            console.log('  描述:', proj.description ? proj.description.substring(0, 100) + '...' : '无');
        });
        
        console.log('\n=== 更新数据库 ===');
        await resume.update({
            skills: parsed.skills,
            education: parsed.education,
            projects: parsed.projects
        });
        console.log('数据库更新成功');
        
        await sequelize.close();
    } catch (error) {
        console.error('错误:', error);
    }
}

testFixes();