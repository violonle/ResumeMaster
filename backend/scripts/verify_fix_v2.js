
const { sequelize, User, Resume, AnalysisResult, ResumeJob } = require('../models');
const aiController = require('../controllers/aiController');
const DomesticAIService = require('../services/domesticAIService');
const PromptService = require('../services/promptService');
const logger = require('../utils/logger');

// 模拟 AI 服务返回
const originalAnalyzeResume = DomesticAIService.prototype.analyzeResume;
DomesticAIService.prototype.analyzeResume = async function (resumeText, jobDescription, user, scene) {
    console.log(`[Mock AI] Analyzing for scene: ${scene}`);
    
    // 验证 JD 是否传递
    if (scene === 'deep_analysis' || scene === 'supplement_report') {
        if (!jobDescription) {
            console.error(`[Mock AI] Error: Job Description is missing for scene ${scene}`);
        } else {
            console.log(`[Mock AI] Job Description received (length: ${typeof jobDescription === 'string' ? jobDescription.length : 'object'})`);
        }
    }

    if (scene === 'supplement_report') {
        return {
            success: true,
            data: {
                overall_score: 88,
                scores_percent: [
                    { dimension: '技能匹配', score: 90 },
                    { dimension: '经验匹配', score: 85 },
                    { dimension: '项目履历匹配', score: 80 },
                    { dimension: '学历背景', score: 95 },
                    { dimension: '发展潜力', score: 85 },
                    { dimension: '团队协作', score: 90 }
                ],
                summary: '补充分析总结',
                strengths: ['优势1', '优势2'],
                weaknesses: ['劣势1'],
                suggestions: ['建议1'],
                hiring_advice: '录用建议'
            }
        };
    }

    return {
        success: true,
        data: {
            overall_score: 85,
            scores_percent: [
                { dimension: '技能匹配', score: 85 },
                { dimension: '经验匹配', score: 80 }
            ],
            summary: '深度解析总结',
            strengths: ['优势A'],
            weaknesses: ['劣势B'],
            suggestions: ['建议C'],
            hiring_advice: '录用建议D'
        }
    };
};

async function verify() {
    console.log('--- Starting Deep Analysis & Supplement Report Verification ---');
    
    try {
        // 1. 获取测试用户
        const user = await User.findOne({ where: { username: '18605355138' } });
        if (!user) {
            console.error('Test user 18605355138 not found');
            return;
        }
        console.log(`Found test user: ${user.username} (ID: ${user.id})`);

        // 2. 创建测试简历
        const resume = await Resume.create({
            user_id: user.id,
            company_id: user.company_id,
            file_name: 'test_resume_deep.pdf',
            file_size: 1024,
            file_type: 'pdf',
            status: 'parsed',
            parsed_data: { content: '这是一份测试简历内容，包含多年 Java 开发经验。' }
        });
        console.log(`Created test resume ID: ${resume.id}`);

        // 3. 测试“深度解析”流程 (通过 processAnalysisBackground)
        console.log('\n--- Testing Deep Analysis ---');
        const jobDescription = "需要 5 年以上 Java 经验，精通 Spring Boot。";
        
        await aiController.processAnalysisBackground(
            resume.id, 
            resume.parsed_data.content, 
            jobDescription, 
            { id: user.id, company_id: user.company_id }, 
            { scene: 'deep_analysis' }
        );

        // 检查结果
        const analysisResult = await AnalysisResult.findOne({
            where: { resume_id: resume.id, type: 'single' }
        });

        if (analysisResult && analysisResult.overall_score == 85) {
            console.log('✅ Deep Analysis successful! Score: 85');
            console.log('Dimensions:', JSON.stringify(analysisResult.dimensions));
        } else {
            console.error('❌ Deep Analysis failed or score mismatch');
            if (analysisResult) console.log('Actual result:', JSON.stringify(analysisResult));
        }

        // 4. 测试“补充AI深度分析报告”流程 (通过 processSupplementBackground)
        console.log('\n--- Testing Supplement Report ---');
        
        // 需要一个 ResumeJob 记录
        const resumeJob = await ResumeJob.create({
            resume_id: resume.id,
            job_id: 1, // 假设存在 ID 为 1 的职位
            user_id: user.id,
            company_id: user.company_id,
            match_score: 60,
            status: 'pending'
        });

        const mockReq = {
            user: { id: user.id, company_id: user.company_id },
            body: {
                resumeId: resume.id,
                recordId: resumeJob.id,
                jobDescription: jobDescription
            }
        };

        const mockRes = {
            status: function(code) { this.statusCode = code; return this; },
            json: function(data) { this.data = data; return this; }
        };

        // 调用 controller
        await aiController.processSupplementBackground(mockReq, mockRes);
        
        // 等待异步处理完成（因为 processSupplementBackground 内部是异步的）
        console.log('Waiting for background supplement process...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 检查 ResumeJob 更新
        const updatedResumeJob = await ResumeJob.findByPk(resumeJob.id);
        if (updatedResumeJob && updatedResumeJob.overall_score == 88) {
            console.log('✅ Supplement Report successful! Score: 88');
            console.log('Updated dimensions:', JSON.stringify(updatedResumeJob.dimensions));
            const details = updatedResumeJob.detailed_analysis || {};
            if (details.evaluation_report && details.evaluation_report.summary === '补充分析总结') {
                console.log('✅ Supplement Report content verified in detailed_analysis');
            } else {
                console.error('❌ Supplement Report content missing in detailed_analysis');
            }
        } else {
            console.error('❌ Supplement Report failed or score mismatch');
            if (updatedResumeJob) console.log('Actual ResumeJob:', JSON.stringify(updatedResumeJob));
        }

        // 5. 清理数据
        console.log('\n--- Cleaning up ---');
        await AnalysisResult.destroy({ where: { resume_id: resume.id } });
        await ResumeJob.destroy({ where: { id: resumeJob.id } });
        await resume.destroy();
        console.log('Cleanup completed');

    } catch (error) {
        console.error('Verification failed with error:', error);
    } finally {
        await sequelize.close();
    }
}

verify();
