const sequelize = require('./config/db');
const { Resume } = require('./models');

async function checkResume70() {
  try {
    console.log('检查简历 ID 70 的数据...\n');

    await sequelize.authenticate();
    console.log('✓ 数据库连接成功\n');

    const resume = await Resume.findByPk(70);

    if (!resume) {
      console.log('✗ 未找到ID为70的简历');
      return;
    }

    console.log('=== 简历基本信息 ===');
    console.log('ID:', resume.id);
    console.log('文件名:', resume.file_name);
    console.log('上传日期:', resume.upload_date);
    console.log('文件类型:', resume.file_type);
    console.log('综合评分:', resume.overall_score);
    
    console.log('\n=== 新字段数据 ===');
    console.log('- 姓名:', resume.name || '未填写');
    console.log('- 电话:', resume.phone || '未填写');
    console.log('- 邮箱:', resume.email || '未填写');
    console.log('- 城市:', resume.location || '未填写');
    console.log('- 职位:', resume.job_title || '未填写');
    console.log('- 工作经验:', resume.experience_years ? resume.experience_years + '年' : '未填写');
    console.log('- 最高学历:', resume.highest_education || '未填写');
    console.log('- 求职状态:', resume.job_status || '未填写');
    console.log('- 期望薪资:', resume.expected_salary || '未填写');
    console.log('- 个人优势:', resume.summary ? resume.summary.substring(0, 200) + '...' : '未填写');
    
    console.log('\n=== 数组字段 ===');
    console.log('- 技能数量:', resume.skills ? resume.skills.length : 0);
    if (resume.skills && resume.skills.length > 0) {
      console.log('  技能列表:', resume.skills.slice(0, 10).join(', '));
    }
    console.log('- 工作经历数量:', resume.work_experience ? resume.work_experience.length : 0);
    if (resume.work_experience && resume.work_experience.length > 0) {
      resume.work_experience.forEach((exp, i) => {
        console.log(`  ${i+1}. ${exp.startDate || ''}-${exp.endDate || ''} ${exp.company || ''} ${exp.position || exp.jobTitle || ''}`);
      });
    }
    console.log('- 教育经历数量:', resume.education ? resume.education.length : 0);
    if (resume.education && resume.education.length > 0) {
      resume.education.forEach((edu, i) => {
        console.log(`  ${i+1}. ${edu.startDate || ''}-${edu.endDate || ''} ${edu.school || ''} ${edu.degree || ''} ${edu.major || ''}`);
      });
    }
    console.log('- 项目经历数量:', resume.projects ? resume.projects.length : 0);
    if (resume.projects && resume.projects.length > 0) {
      resume.projects.forEach((proj, i) => {
        console.log(`  ${i+1}. ${proj.startDate || ''}-${proj.endDate || ''} ${proj.name || ''} ${proj.role || ''}`);
      });
    }

    console.log('\n=== 原始文本 (前500字符) ===');
    console.log(resume.raw_text ? resume.raw_text.substring(0, 500) : '无原始文本');

    console.log('\n✓ 检查完成');
    console.log('\n建议：');
    console.log('访问 http://localhost:3000/pages/resume-details.html?id=70 查看前端显示效果');

  } catch (error) {
    console.error('✗ 检查失败:', error.message);
    console.error(error);
  } finally {
    await sequelize.close();
  }
}

checkResume70();