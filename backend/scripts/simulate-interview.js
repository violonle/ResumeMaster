/**
 * 模拟发送面试通知并生成链接的测试脚本
 */
const { sequelize, Resume, Job, ResumeJob, User } = require('../models');

async function simulateInterviewNotification() {
  console.log('🚀 开始模拟面试通知流程...');
  
  try {
    await sequelize.authenticate();
    
    // 1. 获取一个测试用户
    const user = await User.findOne({ where: { username: 'masteradmin' } });
    if (!user) {
      console.error('❌ 未找到测试用户 masteradmin，请先运行 seed-demo.js');
      return;
    }

    // 2. 获取或创建一个测试职位
    let job = await Job.findOne({ where: { user_id: user.id } });
    if (!job) {
      job = await Job.create({
        user_id: user.id,
        title: '测试职位',
        location: '北京',
        status: 'active'
      });
      console.log('✅ 已创建测试职位');
    }

    // 3. 获取或创建一个测试简历
    let resume = await Resume.findOne({ where: { user_id: user.id } });
    const testContent = '这是一份用于测试 AI 面试功能的模拟简历文本。该候选人精通 React、Node.js 和 TypeScript，拥有 5 年开发经验。';
    
    if (!resume) {
      resume = await Resume.create({
        user_id: user.id,
        file_name: '测试简历.pdf',
        file_path: '/uploads/test.pdf',
        parsed_data: {
          name: '测试候选人',
          phone: '13800138000',
          email: 'test@example.com',
          resume_text: testContent
        },
        raw_text: testContent,
        status: 'parsed'
      });
      console.log('✅ 已创建测试简历');
    } else {
      // 确保现有简历也有内容
      await resume.update({
        raw_text: resume.raw_text || testContent,
        parsed_data: {
          ...(resume.parsed_data || {}),
          resume_text: resume.parsed_data?.resume_text || testContent
        }
      });
      console.log('✅ 已更新现有简历内容');
    }

    // 4. 创建投递记录 (ResumeJob)
    const [resumeJob, created] = await ResumeJob.findOrCreate({
      where: {
        resume_id: resume.id,
        job_id: job.id
      },
      defaults: {
        user_id: user.id,
        status: 'screening'
      }
    });

    if (created) {
      console.log('✅ 已创建投递记录');
    }

    // 5. 模拟状态变更触发短信逻辑 (直接打印链接)
    const host = 'localhost:3000';
    const interviewLink = `http://${host}/pages/Interview/index.html?resumeJobId=${resumeJob.id}`;
    
    console.log('\n' + '='.repeat(50));
    console.log('📢 模拟面试通知已生成！');
    console.log('--------------------------------------------------');
    console.log(`候选人: ${resume.parsed_data.name}`);
    console.log(`手机号: ${resume.parsed_data.phone}`);
    console.log(`面试链接: ${interviewLink}`);
    console.log('='.repeat(50) + '\n');
    
    console.log('💡 您可以直接复制上面的链接在浏览器中打开进行测试。');

  } catch (error) {
    console.error('❌ 模拟流程失败:', error);
  } finally {
    await sequelize.close();
  }
}

simulateInterviewNotification();
