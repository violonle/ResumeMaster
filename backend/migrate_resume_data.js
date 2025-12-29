const sequelize = require('./config/db');
const { Resume } = require('./models');

async function migrateResumeData() {
  try {
    console.log('开始迁移简历数据...\n');

    await sequelize.authenticate();
    console.log('✓ 数据库连接成功\n');

    const resumes = await Resume.findAll({
      where: {
        parsed_data: {
          [sequelize.Sequelize.Op.ne]: null
        }
      }
    });

    console.log(`找到 ${resumes.length} 条需要迁移的简历记录\n`);

    let migratedCount = 0;

    for (const resume of resumes) {
      const pd = resume.parsed_data;
      if (!pd) continue;

      const updateData = {};

      if (pd.name && !resume.name) updateData.name = pd.name;
      if (pd.phone && !resume.phone) updateData.phone = pd.phone;
      if (pd.email && !resume.email) updateData.email = pd.email;
      if (pd.location && !resume.location) updateData.location = pd.location;
      if (pd.city && !resume.location) updateData.location = pd.city;
      if (pd.expectCity && !resume.location) updateData.location = pd.expectCity;
      if (pd.jobTitle && !resume.job_title) updateData.job_title = pd.jobTitle;
      if (pd.experience_years && !resume.experience_years) updateData.experience_years = pd.experience_years;
      if (pd.highest_education && !resume.highest_education) updateData.highest_education = pd.highest_education;
      if (pd.job_status && !resume.job_status) updateData.job_status = pd.job_status;
      if (pd.expected_salary && !resume.expected_salary) updateData.expected_salary = pd.expected_salary;
      if (pd.summary && !resume.summary) updateData.summary = pd.summary;
      if (pd.workExperience && (!resume.work_experience || resume.work_experience.length === 0)) updateData.work_experience = pd.workExperience;
      if (pd.education && (!resume.education || resume.education.length === 0)) updateData.education = pd.education;
      if (pd.skills && (!resume.skills || resume.skills.length === 0)) updateData.skills = pd.skills;
      if (pd.projects && (!resume.projects || resume.projects.length === 0)) updateData.projects = pd.projects;

      if (Object.keys(updateData).length > 0) {
        await resume.update(updateData);
        migratedCount++;
        console.log(`✓ 已迁移简历 ID ${resume.id}: ${resume.file_name}`);
        console.log(`  更新字段: ${Object.keys(updateData).join(', ')}`);
      } else {
        console.log(`- 简历 ID ${resume.id} 无需迁移`);
      }
    }

    console.log(`\n✓ 迁移完成！共迁移 ${migratedCount} 条简历记录\n`);

    console.log('建议：');
    console.log('1. 访问 http://localhost:3000/pages/resume-details.html?id=71 查看前端显示效果');
    console.log('2. 如果显示正常，说明数据迁移成功');
    console.log('3. 新导入的简历会自动使用新字段存储数据');

  } catch (error) {
    console.error('✗ 迁移失败:', error.message);
    console.error(error);
  } finally {
    await sequelize.close();
  }
}

migrateResumeData();