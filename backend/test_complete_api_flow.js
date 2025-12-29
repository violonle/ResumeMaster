const { Resume, User } = require('./models');
const { Op } = require('sequelize');

async function testCompleteApiFlow() {
  try {
    console.log('=== 完整API流程测试 ===\n');
    
    // 模拟用户 - 使用testuser (user_id: 2)
    const mockUser = {
      id: 2,
      company_id: 5
    };
    
    const resumeId = 70;
    
    console.log('1. 模拟用户信息:');
    console.log('   user_id:', mockUser.id);
    console.log('   company_id:', mockUser.company_id);
    
    // 模拟API查询逻辑
    const resume = await Resume.findOne({
      where: {
        id: resumeId,
        [Op.or]: [
          { user_id: mockUser.id },
          mockUser.company_id ? { company_id: mockUser.company_id } : null
        ].filter(Boolean)
      },
      include: [
        { model: User, attributes: ['id', 'username', 'avatar'] }
      ]
    });

    if (!resume) {
      console.log('\n❌ 简历不存在');
      return;
    }

    console.log('\n2. API查询结果:');
    console.log('   ID:', resume.id);
    console.log('   文件名:', resume.file_name);
    
    const jsonData = resume.toJSON();
    
    console.log('\n3. 数据库字段:');
    console.log('   name:', jsonData.name);
    console.log('   phone:', jsonData.phone);
    console.log('   email:', jsonData.email);
    console.log('   location:', jsonData.location);
    console.log('   job_title:', jsonData.job_title);
    console.log('   experience_years:', jsonData.experience_years);
    console.log('   highest_education:', jsonData.highest_education);
    console.log('   job_status:', jsonData.job_status);
    console.log('   expected_salary:', jsonData.expected_salary);
    
    console.log('\n4. JSON字段:');
    console.log('   skills:', jsonData.skills);
    console.log('   skills类型:', typeof jsonData.skills);
    console.log('   skills是否为数组:', Array.isArray(jsonData.skills));
    
    if (jsonData.skills) {
      console.log('   skills长度:', jsonData.skills.length);
      console.log('   skills内容:', jsonData.skills);
    }
    
    console.log('\n5. parsed_data字段:');
    const pd = jsonData.parsed_data || {};
    console.log('   parsed_data存在:', !!pd);
    console.log('   parsed_data.skills:', pd.skills);
    console.log('   parsed_data.name:', pd.name);
    console.log('   parsed_data.jobTitle:', pd.jobTitle);
    
    console.log('\n6. 前端显示逻辑:');
    console.log('   const skills = data.skills || pd.skills || [];');
    const skills = jsonData.skills || pd.skills || [];
    console.log('   skills:', skills);
    console.log('   skills.length:', skills.length);
    
    if (skills.length > 0) {
      console.log('\n7. 前端HTML生成:');
      const html = skills.map(s => `<span class="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">${s}</span>`).join('');
      console.log('   HTML:', html);
    } else {
      console.log('\n7. 前端HTML生成:');
      console.log('   HTML: <span class="text-gray-400 text-sm">暂无技能标签</span>');
    }
    
    console.log('\n✅ API流程测试完成');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

testCompleteApiFlow();
