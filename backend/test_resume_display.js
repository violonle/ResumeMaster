const sequelize = require('./config/db');
const { Resume } = require('./models');

async function testResumeDisplay() {
  try {
    console.log('开始测试简历展示流程...\n');

    // 连接数据库
    await sequelize.authenticate();
    console.log('✓ 数据库连接成功\n');

    // 获取最新的简历记录
    const resume = await Resume.findOne({
      order: [['id', 'DESC']]
    });

    if (!resume) {
      console.log('✗ 数据库中没有简历记录');
      return;
    }

    console.log('找到最新简历记录:');
    console.log('- ID:', resume.id);
    console.log('- 文件名:', resume.file_name);
    console.log('- 上传日期:', resume.upload_date);
    console.log('\n');

    // 检查新字段是否有数据
    console.log('检查新字段数据:');
    console.log('- 姓名:', resume.name || '未填写');
    console.log('- 电话:', resume.phone || '未填写');
    console.log('- 邮箱:', resume.email || '未填写');
    console.log('- 城市:', resume.location || '未填写');
    console.log('- 职位:', resume.job_title || '未填写');
    console.log('- 工作经验:', resume.experience_years ? resume.experience_years + '年' : '未填写');
    console.log('- 最高学历:', resume.highest_education || '未填写');
    console.log('- 求职状态:', resume.job_status || '未填写');
    console.log('- 期望薪资:', resume.expected_salary || '未填写');
    console.log('- 个人优势:', resume.summary ? resume.summary.substring(0, 100) + '...' : '未填写');
    console.log('\n');

    // 检查数组字段
    console.log('检查数组字段:');
    console.log('- 技能数量:', resume.skills ? resume.skills.length : 0);
    if (resume.skills && resume.skills.length > 0) {
      console.log('  技能列表:', resume.skills.slice(0, 5).join(', '));
    }
    console.log('- 工作经历数量:', resume.work_experience ? resume.work_experience.length : 0);
    if (resume.work_experience && resume.work_experience.length > 0) {
      console.log('  第一条工作经历:', JSON.stringify(resume.work_experience[0], null, 2));
    }
    console.log('- 教育经历数量:', resume.education ? resume.education.length : 0);
    if (resume.education && resume.education.length > 0) {
      console.log('  第一条教育经历:', JSON.stringify(resume.education[0], null, 2));
    }
    console.log('- 项目经历数量:', resume.projects ? resume.projects.length : 0);
    if (resume.projects && resume.projects.length > 0) {
      console.log('  第一条项目经历:', JSON.stringify(resume.projects[0], null, 2));
    }
    console.log('\n');

    // 检查parsed_data字段（用于向后兼容）
    console.log('检查parsed_data字段:');
    if (resume.parsed_data) {
      console.log('- parsed_data存在');
      console.log('- parsed_data中的姓名:', resume.parsed_data.name || '未填写');
      console.log('- parsed_data中的电话:', resume.parsed_data.phone || '未填写');
      console.log('- parsed_data中的邮箱:', resume.parsed_data.email || '未填写');
    } else {
      console.log('- parsed_data不存在');
    }
    console.log('\n');

    console.log('✓ 测试完成');
    console.log('\n建议：');
    console.log('1. 如果新字段有数据，前端应该能正确显示');
    console.log('2. 如果新字段没有数据，需要重新导入简历或运行解析脚本');
    console.log('3. 访问 http://localhost:3000/pages/resume-details.html?id=' + resume.id + ' 查看前端显示效果');

  } catch (error) {
    console.error('✗ 测试失败:', error.message);
    console.error(error);
  } finally {
    await sequelize.close();
  }
}

testResumeDisplay();