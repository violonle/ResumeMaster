const sequelize = require('./config/db');
const { Resume } = require('./models');

async function testAPIResponse() {
  try {
    console.log('测试API响应数据...\n');

    await sequelize.authenticate();
    console.log('✓ 数据库连接成功\n');

    const resume = await Resume.findByPk(70);

    if (!resume) {
      console.log('✗ 未找到ID为70的简历');
      return;
    }

    console.log('=== 简历数据 (模拟API响应) ===');
    console.log('ID:', resume.id);
    console.log('文件名:', resume.file_name);
    console.log('姓名:', resume.name);
    console.log('职位:', resume.job_title);
    console.log('邮箱:', resume.email);
    console.log('电话:', resume.phone);
    console.log('城市:', resume.location);
    console.log('工作年限:', resume.experience_years);
    console.log('最高学历:', resume.highest_education);
    console.log('求职状态:', resume.job_status);
    console.log('期望薪资:', resume.expected_salary);
    console.log('技能:', resume.skills);
    console.log('技能数量:', resume.skills ? resume.skills.length : 0);
    console.log('个人优势:', resume.summary);
    console.log('项目经历:', resume.projects);
    console.log('工作经历:', resume.work_experience);
    console.log('教育经历:', resume.education);
    console.log('\n');

    console.log('=== parsed_data ===');
    if (resume.parsed_data) {
      console.log('parsed_data.skills:', resume.parsed_data.skills);
      console.log('parsed_data.workExperience:', resume.parsed_data.workExperience);
      console.log('parsed_data.education:', resume.parsed_data.education);
      console.log('parsed_data.projects:', resume.parsed_data.projects);
      console.log('parsed_data.summary:', resume.parsed_data.summary);
    } else {
      console.log('parsed_data 为空');
    }

    console.log('\n=== 前端将使用的技能数据 ===');
    const skills = resume.skills || (resume.parsed_data && resume.parsed_data.skills) || [];
    console.log('技能:', skills);
    console.log('技能数量:', skills.length);
    if (skills.length > 0) {
      console.log('技能标签HTML:', skills.map(s => `<span class="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">${s}</span>`).join(''));
    } else {
      console.log('技能标签HTML: <span class="text-gray-400 text-sm">暂无技能标签</span>');
    }

  } catch (error) {
    console.error('✗ 测试失败:', error.message);
    console.error(error);
  } finally {
    await sequelize.close();
  }
}

testAPIResponse();
