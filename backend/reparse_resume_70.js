const fs = require('fs');
const path = require('path');
const { sequelize, Resume } = require('./models');
const OptimizedResumeParseService = require('./services/optimizedResumeParseService');
const { extractTextFromFile } = require('./services/textExtractor');

async function reparseResume() {
  try {
    await sequelize.authenticate();
    
    const resume = await Resume.findByPk(70);
    if (!resume) {
      console.log('未找到ID为70的简历');
      return;
    }

    console.log('=== 重新解析简历 ===');
    console.log('文件名:', resume.file_name);
    console.log('文件类型:', resume.file_type);
    
    const filePath = resume.file_path;
    console.log('文件路径:', filePath);
    
    if (!fs.existsSync(filePath)) {
      console.log('文件不存在:', filePath);
      return;
    }

    console.log('\n=== 提取文本 ===');
    const content = await extractTextFromFile(filePath, resume.file_type);
    console.log('提取的文本长度:', content ? content.length : 0);
    console.log('提取的文本前500字符:', content ? content.substring(0, 500) : '无');
    
    console.log('\n=== 使用优化解析器解析 ===');
    const parser = new OptimizedResumeParseService();
    const parsedData = await parser.parseResumeContent(content, resume.file_type);
    
    console.log('\n=== 解析结果 ===');
    console.log('姓名:', parsedData.name);
    console.log('职位:', parsedData.jobTitle);
    console.log('邮箱:', parsedData.email);
    console.log('电话:', parsedData.phone);
    console.log('位置:', parsedData.location);
    console.log('工作年限:', parsedData.experience_years);
    console.log('个人优势:', parsedData.summary ? parsedData.summary.substring(0, 200) + '...' : '无');
    
    console.log('\n工作经历数量:', parsedData.workExperience ? parsedData.workExperience.length : 0);
    if (parsedData.workExperience && parsedData.workExperience.length > 0) {
      parsedData.workExperience.forEach((exp, i) => {
        console.log(`  ${i+1}. ${exp.startDate}-${exp.endDate} ${exp.company} ${exp.position}`);
      });
    }
    
    console.log('\n教育经历数量:', parsedData.education ? parsedData.education.length : 0);
    if (parsedData.education && parsedData.education.length > 0) {
      parsedData.education.forEach((edu, i) => {
        console.log(`  ${i+1}. ${edu.startDate}-${edu.endDate} ${edu.school} ${edu.degree} ${edu.major}`);
      });
    }
    
    console.log('\n项目经历数量:', parsedData.projects ? parsedData.projects.length : 0);
    if (parsedData.projects && parsedData.projects.length > 0) {
      parsedData.projects.forEach((proj, i) => {
        console.log(`  ${i+1}. ${proj.startDate}-${proj.endDate} ${proj.name} ${proj.role}`);
      });
    }
    
    console.log('\n技能数量:', parsedData.skills ? parsedData.skills.length : 0);
    console.log('技能:', parsedData.skills);
    
    console.log('\n=== 更新数据库 ===');
    await resume.update({
      raw_text: content,
      parsed_data: parsedData
    });
    
    console.log('✅ 简历重新解析并更新成功！');
    
    await sequelize.close();
  } catch (err) {
    console.error('重新解析失败:', err);
  }
}

reparseResume();