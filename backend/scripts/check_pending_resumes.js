const { ResumeJob, Resume, Job } = require('../models');
const { Op } = require('sequelize');

async function checkResumeJobs() {
    try {
        console.log('--- 待快评 ResumeJob 检查 ---');
        const pending = await ResumeJob.findAll({
            where: {
                status: { [Op.in]: ['applied', 'screening'] },
                [Op.or]: [
                    { match_score: null },
                    { match_score: 0 }
                ]
            },
            include: [
                { model: Resume, as: 'Resume' },
                { model: Job, as: 'Job' }
            ]
        });

        console.log(`发现 ${pending.length} 个待处理申请:`);
        pending.forEach(p => {
            console.log(`- 简历ID: ${p.resume_id} (${p.Resume?.file_name}), 职位ID: ${p.job_id} (${p.Job?.title}), 状态: ${p.status}, 分数: ${p.match_score}, 职位自动快评: ${p.Job?.enable_auto_screening}`);
        });

        console.log('\n--- 职位自动快评状态检查 ---');
        const jobs = await Job.findAll({
            where: { status: 'active' },
            attributes: ['id', 'title', 'enable_auto_screening']
        });
        jobs.forEach(j => {
            console.log(`- 职位: ${j.title} (ID: ${j.id}), 自动快评: ${j.enable_auto_screening}`);
        });

    } catch (error) {
        console.error('检查失败:', error);
    } finally {
        process.exit();
    }
}

checkResumeJobs();
