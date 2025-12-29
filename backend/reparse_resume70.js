const { sequelize } = require('./models');
const OptimizedResumeParseService = require('./services/optimizedResumeParseService');

async function reparseResume70() {
    try {
        console.log('开始重新解析简历ID 70...');

        const [results] = await sequelize.query(`
            SELECT id, file_name, raw_text, parsed_data
            FROM resumes
            WHERE id = 70
        `);

        if (results.length === 0) {
            console.log('未找到ID为70的简历');
            return;
        }

        const resume = results[0];
        console.log('简历信息:');
        console.log('ID:', resume.id);
        console.log('文件名:', resume.file_name);

        if (!resume.raw_text) {
            console.log('简历没有raw_text字段，无法重新解析');
            return;
        }

        console.log('\n开始使用更新后的解析逻辑重新解析...');

        const parseService = new OptimizedResumeParseService();
        const parsed = await parseService.parseResumeContent(resume.raw_text, 'txt');

        console.log('\n=== 解析结果 ===');
        console.log('姓名:', parsed.name);
        console.log('邮箱:', parsed.email);
        console.log('电话:', parsed.phone);
        console.log('位置:', parsed.location);
        console.log('职位:', parsed.jobTitle);
        console.log('工作经验年限:', parsed.experience_years);
        console.log('技能数量:', parsed.skills.length);
        console.log('教育经历数量:', parsed.education.length);
        console.log('工作经历数量:', parsed.workExperience.length);
        console.log('项目经历数量:', parsed.projects.length);

        console.log('\n=== 工作经历详情 ===');
        parsed.workExperience.forEach((exp, i) => {
            console.log(`\n${i+1}. 公司: ${exp.company || '未知'}`);
            console.log(`   职位: ${exp.position || '未知'}`);
            console.log(`   时间: ${exp.startDate || ''} - ${exp.endDate || ''}`);
            console.log(`   描述长度: ${exp.description ? exp.description.length : 0} 字符`);
        });

        const workExperienceJson = JSON.stringify(parsed.workExperience);
        const educationJson = JSON.stringify(parsed.education);
        const projectsJson = JSON.stringify(parsed.projects);
        const skillsJson = JSON.stringify(parsed.skills);

        await sequelize.query(`
            UPDATE resumes
            SET 
                name = ?,
                email = ?,
                phone = ?,
                location = ?,
                job_title = ?,
                work_experience = ?,
                education = ?,
                projects = ?,
                skills = ?,
                experience_years = ?,
                summary = ?,
                parsed_data = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = 70
        `, {
            replacements: [
                parsed.name || null,
                parsed.email || null,
                parsed.phone || null,
                parsed.location || null,
                parsed.jobTitle || null,
                workExperienceJson,
                educationJson,
                projectsJson,
                skillsJson,
                parsed.experience_years || null,
                parsed.summary || null,
                JSON.stringify(parsed)
            ]
        });

        console.log('\n✓ 简历ID 70已成功更新');

        console.log('\n=== 验证更新结果 ===');
        const [updatedResults] = await sequelize.query(`
            SELECT 
                id,
                name,
                email,
                phone,
                location,
                job_title,
                work_experience,
                education,
                projects,
                skills,
                experience_years,
                summary
            FROM resumes
            WHERE id = 70
        `);

        if (updatedResults.length > 0) {
            const updated = updatedResults[0];
            console.log('姓名:', updated.name);
            console.log('邮箱:', updated.email);
            console.log('电话:', updated.phone);
            console.log('位置:', updated.location);
            console.log('职位:', updated.job_title);
            console.log('工作经验年限:', updated.experience_years);

            console.log('\n工作经历:');
            if (updated.work_experience) {
                const workExp = JSON.parse(updated.work_experience);
                console.log(`数量: ${workExp.length}`);
                workExp.forEach((exp, i) => {
                    console.log(`  ${i+1}. ${exp.company} - ${exp.position} (${exp.startDate} - ${exp.endDate})`);
                });
            }

            console.log('\n教育经历:');
            if (updated.education) {
                const edu = JSON.parse(updated.education);
                console.log(`数量: ${edu.length}`);
            }

            console.log('\n项目经历:');
            if (updated.projects) {
                const proj = JSON.parse(updated.projects);
                console.log(`数量: ${proj.length}`);
            }

            console.log('\n技能:');
            if (updated.skills) {
                const skills = JSON.parse(updated.skills);
                console.log(`数量: ${skills.length}`);
                console.log(`内容: ${skills.join(', ')}`);
            }

            console.log('\n个人优势:');
            console.log(updated.summary ? updated.summary.substring(0, 200) + '...' : '无');
        }

    } catch (error) {
        console.error('重新解析简历失败:', error);
    } finally {
        await sequelize.close();
    }
}

reparseResume70();
