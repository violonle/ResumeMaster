const { Op } = require('sequelize');
const models = require('./backend/models');

async function checkLatestTxtResume() {
  try {
    const latestResume = await models.Resume.findOne({
      where: {
        file_type: 'txt',
        deleted_at: null
      },
      order: [['created_at', 'DESC']],
      attributes: ['id', 'file_name', 'created_at', 'parsed_data', 'error_message']
    });

    if (!latestResume) {
      console.log('未找到最新的TXT简历记录');
      return;
    }

    console.log('\n=== 最新TXT简历导入分析 ===');
    console.log('简历ID:', latestResume.id);
    console.log('文件名:', latestResume.file_name);
    console.log('创建时间:', latestResume.created_at);
    console.log('\n--- 解析数据 (parsed_data) ---');
    
    const parsedData = latestResume.parsed_data;
    if (parsedData && typeof parsedData === 'object') {
      console.log('\n基本信息:');
      console.log('  姓名:', parsedData.name || '未填写');
      console.log('  邮箱:', parsedData.email || '未填写');
      console.log('  电话:', parsedData.phone || '未填写');
      console.log('  性别:', parsedData.gender || '未填写');
      console.log('  年龄:', parsedData.age || '未填写');
      console.log('  地址:', parsedData.address || '未填写');
      
      console.log('\n技能:');
      if (parsedData.skills && parsedData.skills.length > 0) {
        console.log('  ' + parsedData.skills.join(', '));
      } else {
        console.log('  未填写');
      }
      
      console.log('\n教育经历:');
      if (parsedData.education && parsedData.education.length > 0) {
        parsedData.education.forEach((edu, index) => {
          console.log(`  ${index + 1}. ${edu.school || '未知学校'} - ${edu.major || '未知专业'} (${edu.period || '未知时间'})`);
        });
      } else {
        console.log('  未填写');
      }
      
      console.log('\n工作经历:');
      if (parsedData.workExperience && parsedData.workExperience.length > 0) {
        parsedData.workExperience.forEach((work, index) => {
          console.log(`  ${index + 1}. ${work.company || '未知公司'} - ${work.position || '未知职位'} (${work.period || '未知时间'})`);
          console.log(`     职责: ${work.description || '无描述'}`);
        });
      } else {
        console.log('  未填写');
      }
      
      console.log('\n项目经历:');
      if (parsedData.projects && parsedData.projects.length > 0) {
        parsedData.projects.forEach((project, index) => {
          console.log(`  ${index + 1}. ${project.name || '未知项目'} (${project.period || '未知时间'})`);
          console.log(`     描述: ${project.description || '无描述'}`);
        });
      } else {
        console.log('  未填写');
      }
      
      console.log('\n其他信息:');
      console.log('  自我描述:', parsedData.summary || '未填写');
      console.log('  期望薪资:', parsedData.expectedSalary || '未填写');
      console.log('  求职意向:', parsedData.jobIntent || '未填写');
    } else {
      console.log('无解析数据');
    }
    
    console.log('\n--- 错误信息 (error_message) ---');
    console.log(latestResume.error_message || '无错误信息');
    
  } catch (error) {
    console.error('查询简历时出错:', error);
  } finally {
    await models.sequelize.close();
  }
}

checkLatestTxtResume();
