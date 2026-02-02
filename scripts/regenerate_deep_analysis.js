
const { User, Resume, Job, AnalysisResult, sequelize } = require('../backend/models');
const DomesticAIService = require('../backend/services/domesticAIService');
const aiService = new DomesticAIService();

async function regenerateDeepAnalysis(resumeId) {
    try {
        console.log(`--- Regenerating Deep Analysis for Resume ID: ${resumeId} ---`);
        
        const resume = await Resume.findByPk(resumeId);
        if (!resume) {
            console.error(`Resume ID ${resumeId} not found`);
            return;
        }

        const user = await User.findByPk(resume.user_id);
        const userCtx = user ? { id: user.id, company_id: user.company_id, role: user.role } : null;

        let jobDescription = '';
        let jobId = null;
        const resumeJobs = await sequelize.query(
            `SELECT job_id FROM resume_jobs WHERE resume_id = ${resumeId} LIMIT 1`,
            { type: sequelize.QueryTypes.SELECT }
        );
        if (resumeJobs.length > 0) {
            jobId = resumeJobs[0].job_id;
            const job = await Job.findByPk(jobId);
            if (job) {
                jobDescription = job.description || '';
            }
        }

        console.log(`Job ID: ${jobId}, User ID: ${resume.user_id}`);
        console.log(`Resume Name: ${resume.name}`);

        console.log('Calling AI Service for deep analysis...');
        let resumeText = '';
        if (resume.parsed_data) {
            resumeText = typeof resume.parsed_data === 'string' ? resume.parsed_data : JSON.stringify(resume.parsed_data);
        } else if (resume.raw_text) {
            resumeText = resume.raw_text;
        } else {
            resumeText = resume.file_name;
        }
        const result = await aiService.analyzeResume(
            resumeText,
            jobDescription,
            userCtx,
            'deep_analysis'
        );

        if (result.success) {
            console.log('✅ AI Deep Analysis generated successfully');
            
            let analysisData = result.data;
            if (typeof analysisData === 'string') {
                analysisData = aiService.parseJSONResponse(analysisData) || { overall_score: 0 };
            }

            let overallScore = (analysisData && typeof analysisData === 'object')
                ? (analysisData.overall_score || analysisData.overallScore || analysisData.match_score || analysisData.score || 0)
                : 0;
            overallScore = parseInt(overallScore);
            if (isNaN(overallScore)) overallScore = 0;
            if (overallScore > 100) overallScore = 100;
            if (overallScore < 0) overallScore = 0;

            const report = (analysisData && analysisData.evaluation_report) || (analysisData && analysisData.report) || (analysisData && analysisData.analysis_report) || {};
            const radar = {};
            const rawRadar = (analysisData && analysisData.scores_percent) || (analysisData && analysisData.radar_scores) || (analysisData && analysisData.radarScores) || (analysisData && analysisData.score_detail) || (analysisData && analysisData.dimensions) || analysisData || {};
            const dimensionKeys = ['skills', 'experience', 'education', 'stability', 'potential', 'teamwork'];
            const dimensionMappings = {
                skills: ['skills', 'skill_match', 'professional', 'core_skills', 'job_fit', '专业技能', '技能评分', '技能匹配'],
                experience: ['experience', 'experience_match', 'experience_fit', 'background', '工作经验', '经验契合', '经验评分'],
                education: ['education', 'education_background', 'academic', '学历背景', '教育背景', '学历评分'],
                stability: ['stability', 'work_stability', 'tenure', '稳定性', '离职风险', '职业稳定性'],
                potential: ['potential', 'growth_potential', 'development', 'learning_ability', '发展潜力', '潜力评分', '成长性'],
                teamwork: ['teamwork', 'collaboration', 'social', '团队协作', '协作能力', '团队精神']
            };
            dimensionKeys.forEach(key => {
                let val = 0;
                const possibleKeys = dimensionMappings[key];
                for (const pKey of possibleKeys) {
                    if (rawRadar[pKey] !== undefined) {
                        val = rawRadar[pKey];
                        break;
                    }
                    const foundKey = Object.keys(rawRadar).find(k => k.toLowerCase() === pKey.toLowerCase());
                    if (foundKey) {
                        val = rawRadar[foundKey];
                        break;
                    }
                }
                if (typeof val === 'object' && val !== null) {
                    val = val.score || val.value || val.rating || 0;
                }
                radar[key] = parseInt(val) || 0;
            });

            const strengths = report.strengths || report.core_strengths || analysisData.strengths || [];
            const weaknesses = report.weaknesses || report.potential_issues || report.risks || analysisData.weaknesses || [];
            const suggestions = report.suggestions || report.career_advice || analysisData.suggestions || [];
            const summary = report.summary || analysisData.summary || report.hiring_advice || '';

            if (user) {
                await AnalysisResult.destroy({
                    where: {
                        resume_id: resumeId,
                        user_id: user.id,
                        company_id: user.company_id || null,
                        type: 'single'
                    }
                });
            }

            await AnalysisResult.create({
                resume_id: resumeId,
                user_id: resume.user_id,
                company_id: user ? user.company_id : null,
                job_id: jobId,
                overall_score: overallScore,
                dimensions: radar,
                summary: summary,
                strengths: strengths,
                weaknesses: weaknesses,
                suggestions: suggestions,
                hiring_advice: report.hiring_advice || analysisData.hiring_advice || '',
                detailed_analysis: analysisData,
                ai_provider: result.service,
                ai_model: result.model,
                processing_time: result.responseTime,
                analysis_date: new Date(),
                type: 'single'
            });

            await resume.update({
                status: 'analyzed',
                last_analysis_date: new Date(),
                analysis_count: (resume.analysis_count || 0) + 1
            });

            console.log('✅ AnalysisResult created');
            console.log(`Overall Score: ${overallScore}`);
            console.log(`Summary: ${summary || 'N/A'}`);

        } else {
            console.error('❌ AI Deep Analysis failed');
            console.error('Error:', result.error);
        }

    } catch (error) {
        console.error('Operation failed:', error);
    } finally {
        await sequelize.close();
    }
}

// Get resume ID from command line or default to 54
const resumeId = process.argv[2] || 54;
regenerateDeepAnalysis(resumeId);
