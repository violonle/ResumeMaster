/**
 * 演示数据种子脚本
 * 为默认管理员用户生成职位、简历及分析结果示例数据
 */
const { sequelize, User, Resume, AnalysisResult, Job } = require('../models');

async function seedDemo() {
  console.log('🚀 开始写入演示数据...');
  try {
    await sequelize.authenticate();

    // 查找默认管理员用户
    const admin = await User.findOne({ where: { email: 'admin@resumemaster.com' } });
    if (!admin) {
      console.error('❌ 未找到管理员用户：admin@resumemaster.com，请先运行 db:init');
      process.exit(1);
    }

    // 如果该用户已有简历，避免重复插入
    const existingResumes = await Resume.count({ where: { user_id: admin.id } });
    if (existingResumes > 0) {
      console.log(`ℹ️ 管理员已有 ${existingResumes} 条简历数据，跳过重复种子写入。`);
    } else {
      // 创建一些职位
      const jobs = [
        { title: '前端工程师', location: '上海', salary_range: '20K-35K', experience_required: '3-5年', status: 'active' },
        { title: 'Java后端工程师', location: '北京', salary_range: '25K-40K', experience_required: '5年以上', status: 'active' },
        { title: '产品经理', location: '深圳', salary_range: '30K-45K', experience_required: '4-6年', status: 'active' },
        { title: '数据分析师', location: '杭州', salary_range: '22K-32K', experience_required: '2-4年', status: 'active' },
        { title: 'UI/UX设计师', location: '广州', salary_range: '20K-30K', experience_required: '3-5年', status: 'active' },
        { title: '市场营销经理', location: '成都', salary_range: '25K-40K', experience_required: '5年以上', status: 'active' }
      ];

      await Job.bulkCreate(jobs.map(j => ({ ...j, user_id: admin.id })));
      console.log(`✅ 已创建 ${jobs.length} 个职位`);

      const candidates = [
        { name: '张三', role: '前端工程师', skills: ['JavaScript', 'React', 'Vue', 'CSS', 'Webpack'] },
        { name: '李四', role: 'Java后端工程师', skills: ['Java', 'Spring Boot', 'MySQL', 'Redis', 'Docker'] },
        { name: '王五', role: 'UI/UX设计师', skills: ['Figma', 'Sketch', '交互设计', '视觉设计'] },
        { name: '赵六', role: '产品经理', skills: ['需求分析', 'PRD', 'A/B测试', '项目管理'] },
        { name: '钱七', role: '数据分析师', skills: ['Python', 'Pandas', 'SQL', '机器学习'] },
        { name: '孙八', role: '前端工程师', skills: ['TypeScript', 'React', 'Next.js', 'CSS Modules'] },
        { name: '周九', role: 'Java后端工程师', skills: ['Java', '微服务', 'Kafka', 'PostgreSQL'] },
        { name: '吴十', role: '产品经理', skills: ['用户研究', '竞品分析', '路线图'] },
        { name: '郑十一', role: '市场营销经理', skills: ['SEO', '内容营销', '数据分析'] },
        { name: '王十二', role: '数据分析师', skills: ['Python', 'Tableau', '统计建模'] }
      ];

      // 创建简历和部分分析结果
      for (let i = 0; i < candidates.length; i++) {
        const c = candidates[i];
        const fileName = `${c.name}_${c.role}.pdf`;
        const resume = await Resume.create({
          user_id: admin.id,
          file_name: fileName,
          file_size: 1024 * (120 + Math.floor(Math.random() * 80)),
          file_type: 'pdf',
          file_path: '/uploads/demo.pdf',
          upload_date: new Date(Date.now() - (i * 86400000)),
          parsed_data: {
            name: c.name,
            role: c.role,
            summary: `${c.name}，有${2 + i % 5}年${c.role}相关经验。`,
            skills: c.skills,
            experience: [
              { company: '科技创新有限公司', duration: '2021-至今', details: '负责核心模块研发与性能优化' }
            ],
            education: { degree: '本科', school: '某某大学', year: 2019 }
          },
          status: 'uploaded',
          tags: c.skills
        });

        // 为前8份简历创建分析结果
        if (i < 8) {
          const score = 70 + Math.floor(Math.random() * 25); // 70-94
          const dimensions = {
            skills: Math.min(100, score - 5 + Math.floor(Math.random() * 10)),
            experience: Math.min(100, score - 10 + Math.floor(Math.random() * 10)),
            education: 60 + Math.floor(Math.random() * 20),
            projects: 65 + Math.floor(Math.random() * 25),
            leadership: 55 + Math.floor(Math.random() * 20)
          };

          await AnalysisResult.create({
            user_id: admin.id,
            resume_id: resume.id,
            analysis_date: new Date(Date.now() - (i * 86400000) + 3600 * 1000),
            overall_score: score,
            dimensions,
            suggestions: [
              '补充近期项目的量化成果',
              '在简历中增加关键技能的关键词覆盖',
              '优化工作经历描述的结构化表达'
            ],
            strengths: ['技能扎实', '项目经验丰富'],
            weaknesses: ['领导力描述不足', '教育背景一般'],
            target_job: { title: c.role, location: '全国', salary: '面议' },
            detailed_analysis: { note: '分析由演示脚本生成，仅供展示' }
          });

          // 更新简历状态为已分析
          await resume.update({ status: 'analyzed' });
        }
      }

      console.log(`✅ 已创建 ${candidates.length} 份简历，其中 8 份带分析结果`);
    }

    console.log('🎉 演示数据写入完成');
    process.exit(0);
  } catch (err) {
    console.error('❌ 写入演示数据失败:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  seedDemo();
}

module.exports = seedDemo;