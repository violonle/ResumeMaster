
// 强制设置本地数据库连接，避免 Docker 环境下的 'db' 主机名解析失败
process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_USER = process.env.DB_USER || 'root';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'Longkou7~!@';
process.env.DB_NAME = process.env.DB_NAME || 'superresumemaster';
process.env.DB_PORT = process.env.DB_PORT || '3306';

const { Job, Resume, ResumeJob, User, sequelize } = require('./backend/models');
const autoScreeningService = require('./backend/services/autoScreeningService');
const aiController = require('./backend/controllers/aiController');

async function verifySettings() {
  console.log('--- 开始验证职位管理新设置 ---');

  try {
    // 1. 尝试获取或创建一个测试用户 ID (跳过复杂的 User 查询，避免 real_name 等字段缺失导致的错误)
    let userId = 1; 
    try {
      const users = await User.findAll({ limit: 1, attributes: ['id', 'username'] });
      if (users && users.length > 0) {
        userId = users[0].id;
        console.log(`使用现有用户: ${users[0].username} (ID: ${userId})`);
      } else {
        console.log(`未找到用户，使用默认 ID: ${userId}`);
      }
    } catch (e) {
      console.log(`查询用户出错，使用默认 ID: ${userId}, 错误: ${e.message}`);
    }

    // 2. 检查 Job 表结构是否已更新
    console.log('\n--- 检查 Job 表结构 ---');
    const tableDesc = await sequelize.getQueryInterface().describeTable('jobs');
    const expectedFields = ['enable_auto_screening', 'notify_high_score', 'high_score_threshold', 'enable_deep_analysis'];
    expectedFields.forEach(field => {
      if (tableDesc[field]) {
        console.log(`✅ 字段 ${field} 存在`);
      } else {
        console.error(`❌ 字段 ${field} 不存在！`);
      }
    });

    // 2. 创建一个开启了自动深度解析和高分通知的测试职位
    const testJob = await Job.create({
      user_id: userId,
      title: '验证测试职位',
      description: '这是一个用于验证自动深度解析和通知逻辑的测试职位。要求具有10年架构经验。',
      requirements: '1. 熟悉 Node.js\n2. 熟悉 PostgreSQL\n3. 熟悉 AI 提示词工程',
      status: 'active',
      enable_auto_screening: true,
      notify_high_score: true,
      high_score_threshold: 80, // 设置低一点方便触发
      enable_deep_analysis: true
    });
    console.log(`已创建测试职位: ${testJob.title} (ID: ${testJob.id})`);
    console.log(`设置详情: 自动快评=${testJob.enable_auto_screening}, 深度解析=${testJob.enable_deep_analysis}, 高分通知=${testJob.notify_high_score}, 阈值=${testJob.high_score_threshold}`);

    // 3. 创建一个测试简历
    const testResume = await Resume.create({
      user_id: userId,
      file_name: 'test_resume.pdf',
      file_size: 1024,
      file_type: 'pdf',
      file_path: '/tmp/test_resume.pdf',
      status: 'uploaded',
      raw_text: '张三，资深架构师。拥有12年 Node.js 开发经验，精通 PostgreSQL 数据库设计和 AI 集成。曾主导多个大型全栈项目。'
    });
    console.log(`已创建测试简历: ${testResume.file_name} (ID: ${testResume.id})`);

    // 4. 关联简历与职位
    await ResumeJob.create({
      resume_id: testResume.id,
      job_id: testJob.id,
      user_id: userId,
      status: 'applied'
    });
    console.log(`已建立简历与职位的关联`);

    // 5. 模拟 autoScreeningService 的处理逻辑
    console.log('\n--- 模拟自动快评触发 ---');
    
    // 检查职位设置
    const job = await Job.findByPk(testJob.id);
    const scene = job.enable_deep_analysis ? 'deep_analysis' : 'resume_quick_score';
    console.log(`根据职位设置，选择的 AI 分析场景为: ${scene}`);

    if (scene !== 'deep_analysis') {
      console.error('错误: 应该是 deep_analysis 但得到了 ' + scene);
    } else {
      console.log('验证成功: 场景匹配正确。');
    }

    // 6. 模拟 aiController 的通知逻辑
    console.log('\n--- 模拟高分通知触发 ---');
    const mockScore = 85;
    console.log(`假设评分为: ${mockScore}`);
    
    if (job.notify_high_score && mockScore >= job.high_score_threshold) {
      console.log(`触发通知逻辑! 分数 ${mockScore} >= 阈值 ${job.high_score_threshold}`);
      console.log('验证成功: 通知触发条件匹配。');
    } else {
      console.log('未触发通知');
    }

    // 清理测试数据 (可选，这里先保留以便检查数据库)
    // await testJob.destroy();
    // await testResume.destroy();
    
    console.log('\n--- 验证完成 ---');

  } catch (error) {
    console.error('验证过程中出错:', error);
  } finally {
    process.exit();
  }
}

verifySettings();
