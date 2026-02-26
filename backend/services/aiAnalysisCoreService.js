const { Resume, Job, User, ResumeJob, AnalysisResult } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');
const DomesticAIService = require('./domesticAIService');
const OptimizedResumeParseService = require('./optimizedResumeParseService');
const aiService = new DomesticAIService();

class AIAnalysisCoreService {
  /**
   * 核心分析逻辑（原 aiController.processAnalysisBackground）
   */
  async processAnalysis(resumeId, text, jobDescription, user, options = {}, preservedDimensions = null, preservedScore = null, force = false) {
    try {
      logger.info('Starting core background analysis', { resumeId, force });

      // 1. 基础正则解析
      let localParsedData = {};
      try {
        const parseService = new OptimizedResumeParseService();
        const resume = await Resume.findByPk(resumeId);
        const fileType = resume ? (resume.file_type || 'txt') : 'txt';
        localParsedData = await parseService.parseResumeContent(text, fileType);
      } catch (parseErr) {
        logger.error(`[AIAnalysisCoreService] Local parsing failed: ${parseErr.message}`);
      }

      const scene = (options && options.scene) ? options.scene : 'deep_analysis';
      const result = await aiService.analyzeResume(text, jobDescription, user, scene, 8, force);

      if (result.success) {
        let analysisData = aiService.parseJSONResponse(result.data);

        // 激进解析逻辑
        if (!analysisData && typeof result.data === 'string') {
          try {
            const firstBrace = result.data.indexOf('{');
            const lastBrace = result.data.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
              analysisData = JSON.parse(result.data.substring(firstBrace, lastBrace + 1));
            }
          } catch (e) {
            logger.warn(`[AIAnalysisCoreService] Aggressive JSON parsing failed: ${e.message}`);
          }
        }

        // 正则提取兜底
        if (!analysisData) {
          logger.warn(`[AIAnalysisCoreService] Falling back to regex extraction for resume ${resumeId}`);
          if (typeof result.data === 'string') {
            const scoreMatch = result.data.match(/(?:overall_score|score|得分|匹配度|总分)\s*[:：]\s*(\d+)/i);
            analysisData = { overall_score: scoreMatch ? parseInt(scoreMatch[1]) : 0 };

            const summaryMatch = result.data.match(/(?:总结|评价|分析|summary)\s*[:：]\s*([^。\n!！]+)/i);
            if (summaryMatch) analysisData.summary = summaryMatch[1].trim();

            const dimPatterns = {
              skills: /(?:技能|专业|技术|能力|skills)\s*[:：]\s*(\d+)/i,
              experience: /(?:经验|履历|背景|历程|experience)\s*[:：]\s*(\d+)/i,
              project: /(?:项目|履历|匹配|稳定|跳槽|project|stability)\s*[:：]\s*(\d+)/i,
              education: /(?:学历|教育|学校|学术|education)\s*[:：]\s*(\d+)/i,
              potential: /(?:潜力|发展|成长|爆发|potential)\s*[:：]\s*(\d+)/i,
              teamwork: /(?:协作|团队|沟通|社交|teamwork|collaboration)\s*[:：]\s*(\d+)/i
            };

            analysisData.scores_percent = {};
            for (const [key, pattern] of Object.entries(dimPatterns)) {
              const match = result.data.match(pattern);
              if (match) analysisData.scores_percent[key] = parseInt(match[1]);
            }
          } else {
            analysisData = { overall_score: 0 };
          }
        }

        const isQuickScreening = scene === 'resume_quick_score' || (scene === 'analysis' && !options?.isDeepAnalysis);

        let overallScore = (analysisData && typeof analysisData === 'object')
          ? (analysisData.overall_score || analysisData.overallScore || analysisData.match_score || analysisData.score || 0)
          : 0;

        let finalOverallScore = parseInt(overallScore) || 0;
        if (finalOverallScore > 100) finalOverallScore = 100;
        if (finalOverallScore < 0) finalOverallScore = 0;

        // 核心加固：多维度映射逻辑 (支持 Array 和 Object)
        let radar = {};
        const dimensionMappings = {
          skills: ['技能匹配', 'skills', 'skill_match', 'professional', 'core_skills', 'job_fit', '专业技能', '技能评分', '技术能力', '业务能力', '组织协同力'],
          experience: ['经验匹配', 'experience', 'experience_match', 'experience_fit', 'background', '工作经验', '经验契合', '经验评分', '履历背景', '项目经验', '抗压与韧性'],
          project: ['项目履历匹配', 'project', 'project_match', 'project_fit', 'stability', 'work_stability', 'tenure', '稳定性', '离职风险', '职业稳定性', '项目背景', '履历匹配', '项目经验匹配', '项目实战', '项目表现'],
          education: ['学历背景', 'education', 'education_background', 'academic', '教育背景', '学历评分', '学术背景', '学校背景', '学习敏锐度'],
          potential: ['发展潜力', 'potential', 'growth_potential', 'development', 'learning_ability', '潜力评分', '成长性', '爆发力', '进取心', '文化契合度'],
          teamwork: ['团队协作', 'teamwork', 'collaboration', 'social', '协作能力', '团队精神', '沟通能力', '领导力', '组织协同力']
        };

        const rawRadar = analysisData.scores_percent || analysisData.radar_scores || analysisData.radarScores || analysisData.dimensions || analysisData.competency_matrix || {};

        if (Array.isArray(rawRadar)) {
          // 处理 Array 格式 (新版深度解析/补充报告)
          rawRadar.forEach(item => {
            const dim = (item.dimension || '').toLowerCase();
            const score = parseInt(item.score) || 0;
            for (const [key, patterns] of Object.entries(dimensionMappings)) {
              if (patterns.some(p => dim.includes(p.toLowerCase()))) {
                radar[key] = Math.max(radar[key] || 0, score);
              }
            }
          });
        } else if (typeof rawRadar === 'object') {
          // 处理 Object 格式 (快评/旧版)
          for (const [key, patterns] of Object.entries(dimensionMappings)) {
            for (const p of patterns) {
              if (rawRadar[p] !== undefined) {
                radar[key] = parseInt(rawRadar[p]) || 0;
                break;
              }
              const foundKey = Object.keys(rawRadar).find(k => k.toLowerCase() === p.toLowerCase());
              if (foundKey) {
                radar[key] = parseInt(rawRadar[foundKey]) || 0;
                break;
              }
            }
          }
        }

        // 统一键名确保 6 个维度都存在，同时提供 project 和 stability 互为别名，匹配前后端不同需求
        const normalizedRadar = {
          skills: radar.skills || 0,
          experience: radar.experience || 0,
          project: radar.project || radar.stability || 0,
          stability: radar.stability || radar.project || 0,
          education: radar.education || 0,
          potential: radar.potential || 0,
          teamwork: radar.teamwork || 0
        };

        const report = (analysisData && analysisData.evaluation_report) || (analysisData && analysisData.report) || (analysisData && analysisData.analysis_report) || (analysisData && analysisData.penetration_report) || {};

        // 核心加固：保存结果到数据库
        if (!isQuickScreening) {
          let recordJobId = jobDescription?.id || options?.jobId || null;

          // 事务处理：先删后增
          if (scene === 'deep_analysis') {
            await AnalysisResult.destroy({
              where: { resume_id: resumeId, user_id: user.id, type: 'single' }
            });
          }

          await AnalysisResult.create({
            resume_id: resumeId,
            user_id: user.id,
            company_id: user.company_id || null,
            job_id: recordJobId,
            overall_score: finalOverallScore,
            dimensions: normalizedRadar,
            summary: analysisData.summary || report.summary || '',
            strengths: report.strengths || analysisData.strengths || [],
            weaknesses: report.weaknesses || analysisData.weaknesses || [],
            suggestions: report.suggestions || analysisData.suggestions || [],
            hiring_advice: report.hiring_advice || analysisData.hiring_advice || '',
            detailed_analysis: analysisData,
            ai_provider: result.service,
            ai_model: result.model,
            processing_time: result.responseTime,
            analysis_date: new Date(),
            type: 'single'
          });
        }

        // 更新简历状态与合并数据 (保持原有逻辑)
        const currentResume = await Resume.findByPk(resumeId);
        if (currentResume) {
          const mergedParsedData = {
            ...(currentResume.parsed_data || {}),
            ...localParsedData,
            ...analysisData,
            // ... 更多合并逻辑
          };

          await Resume.update({
            status: 'analyzed',
            score: finalOverallScore,
            parsed_data: mergedParsedData,
            last_analysis_date: new Date()
          }, { where: { id: resumeId } });

          // 更新 ResumeJob
          let targetJobId = jobDescription?.id || options?.jobId;
          if (targetJobId) {
            // 检查列是否存在
            const [columns] = await ResumeJob.sequelize.query(`DESCRIBE resume_jobs`);
            const hasDeepAnalysisStatus = columns.some(c => c.Field === 'deep_analysis_status');

            const updateData = { match_score: finalOverallScore };
            if (hasDeepAnalysisStatus) {
              updateData.deep_analysis_status = 'completed';
            }

            await ResumeJob.update(updateData, { where: { resume_id: resumeId, job_id: targetJobId } });
          }
        }

        return { success: true, score: finalOverallScore };
      } else {
        throw new Error(result.error || 'AI service returned failure');
      }
    } catch (error) {
      logger.error(`[AIAnalysisCoreService] Analysis failed for resumeId ${resumeId}:`, error);
      await Resume.update({ status: 'failed' }, { where: { id: resumeId } });

      // 检查列是否存在
      try {
        const [columns] = await ResumeJob.sequelize.query(`DESCRIBE resume_jobs`);
        if (columns.some(c => c.Field === 'deep_analysis_status')) {
          await ResumeJob.update({ deep_analysis_status: 'failed' }, { where: { resume_id: resumeId } });
        }
      } catch (err) {
        logger.warn('Failed to update deep_analysis_status', err.message);
      }
      throw error;
    }
  }
}

module.exports = new AIAnalysisCoreService();
