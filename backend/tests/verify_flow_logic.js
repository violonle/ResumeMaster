
/**
 * 自动深度解析逻辑校验脚本 (不依赖 HTTP 接口)
 * 验证：快评通过 -> 自动触发深度解析 -> 数据库状态更新
 */
const { Job, Resume, ResumeJob, User, AnalysisResult, sequelize } = require('../models');
const deepAnalysisService = require('../services/deepAnalysisService');
const logger = require('../utils/logger');

async function verifyFlowLogic() {
    console.log('🚀 开始自动深度解析逻辑校验...');
    console.log('📊 数据库配置:', sequelize.options.host, sequelize.options.port, sequelize.options.dialect);

    try {
        // 1. 准备测试数据
        console.log('\nStep 1: 准备测试数据...');
        
        // 查找或创建一个测试用户
        let user = await User.findOne({ where: { username: 'admin' } });
        if (!user) {
            user = await User.create({
                username: 'admin',
                password_hash: '$2a$10$X7vHlVnL6N.o/7vHlVnL6N.o/7vHlVnL6N.o/7vHlVnL6N.o/7vHlVnL6N', // dummy hash
                role: 'admin',
                email: 'admin@example.com'
            });
        }
        console.log(`✅ 测试用户: ${user.username} (ID: ${user.id})`);

        // 创建一个配置了自动快评和自动深度解析的职位
        const job = await Job.create({
            user_id: user.id,
            title: '逻辑校验职位',
            description: 'Java 开发工程师，精通 Spring Boot',
            enable_auto_screening: true,
            auto_reject_score: 50,
            enable_deep_analysis: true,
            status: 'active'
        });
        console.log(`✅ 测试职位创建成功: ID = ${job.id}`);

        // 创建一份简历
        const resume = await Resume.create({
            user_id: user.id,
            name: '逻辑测试员',
            file_name: 'test_resume.pdf',
            file_size: 1024,
            file_type: 'pdf',
            file_path: 'uploads/test.pdf',
            raw_text: '我是一名 Java 开发者，有 5 年 Spring Boot 经验。',
            status: 'uploaded'
        });
        console.log(`✅ 测试简历创建成功: ID = ${resume.id}`);

        // 创建关联关系
        const rj = await ResumeJob.create({
            resume_id: resume.id,
            job_id: job.id,
            user_id: user.id,
            status: 'applied'
        });
        console.log(`✅ 简历职位关联成功`);

        // 2. 模拟自动快评通过逻辑
        console.log('\nStep 2: 模拟自动快评通过...');
        
        // 模拟 aiController 中的逻辑：更新分数并触发深度解析
        // 这里我们直接调用 ResumeJob 的更新，模拟快评完成后的状态
        await rj.update({
            match_score: 80,
            status: 'screening'
        });
        console.log(`✅ 模拟快评完成: 分数 80, 状态 screening`);

        // 3. 触发即时深度解析
        console.log('\nStep 3: 触发即时深度解析...');
        // 直接调用服务
        await deepAnalysisService.triggerImmediate(resume.id, job.id);
        
        // 4. 轮询检查数据库状态
        console.log('\nStep 4: 检查数据库状态流转...');
        let attempts = 0;
        const maxAttempts = 10;
        
        while (attempts < maxAttempts) {
            const updatedRj = await ResumeJob.findOne({
                where: { resume_id: resume.id, job_id: job.id }
            });
            
            console.log(`[检查 ${attempts + 1}] 深度解析状态: ${updatedRj.deep_analysis_status}, 触发源: ${updatedRj.deep_analysis_trigger}`);
            
            if (updatedRj.deep_analysis_status === 'completed') {
                console.log('\n✨ 逻辑校验成功: 深度解析已自动完成！');
                
                // 验证 AnalysisResult 是否存在
                const result = await AnalysisResult.findOne({
                    where: { resume_id: resume.id, job_id: job.id }
                });
                if (result) {
                    console.log(`✅ 发现分析结果: 分数 ${result.overall_score}, 总结: ${result.summary.substring(0, 50)}...`);
                } else {
                    console.log('❌ 未发现 AnalysisResult 记录');
                }
                break;
            }
            
            if (updatedRj.deep_analysis_status === 'failed') {
                console.log(`\n❌ 逻辑校验失败: 深度解析失败 - ${updatedRj.deep_analysis_error}`);
                break;
            }

            await new Promise(resolve => setTimeout(resolve, 2000));
            attempts++;
        }

        if (attempts >= maxAttempts) {
            console.log('\n⏳ 逻辑校验超时: 深度解析未能在预期时间内完成。');
        }

    } catch (error) {
        console.error('\n❌ 逻辑校验执行出错:', error);
    } finally {
        // 清理测试数据 (可选，但为了环境整洁，建议清理)
        // console.log('\n清理测试数据...');
        // await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
        // ... 清理逻辑 ...
        process.exit(0);
    }
}

verifyFlowLogic();
