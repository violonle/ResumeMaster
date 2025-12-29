const OptimizedResumeParseService = require('./services/optimizedResumeParseService');
const { Resume } = require('./models');

async function testSaveParsingResult() {
  try {
    const resume = await Resume.findByPk(112);
    if (!resume) {
      console.log('未找到简历ID 112');
      return;
    }

    console.log('=== 重新解析简历 ===');
    const parseService = new OptimizedResumeParseService();
    const parsedData = await parseService.parseResumeContent(resume.raw_text, 'txt');

    console.log('解析结果:');
    console.log('工作经历数量:', Array.isArray(parsedData.work_experience) ? parsedData.work_experience.length : 0);
    console.log('教育经历数量:', Array.isArray(parsedData.education) ? parsedData.education.length : 0);
    console.log('技能数量:', Array.isArray(parsedData.skills) ? parsedData.skills.length : 0);
    console.log('项目数量:', Array.isArray(parsedData.projects) ? parsedData.projects.length : 0);
    console.log('个人优势长度:', parsedData.summary ? parsedData.summary.length : 0);

    console.log('\n=== 准备保存到数据库 ===');
    const updateData = {
      work_experience: parsedData.work_experience || null,
      education: parsedData.education || null,
      skills: parsedData.skills || null,
      projects: parsedData.projects || null,
      summary: parsedData.summary || null,
      parsed_data: parsedData
    };

    console.log('要保存的数据:');
    console.log('work_experience:', updateData.work_experience);
    console.log('education:', updateData.education);
    console.log('skills:', updateData.skills);
    console.log('projects:', updateData.projects);

    console.log('\n=== 保存到数据库 ===');
    await resume.update(updateData);

    console.log('保存成功！');

    console.log('\n=== 验证保存结果 ===');
    const updatedResume = await Resume.findByPk(112);
    console.log('工作经历数量:', Array.isArray(updatedResume.work_experience) ? updatedResume.work_experience.length : 0);
    console.log('教育经历数量:', Array.isArray(updatedResume.education) ? updatedResume.education.length : 0);
    console.log('技能数量:', Array.isArray(updatedResume.skills) ? updatedResume.skills.length : 0);
    console.log('项目数量:', Array.isArray(updatedResume.projects) ? updatedResume.projects.length : 0);
    console.log('个人优势长度:', updatedResume.summary ? updatedResume.summary.length : 0);

  } catch (error) {
    console.error('测试失败:', error.message);
    console.error(error.stack);
  } finally {
    await require('./models').sequelize.close();
  }
}

testSaveParsingResult();
