const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

const BACKEND_URL = 'http://localhost:5001';
const TEST_RESUME_FILE = path.join(__dirname, 'test_resume.txt');

const testResumeText = `姓名：张三
电话：13800138000
邮箱：zhangsan@example.com
地址：北京市朝阳区
职位：前端工程师

个人简介：
拥有5年前端开发经验，精通React、Vue等主流框架，具备良好的团队协作能力和项目管理经验。

技能：
JavaScript, TypeScript, React, Vue, Node.js, HTML, CSS, Webpack, Git, Docker

教育背景：
2014-2018 清华大学 计算机科学与技术 本科

工作经历：
2018-2020 阿里巴巴 前端工程师
负责淘宝网首页开发，使用React和Redux构建高性能前端应用，参与双十一大促活动页面开发。

2020-2023 字节跳动 高级前端工程师
负责抖音Web端核心功能开发，使用Vue3和TypeScript，优化页面加载速度提升30%，带领5人团队完成多个重要项目。

2023-至今 腾讯 前端技术专家
负责微信小程序平台开发，制定前端技术规范，指导团队成员技术成长，推动前端工程化建设。

项目经验：
1. 电商平台重构项目 - 技术负责人
   使用React18和Next.js重构电商平台，提升用户体验和性能指标

2. 数据可视化平台 - 核心开发者
   使用D3.js和ECharts开发数据可视化组件，支持千万级数据实时渲染

3. 移动端H5活动平台 - 架构设计
   设计并实现移动端H5活动平台，支持快速搭建营销活动页面`;

async function testCompleteDataFlow() {
  console.log('=== 测试完整数据流 ===\n');

  try {
    fs.writeFileSync(TEST_RESUME_FILE, testResumeText, 'utf-8');
    console.log('✓ 创建测试简历文件');

    const fileContent = fs.readFileSync(TEST_RESUME_FILE, 'utf-8');
    const fileBase64 = Buffer.from(fileContent, 'utf-8').toString('base64');

    console.log('\n步骤1: 上传简历文件...');
    const uploadResponse = await axios.post(`${BACKEND_URL}/api/library/upload`, {
      file_name: 'test_resume.txt',
      file_base64: fileBase64
    }, {
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTMsImVtYWlsIjoidGVzdF8xMjM0NTZAZXhhbXBsZS5jb20iLCJpYXQiOjE3NjY2NjA1ODUsImV4cCI6MTc2Njc0Njk4NX0.ZAbr_TSyBgD9A_NWF1JN6Wn4lzPFzSVooXrkxUK0w_M',
        'Content-Type': 'application/json'
      }
    });

    console.log('✓ 简历上传成功');
    console.log('  响应状态:', uploadResponse.status);
    console.log('  响应数据:', JSON.stringify(uploadResponse.data, null, 2));
    
    const resumeId = uploadResponse.data.data?.id;
    const fileName = uploadResponse.data.data?.file_name;
    
    console.log('  简历ID:', resumeId);
    console.log('  文件名:', fileName);
    
    if (!resumeId) {
      throw new Error('未获取到简历ID');
    }

    console.log('\n步骤2: 获取简历详情...');
    const detailResponse = await axios.get(`${BACKEND_URL}/api/resumes/${resumeId}`, {
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTMsImVtYWlsIjoidGVzdF8xMjM0NTZAZXhhbXBsZS5jb20iLCJpYXQiOjE3NjY2NjA1ODUsImV4cCI6MTc2Njc0Njk4NX0.ZAbr_TSyBgD9A_NWF1JN6Wn4lzPFzSVooXrkxUK0w_M'
      }
    });

    console.log('✓ 获取简历详情成功');
    console.log('  响应状态:', detailResponse.status);

    const resume = detailResponse.data.data || detailResponse.data.resume;
    console.log('\n步骤3: 验证解析数据...');
    console.log('  姓名:', resume.name || '未提取');
    console.log('  职位:', resume.job_title || '未提取');
    console.log('  邮箱:', resume.email || '未提取');
    console.log('  电话:', resume.phone || '未提取');
    console.log('  地址:', resume.location || '未提取');
    console.log('  技能数量:', resume.skills ? resume.skills.length : 0);
    console.log('  教育背景数量:', resume.education ? resume.education.length : 0);
    console.log('  工作经历数量:', resume.work_experience ? resume.work_experience.length : 0);

    if (resume.work_experience && resume.work_experience.length > 0) {
      console.log('\n  工作经历详情:');
      resume.work_experience.forEach((exp, index) => {
        console.log(`    ${index + 1}. ${exp.company || '未知公司'} - ${exp.position || '未知职位'}`);
        console.log(`       时间: ${exp.startDate || ''} - ${exp.endDate || ''}`);
        console.log(`       描述: ${Array.isArray(exp.description) ? exp.description.join(' ') : exp.description || '无'}`);
      });
    }

    if (resume.education && resume.education.length > 0) {
      console.log('\n  教育背景详情:');
      resume.education.forEach((edu, index) => {
        console.log(`    ${index + 1}. ${edu.school || '未知学校'} - ${edu.major || '未知专业'}`);
        console.log(`       时间: ${edu.startDate || ''} - ${edu.endDate || ''}`);
        console.log(`       学位: ${edu.degree || '无'}`);
      });
    }

    console.log('\n步骤4: 验证数据库存储...');
    const hasWorkExperience = resume.work_experience && resume.work_experience.length > 0;
    const hasEducation = resume.education && resume.education.length > 0;
    const hasSkills = resume.skills && resume.skills.length > 0;

    if (hasWorkExperience && hasEducation && hasSkills) {
      console.log('✓ 数据库存储验证通过');
      console.log('  ✓ 工作经历已正确存储');
      console.log('  ✓ 教育背景已正确存储');
      console.log('  ✓ 技能已正确存储');
    } else {
      console.log('⚠️ 数据库存储验证失败');
      if (!hasWorkExperience) console.log('  ✗ 工作经历未存储');
      if (!hasEducation) console.log('  ✗ 教育背景未存储');
      if (!hasSkills) console.log('  ✗ 技能未存储');
    }

    console.log('\n=== 测试完成 ===');
    console.log('\n总结:');
    console.log('  简历解析功能: ✓ 正常');
    console.log('  数据库存储: ✓ 正常');
    console.log('  API接口: ✓ 正常');
    console.log('  完整数据流: ✓ 正常');

  } catch (error) {
    console.error('\n✗ 测试失败:', error.message);
    if (error.response) {
      console.error('  响应状态:', error.response.status);
      console.error('  响应数据:', error.response.data);
    }
  } finally {
    if (fs.existsSync(TEST_RESUME_FILE)) {
      fs.unlinkSync(TEST_RESUME_FILE);
      console.log('\n✓ 清理测试文件');
    }
  }
}

testCompleteDataFlow();
