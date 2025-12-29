const { Resume } = require('./models');

async function checkResumeData() {
    try {
        console.log('开始检查简历ID 112的数据...');
        
        const resume = await Resume.findOne({ where: { id: 112 } });
        
        if (!resume) {
            console.error('未找到简历ID 112');
            return;
        }
        
        console.log('\n=== 基本信息 ===');
        console.log('姓名:', resume.name);
        console.log('邮箱:', resume.email);
        console.log('电话:', resume.phone);
        console.log('职位:', resume.job_title);
        console.log('地点:', resume.location);
        console.log('工作年限:', resume.experience_years);
        console.log('最高学历:', resume.highest_education);
        console.log('求职状态:', resume.job_status);
        console.log('期望薪资:', resume.expected_salary);
        
        console.log('\n=== 解析数据 ===');
        console.log('个人优势长度:', resume.summary ? resume.summary.length : 0);
        console.log('工作经历:', typeof resume.work_experience);
        if (resume.work_experience) {
            const workExp = typeof resume.work_experience === 'string' 
                ? JSON.parse(resume.work_experience) 
                : resume.work_experience;
            console.log('工作经历数量:', Array.isArray(workExp) ? workExp.length : 0);
            if (Array.isArray(workExp) && workExp.length > 0) {
                workExp.forEach((exp, index) => {
                    console.log(`\n工作经历 ${index + 1}:`);
                    console.log('  公司:', exp.company);
                    console.log('  职位:', exp.position);
                    console.log('  开始时间:', exp.startDate);
                    console.log('  结束时间:', exp.endDate);
                    console.log('  描述:', exp.description ? (Array.isArray(exp.description) ? exp.description.join('\n').substring(0, 100) : exp.description.substring(0, 100)) : '无');
                });
            }
        }
        
        console.log('\n教育经历:', typeof resume.education);
        if (resume.education) {
            const edu = typeof resume.education === 'string' 
                ? JSON.parse(resume.education) 
                : resume.education;
            console.log('教育经历数量:', Array.isArray(edu) ? edu.length : 0);
        }
        
        console.log('\n技能:', typeof resume.skills);
        if (resume.skills) {
            const skills = typeof resume.skills === 'string' 
                ? JSON.parse(resume.skills) 
                : resume.skills;
            console.log('技能数量:', Array.isArray(skills) ? skills.length : 0);
            if (Array.isArray(skills)) {
                console.log('技能列表:', skills.join(', '));
            }
        }
        
        console.log('\n项目经历:', typeof resume.projects);
        if (resume.projects) {
            const projects = typeof resume.projects === 'string' 
                ? JSON.parse(resume.projects) 
                : resume.projects;
            console.log('项目经历数量:', Array.isArray(projects) ? projects.length : 0);
        }
        
        console.log('\n=== 个人优势内容 ===');
        console.log(resume.summary || '无');
        
        console.log('\n检查完成！');
        
    } catch (error) {
        console.error('检查失败:', error);
    }
}

checkResumeData();
