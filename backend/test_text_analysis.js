const { sequelize, Resume } = require('./models');

async function testTextAnalysis() {
  try {
    await sequelize.authenticate();
    
    const resume = await Resume.findByPk(70);
    if (!resume) {
      console.log('未找到ID为70的简历');
      return;
    }

    const content = resume.raw_text;
    console.log('=== 原始文本分析 ===');
    console.log('文本长度:', content.length);
    
    console.log('\n=== 按行分析 ===');
    const lines = content.split('\n');
    console.log('总行数:', lines.length);
    
    console.log('\n前50行:');
    lines.slice(0, 50).forEach((line, i) => {
      const trimmed = line.trim();
      console.log(`${i+1}: [${trimmed}]`);
    });
    
    console.log('\n=== 查找关键信息 ===');
    
    // 查找姓名
    const nameMatch = content.match(/刘良东/);
    console.log('姓名:', nameMatch ? nameMatch[0] : '未找到');
    
    // 查找性别
    const genderMatch = content.match(/男|女/);
    console.log('性别:', genderMatch ? genderMatch[0] : '未找到');
    
    // 查找年龄
    const ageMatch = content.match(/\d+岁/);
    console.log('年龄:', ageMatch ? ageMatch[0] : '未找到');
    
    // 查找工作经历
    const workExpMatch = content.match(/工作经历/i);
    console.log('工作经历位置:', workExpMatch ? workExpMatch.index : '未找到');
    
    // 查找项目经历
    const projectMatch = content.match(/项目经历/i);
    console.log('项目经历位置:', projectMatch ? projectMatch.index : '未找到');
    
    // 查找教育经历
    const eduMatch = content.match(/教育经历/i);
    console.log('教育经历位置:', eduMatch ? eduMatch.index : '未找到');
    
    // 查找个人优势
    const summaryMatch = content.match(/个人优势/i);
    console.log('个人优势位置:', summaryMatch ? summaryMatch.index : '未找到');
    
    console.log('\n=== 提取工作经历部分 ===');
    if (workExpMatch) {
      const workExpStart = workExpMatch.index;
      const nextSectionIndex = Math.min(
        projectMatch ? projectMatch.index : Infinity,
        eduMatch ? eduMatch.index : Infinity
      );
      const workExpEnd = nextSectionIndex === Infinity ? content.length : nextSectionIndex;
      const workExpText = content.substring(workExpStart, workExpEnd);
      console.log('工作经历文本长度:', workExpText.length);
      console.log('工作经历前500字符:', workExpText.substring(0, 500));
    }
    
    console.log('\n=== 提取项目经历部分 ===');
    if (projectMatch) {
      const projectStart = projectMatch.index;
      const nextSectionIndex = Math.min(
        eduMatch ? eduMatch.index : Infinity
      );
      const projectEnd = nextSectionIndex === Infinity ? content.length : nextSectionIndex;
      const projectText = content.substring(projectStart, projectEnd);
      console.log('项目经历文本长度:', projectText.length);
      console.log('项目经历前500字符:', projectText.substring(0, 500));
    }
    
    console.log('\n=== 提取教育经历部分 ===');
    if (eduMatch) {
      const eduStart = eduMatch.index;
      const eduText = content.substring(eduStart);
      console.log('教育经历文本长度:', eduText.length);
      console.log('教育经历前500字符:', eduText.substring(0, 500));
    }
    
    await sequelize.close();
  } catch (err) {
    console.error('测试失败:', err);
  }
}

testTextAnalysis();
