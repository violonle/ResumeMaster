
const { Job, Resume, ResumeJob, User, sequelize } = require('../models');
const deepAnalysisService = require('../services/deepAnalysisService');

async function testPolling() {
    console.log('🚀 开始测试自动深度解析轮询机制...');
    
    try {
        // 1. 准备测试数据
        const user = await User.findOne({ where: { username: 'admin' } });
        
        // 创建一个配置了自动深度解析的职位
        const job = await Job.create({
            user_id: user.id,
            title: '轮询测试职位',
            enable_auto_screening: true,
            enable_deep_analysis: true,
            status: 'active'
        });

        // 创建一份“快评已通过”但“未深度解析”的简历
        const resume = await Resume.create({
            user_id: user.id,
            name: '轮询测试员',
            file_name: 'polling_test.pdf',
            file_size: 1024,
            file_type: 'pdf',
            file_path: 'uploads/polling_test.pdf',
            status: 'analyzed'
        });

        const rj = await ResumeJob.create({
            resume_id: resume.id,
            job_id: job.id,
            user_id: user.id,
            status: 'screening',
            match_score: 85,
            deep_analysis_status: 'none' // 初始状态为 none
        });

        console.log(`✅ 准备就绪: ResumeJob ID = ${rj.id}, 状态 = ${rj.status}, 深度解析状态 = ${rj.deep_analysis_status}`);

        // 2. 执行轮询任务
        console.log('\nStep 2: 执行轮询任务...');
        await deepAnalysisService.processPolling();

        // 3. 检查状态
        console.log('\nStep 3: 检查状态流转...');
        // 给一点时间让异步任务开始
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const updatedRj = await ResumeJob.findByPk(rj.id);
        console.log(`📊 最终状态: deep_analysis_status = ${updatedRj.deep_analysis_status}, trigger = ${updatedRj.deep_analysis_trigger}`);
        
        if (['processing', 'completed'].includes(updatedRj.deep_analysis_status) && updatedRj.deep_analysis_trigger === 'auto_polling') {
            console.log('\n✨ 轮询机制验证成功！');
        } else {
            console.log('\n❌ 轮询机制验证失败');
        }

    } catch (error) {
        console.error('❌ 测试出错:', error);
    } finally {
        process.exit(0);
    }
}

testPolling();
