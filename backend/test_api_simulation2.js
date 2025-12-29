const { Resume, User } = require('./models');
const { Op } = require('sequelize');

async function simulateGetResumeById() {
  try {
    console.log('=== 模拟API调用：getResumeById ===');
    
    // 模拟用户 - 使用testuser (user_id: 2)
    const mockUser = {
      id: 2,
      company_id: 5
    };
    
    const resumeId = 70;
    
    console.log('模拟用户信息:');
    console.log('  user_id:', mockUser.id);
    console.log('  company_id:', mockUser.company_id);
    
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
      console.log('\n简历不存在');
      return;
    }

    console.log('\n=== 查询结果 ===');
    console.log('ID:', resume.id);
    console.log('文件名:', resume.file_name);
    console.log('skills字段:', resume.skills);
    console.log('skills类型:', typeof resume.skills);
    console.log('skills是否为数组:', Array.isArray(resume.skills));
    
    if (resume.skills) {
      console.log('skills长度:', resume.skills.length);
      console.log('skills内容:', resume.skills);
    }
    
    console.log('\n=== toJSON()后的数据 ===');
    const jsonData = resume.toJSON();
    console.log('skills字段:', jsonData.skills);
    console.log('skills类型:', typeof jsonData.skills);
    console.log('skills是否为数组:', Array.isArray(jsonData.skills));
    
    console.log('\n=== API响应格式 ===');
    const response = {
      success: true,
      data: resume
    };
    console.log('response.data.skills:', response.data.skills);
    
  } catch (error) {
    console.error('查询失败:', error);
  }
}

simulateGetResumeById();
