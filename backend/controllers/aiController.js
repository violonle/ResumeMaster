const DomesticAIService = require('../services/domesticAIService');
const axios = require('axios');
const cheerio = require('cheerio');
const { Op } = require('sequelize');
const { extractTextFromFile, buildFallbackTextFromParsed } = require('../services/textExtractor');
const { AnalysisResult, Resume, Job, User, ResumeJob } = require('../models');
const logger = require('../utils/logger');
const promptService = require('../services/promptService');
const { UserActivity } = require('../models');
const { redis, acquireLock, releaseLock } = require('../utils/redis');
const { addAnalysisJob } = require('../services/queueService');

const aiService = new DomesticAIService();

const OptimizedResumeParseService = require('../services/optimizedResumeParseService');

class AIController {
  // 触发深度解析轮询（手动/调试）
  async triggerDeepAnalysisPolling(req, res) {
    try {
      const deepAnalysisService = require('../services/deepAnalysisService');
      // 启动处理流程，不等待其全部完成，立即返回响应以防 Socket Hangup
      // 实际上，如果 processPolling 已经在运行，它会立即返回
      deepAnalysisService.processPolling().catch(err => {
        logger.error('[AIController] Manual polling trigger background task failed:', err);
      });

      // 立即发送响应，不再等待任何异步操作
      return res.json({ success: true, message: '轮询任务已在后台启动' });
    } catch (error) {
      logger.error('Trigger polling error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  // 简历分析
  async analyzeResume(req, res) {
    try {
      const { resumeText, jobDescription, resumeId, options, force, preservedDimensions, preservedScore } = req.body;
      const userId = req.user.id;

      let text = resumeText || '';
      if (!text && resumeId) {
        try {
          const r = await Resume.findOne({
            where: {
              id: resumeId,
              [Op.or]: [
                { user_id: userId },
                req.user.company_id ? { company_id: req.user.company_id } : null
              ].filter(Boolean)
            }
          });
          if (r) {
            const fp = r.file_path;
            text = await extractTextFromFile(fp);
            if (!text) text = buildFallbackTextFromParsed(r.parsed_data || {});
          } else {
            return res.status(403).json({ success: false, error: '无权访问此简历' });
          }
        } catch (_) { }
      }
      if (!text) {
        return res.status(400).json({ success: false, error: '简历内容不能为空' });
      }

      // 记录用户活动
      await UserActivity.create({
        user_id: userId,
        company_id: req.user.company_id || null,
        action: 'ai_analysis',
        details: {
          analysisType: 'resume',
          hasJobDescription: !!jobDescription,
          force: !!force
        }
      });

      // 如果有resumeId，使用异步处理
      if (resumeId) {
        const finalOptions = { ...(options || {}) };
        if (force) finalOptions.scene = 'deep_analysis';
        if (!finalOptions.scene) finalOptions.scene = 'deep_analysis';

        const cacheKey = `deep_parse:${resumeId}`;
        const lockKey = `lock:deep_parse:${resumeId}`;

        // 1. 检查 Redis 缓存 (24h)
        if (!force && finalOptions.scene === 'deep_analysis') {
          const cachedResult = await redis.get(cacheKey);
          if (cachedResult) {
            logger.info(`[AI Controller] Found cached result for resumeId: ${resumeId}`);
            return res.json({
              success: true,
              status: 'analyzed',
              resumeId: resumeId,
              data: JSON.parse(cachedResult),
              fromCache: true
            });
          }
        }

        // 2. 增加 Redis 分布式锁，防止同一 resumeId 重复任务
        const lockAcquired = await acquireLock(lockKey, 180000); // 180s 锁
        if (!lockAcquired) {
          return res.status(202).json({
            success: true,
            status: 'processing',
            resumeId: resumeId,
            message: '任务正在处理中，请勿重复提交'
          });
        }

        // 3. 检查数据库记录 (原有逻辑)
        if (!force && finalOptions.scene === 'deep_analysis') {
          const existingDeepRecord = await AnalysisResult.findOne({
            where: {
              resume_id: resumeId,
              [Op.or]: [
                { user_id: userId },
                req.user.company_id ? { company_id: req.user.company_id } : null
              ].filter(Boolean),
              type: 'single'
            },
            order: [['id', 'DESC']]
          });

          const parseDimensions = (d) => {
            if (!d) return {};
            if (typeof d === 'string') {
              try { return JSON.parse(d); } catch (_) { return {}; }
            }
            return d;
          };
          const dims = parseDimensions(existingDeepRecord?.dimensions);
          const hasDimensions = existingDeepRecord && dims &&
            Object.values(dims).some(v => v > 0);
          const detail = existingDeepRecord ? (existingDeepRecord.detailed_analysis || {}) : {};
          const hasDeepContent = !!(
            existingDeepRecord &&
            (
              existingDeepRecord.summary ||
              existingDeepRecord.hiring_advice ||
              (detail && (detail.summary || detail.hiring_advice)) ||
              (Array.isArray(existingDeepRecord.strengths) && existingDeepRecord.strengths.length > 0) ||
              (Array.isArray(existingDeepRecord.weaknesses) && existingDeepRecord.weaknesses.length > 0) ||
              (Array.isArray(existingDeepRecord.suggestions) && existingDeepRecord.suggestions.length > 0) ||
              (Array.isArray(detail.strengths) && detail.strengths.length > 0) ||
              (Array.isArray(detail.weaknesses) && detail.weaknesses.length > 0) ||
              (Array.isArray(detail.suggestions) && detail.suggestions.length > 0)
            )
          );

          if (existingDeepRecord && existingDeepRecord.overall_score > 0 && hasDimensions && hasDeepContent) {
            console.log(`[AI Controller] Found valid AnalysisResult(single) for resumeId: ${resumeId}, skipping AI call.`);
            await releaseLock(lockKey); // 释放锁
            return res.json({
              success: true,
              status: 'analyzed',
              resumeId: resumeId,
              data: {
                analysis: existingDeepRecord.detailed_analysis || {},
                overall_score: existingDeepRecord.overall_score,
                dimensions: dims,
                createdAt: existingDeepRecord.analysis_date
              }
            });
          }
        }

        // 4. 更新状态为解析中并加入队列
        await Resume.update({ status: 'parsing' }, { where: { id: resumeId } });

        try {
          await addAnalysisJob({
            resumeId,
            text,
            jobDescription,
            user: req.user,
            options: finalOptions,
            force: !!force
          });

          res.json({
            success: true,
            status: 'processing',
            resumeId: resumeId,
            message: '任务已加入队列，正在后台处理中'
          });
        } catch (queueErr) {
          await releaseLock(lockKey);
          throw queueErr;
        }

        return;
      }

      // 没有resumeId的情况（直接文本分析），保持同步调用
      logger.info('Analyze request (sync)', { userId, hasJobDescription: !!jobDescription });
      const result = await aiService.analyzeResume(text, jobDescription, req.user, options ? options.scene : null);

      if (result.success) {
        let analysisData = result.data;

        if (typeof analysisData === 'string') {
          try {
            // 更强大的 JSON 提取逻辑
            const jsonMatch = analysisData.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              analysisData = JSON.parse(jsonMatch[0]);
            } else {
              throw new Error('未在响应中找到 JSON 结构');
            }
          } catch (parseError) {
            logger.error('解析 AI 结果失败', {
              error: parseError.message,
              content: analysisData.substring(0, 200) + '...'
            });
            // 如果解析失败，尝试从文本中正则表达式提取分数
            const scoreMatch = analysisData.match(/(?:overall_score|score|得分|匹配度)\s*[:：]\s*(\d+)/i);
            if (scoreMatch) {
              analysisData = { overall_score: parseInt(scoreMatch[1]) };
            }
          }
        }

        res.json({
          success: true,
          data: {
            analysis: analysisData,
            service: result.service,
            model: result.model,
            cost: result.cost,
            responseTime: result.responseTime
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error || 'AI分析失败'
        });
      }
    } catch (error) {
      logger.error('简历分析失败', { message: error.message, stack: error.stack });
      res.status(500).json({
        success: false,
        error: error.message || '简历分析失败'
      });
    }
  }

  // 后台处理分析任务
  async processAnalysisBackground(resumeId, text, jobDescription, user, options = {}, preservedDimensions = null, preservedScore = null, force = false) {
    try {
      console.log(`[AI Controller] Background analysis started for resumeId: ${resumeId}${preservedDimensions ? ' with preserved metrics' : ''}${force ? ' (FORCED)' : ''}`);
      logger.info('Starting background analysis', { resumeId });

      // 1. 先进行基础的正则解析，确保基础数据不丢失
      let localParsedData = {};
      try {
        console.log(`[AI Controller] Running local regex parsing for resumeId: ${resumeId}`);
        const parseService = new OptimizedResumeParseService();
        const resume = await Resume.findByPk(resumeId);
        // 确定文件扩展名
        const fileType = resume ? (resume.file_type || 'txt') : 'txt';
        localParsedData = await parseService.parseResumeContent(text, fileType);
        console.log(`[AI Controller] Local parsing completed. Name found: ${localParsedData.name}`);
      } catch (parseErr) {
        console.error(`[AI Controller] Local parsing failed: ${parseErr.message}`);
      }

      const scene = (options && options.scene) ? options.scene : 'deep_analysis';
      const result = await aiService.analyzeResume(text, jobDescription, user, scene, 8, force);

      if (result.success) {
        // 保存分析结果
        let analysisData = aiService.parseJSONResponse(result.data);

        if (!analysisData) {
          console.warn(`[AI Controller] JSON parsing failed for resume ${resumeId}. Raw data snippet: ${typeof result.data === 'string' ? result.data.substring(0, 200) : 'not a string'}`);
          // 尝试更激进的 JSON 提取
          if (typeof result.data === 'string') {
            try {
              // 查找最外层的 {}
              const firstBrace = result.data.indexOf('{');
              const lastBrace = result.data.lastIndexOf('}');
              if (firstBrace !== -1 && lastBrace !== -1) {
                analysisData = JSON.parse(result.data.substring(firstBrace, lastBrace + 1));
              }
            } catch (e) {
              console.error(`[AI Controller] Aggressive JSON parsing also failed: ${e.message}`);
            }
          }
        }

        if (!analysisData) {
          console.warn(`[AI Controller] Falling back to regex extraction for resume ${resumeId}`);
          if (typeof result.data === 'string') {
            const scoreMatch = result.data.match(/(?:overall_score|score|得分|匹配度|总分)\s*[:：]\s*(\d+)/i);
            analysisData = { overall_score: scoreMatch ? parseInt(scoreMatch[1]) : 0 };

            // 尝试提取简短总结
            const summaryMatch = result.data.match(/(?:总结|评价|分析|summary)\s*[:：]\s*([^。\n!！]+)/i);
            if (summaryMatch) analysisData.summary = summaryMatch[1].trim();

            // 尝试从文本中寻找可能的维度分数 (如果 JSON 解析完全失败)
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
        // 如果是自动快评（无论是快评还是深度解析），都应用自动筛选逻辑
        const isAutoScreening = isQuickScreening || (options && options.isAutoScreening);

        if (isQuickScreening && analysisData && typeof analysisData === 'object') {
          delete analysisData.scores_percent;
          delete analysisData.radar_scores;
          delete analysisData.radarScores;
          delete analysisData.score_detail;
          delete analysisData.dimensions;
        }

        const analysisPayload = isQuickScreening ? {} : analysisData;
        console.log(`[AI Controller] Final analysisData for resume ${resumeId}:`, JSON.stringify(analysisData).substring(0, 500));

        // 计算分数和提取关键信息用于存储
        let overallScore = (analysisData && typeof analysisData === 'object')
          ? (analysisData.overall_score || analysisData.overallScore || analysisData.match_score || analysisData.score || 0)
          : 0;

        // 确保分数是有效的整数
        let finalOverallScore = parseInt(overallScore);
        if (isNaN(finalOverallScore)) finalOverallScore = 0;
        if (finalOverallScore > 100) finalOverallScore = 100;
        if (finalOverallScore < 0) finalOverallScore = 0;

        const report = (analysisPayload && analysisPayload.evaluation_report) || (analysisPayload && analysisPayload.report) || (analysisPayload && analysisPayload.analysis_report) || {};
        let radar = {};

        // 如果提供了 preservedDimensions，则优先使用它来保持得分不变
        if (preservedDimensions && typeof preservedDimensions === 'object') {
          console.log(`[AI Controller] Using preserved dimensions for resume ${resumeId}:`, JSON.stringify(preservedDimensions));
          radar = { ...preservedDimensions };

          // 确保所有必要的维度都存在
          const dimensionKeys = ['skills', 'experience', 'project', 'education', 'potential', 'teamwork'];
          dimensionKeys.forEach(key => {
            if (radar[key] === undefined) {
              // 兼容旧数据的 stability 字段
              if (key === 'project' && radar['stability'] !== undefined) {
                radar['project'] = radar['stability'];
              } else {
                radar[key] = 0;
              }
            }
          });

          // 使用保留的总分，如果没有保留的总分，则使用当前计算的总分（如果有的话）
          if (preservedScore !== null && preservedScore !== undefined) {
            finalOverallScore = parseInt(preservedScore);
          } else if (finalOverallScore <= 0) {
            const values = Object.values(radar).filter(v => typeof v === 'number');
            finalOverallScore = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
          }
        } else if (!isQuickScreening) {
          const dimensionMappings = {
            skills: ['技能匹配', 'skills', 'skill_match', 'professional', 'core_skills', 'job_fit', '专业技能', '技能评分', '技能匹配', '技术能力', '业务能力', '技能匹配度', '专业素质'],
            experience: ['经验匹配', 'experience', 'experience_match', 'experience_fit', 'background', '工作经验', '经验契合', '经验评分', '履历背景', '项目经验', '行业经验', '工作背景'],
            project: ['项目履历匹配', 'project', 'project_match', 'project_fit', 'stability', 'work_stability', 'tenure', '稳定性', '离职风险', '职业稳定性', '项目背景', '履历匹配', '项目经验匹配', '项目实战', '项目表现', '项目履历', '工作稳定性'],
            education: ['学历背景', 'education', 'education_background', 'academic', '教育背景', '学历评分', '学术背景', '学校背景', '学历契合', '教育匹配'],
            potential: ['发展潜力', 'potential', 'growth_potential', 'development', 'learning_ability', '潜力评分', '成长性', '爆发力', '进取心', '学习能力', '职业潜力'],
            teamwork: ['团队协作', 'teamwork', 'collaboration', 'social', '协作能力', '团队精神', '沟通能力', '领导力', '组织协同力', '团队意识', '人际沟通']
          };

          // 1. 尝试从 competency_matrix 提取 (新版深度解析格式)
          if (analysisPayload && Array.isArray(analysisPayload.competency_matrix)) {
            analysisPayload.competency_matrix.forEach(item => {
              const dim = (item.dimension || '').toLowerCase();
              const score = parseInt(item.score) || 0;

              for (const [key, patterns] of Object.entries(dimensionMappings)) {
                if (patterns.some(p => dim.includes(p.toLowerCase()))) {
                  radar[key] = Math.max(radar[key] || 0, score);
                }
              }
            });
          }

          // 2. 尝试从各种可能的扁平字段提取 (兼容各种版本和 AI 响应)
          const rawRadar = (analysisPayload && analysisPayload.scores_percent) ||
            (analysisPayload && analysisPayload.radar_scores) ||
            (analysisPayload && analysisPayload.radarScores) ||
            (analysisPayload && analysisPayload.score_detail) ||
            (analysisPayload && analysisPayload.dimensions) ||
            analysisPayload || {};

          dimensionKeys.forEach(key => {
            let currentVal = radar[key] || 0;
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

            const parsedVal = parseInt(val) || 0;
            radar[key] = Math.max(currentVal, parsedVal);
          });

          // 3. 维度分数自动补全（仅在 AI 未返回有效分数时，基于简历事实进行补全）
          dimensionKeys.forEach(key => {
            if (!radar[key] || radar[key] === 0) {
              if (key === 'education') {
                // 基于学历事实自动评分
                const eduList = (analysisPayload && analysisPayload.education) || (localParsedData && localParsedData.education) || [];
                const firstEdu = eduList[0] || {};
                const degree = String(firstEdu.degree || '').toLowerCase();

                if (degree.includes('博')) radar[key] = 95;
                else if (degree.includes('硕')) radar[key] = 88;
                else if (degree.includes('本')) radar[key] = 80;
                else if (degree.includes('专')) radar[key] = 65;
                else radar[key] = 50; // 无学历信息给基础分
              } else if (key === 'skills' || key === 'experience' || key === 'project') {
                // 技能、经验、项目如果为0，通常是因为 AI 提取失败，给一个基于总分的合理分（不固定为70）
                radar[key] = Math.max(45, Math.min(85, Math.round(finalOverallScore * 0.9)));
              } else {
                // 潜力、团队协作等软素质给一个基于总分的中肯分
                radar[key] = Math.max(50, Math.min(80, Math.round(finalOverallScore * 0.8)));
              }
              console.log(`[AI Controller] Dimension '${key}' was 0, auto-filled based on resume facts: ${radar[key]}`);
            }
          });
        }

        const strengths = report.strengths || report.core_strengths || analysisPayload.strengths || [];
        const weaknesses = report.weaknesses || report.potential_issues || report.risks || analysisPayload.weaknesses || [];
        const suggestions = report.suggestions || report.career_advice || analysisPayload.suggestions || [];
        const summary = report.summary || analysisPayload.summary || report.hiring_advice || '';

        console.log(`[AI Controller] Extracted Overall Score: ${finalOverallScore}`);
        console.log(`[AI Controller] Extracted Radar: ${JSON.stringify(radar)}`);

        // 核心修复：防止保存无效的空分析结果
        // 如果总分为0且所有维度均为0，且没有摘要或建议，视为分析失败
        const hasValidRadar = Object.values(radar).some(v => v > 0);
        const hasValidContent = !!(summary || (strengths && strengths.length) || (weaknesses && weaknesses.length) || (suggestions && suggestions.length));

        if (finalOverallScore === 0 && !hasValidRadar && !hasValidContent && !isQuickScreening) {
          console.error(`[AI Controller] Analysis result invalid (all zeros/empty). Aborting save for resumeId: ${resumeId}`);
          throw new Error('AI Analysis returned empty/invalid result');
        }

        if (!isQuickScreening) {
          console.log(`[AI Controller] Saving AnalysisResult to DB for resumeId: ${resumeId}`);

          let recordJobId = null;
          if (jobDescription && typeof jobDescription === 'object' && jobDescription.id) {
            recordJobId = jobDescription.id;
          } else if (options && options.jobId) {
            recordJobId = options.jobId;
          }

          // 核心改进：延迟删除旧记录，直到新记录准备好保存
          let oldRecordId = null;
          if (scene === 'deep_analysis') {
            const oldRecord = await AnalysisResult.findOne({
              where: {
                resume_id: resumeId,
                user_id: user.id,
                company_id: user.company_id || null,
                type: 'single'
              },
              attributes: ['id']
            });
            if (oldRecord) oldRecordId = oldRecord.id;
          }

          // 关键修复：验证数据完整性，防止保存全0的无效结果
          const hasValidScore = finalOverallScore > 0;
          const hasValidDimensions = radar && Object.values(radar).some(v => Number(v) > 0);

          if (hasValidScore || hasValidDimensions) {
            // 如果有旧记录，先删除
            if (oldRecordId) {
              await AnalysisResult.destroy({ where: { id: oldRecordId } });
            }

            await AnalysisResult.create({
              resume_id: resumeId,
              user_id: user.id,
              company_id: user.company_id || null,
              job_id: recordJobId,
              overall_score: finalOverallScore,
              dimensions: radar,
              summary: summary,
              strengths: strengths,
              weaknesses: weaknesses,
              suggestions: suggestions,
              hiring_advice: report.hiring_advice || analysisPayload.hiring_advice || '',
              detailed_analysis: analysisPayload,
              ai_provider: result.service,
              ai_model: result.model,
              processing_time: result.responseTime,
              analysis_date: new Date(),
              type: 'single'
            });
            console.log(`[AI Controller] Analysis record created for resumeId: ${resumeId}`);
          } else {
            console.warn(`[AI Controller] Skipping AnalysisResult creation for resumeId: ${resumeId} due to empty scores (score: ${finalOverallScore}, dimensions: ${JSON.stringify(radar)})`);
            // 如果解析结果全为0，不删除旧记录，让用户至少能看到旧数据（如果有的话）
          }
        } else {
          console.log(`[AI Controller] Quick screening only, skipping AnalysisResult creation for resumeId: ${resumeId}`);
        }

        // 获取当前简历数据以便合并而非覆盖
        const currentResume = await Resume.findOne({
          where: {
            id: resumeId,
            [Op.or]: [
              { user_id: user.id },
              user.company_id ? { company_id: user.company_id } : null
            ].filter(Boolean)
          }
        });
        if (!currentResume) {
          console.error(`[AI Controller] Resume ${resumeId} not found or access denied during saving merged data`);
          return;
        }
        const currentParsedData = currentResume.parsed_data || {};

        // 智能合并策略：
        // 1. 优先使用本地正则解析的数据 (localParsedData)，因为它更稳定
        // 2. 其次使用当前 DB 中的数据 (currentParsedData)
        // 3. 最后合并 AI 分析的数据 (analysisData)
        const mergedParsedData = {
          ...currentParsedData,
          ...localParsedData, // 本地解析覆盖旧数据
          ...analysisPayload,

          // 保护关键列表字段
          // 优先级: AI > 本地解析 > 原有数据 (因为 AI 可能做了更好的结构化)
          // 但如果 AI 是空的，必须回退到本地解析
          work_experience: (analysisPayload.work_experience && analysisPayload.work_experience.length > 0)
            ? analysisPayload.work_experience
            : (localParsedData.work_experience && localParsedData.work_experience.length > 0
              ? localParsedData.work_experience
              : (currentParsedData.work_experience || [])),

          education: (analysisPayload.education && analysisPayload.education.length > 0)
            ? analysisPayload.education
            : (localParsedData.education && localParsedData.education.length > 0
              ? localParsedData.education
              : (currentParsedData.education || [])),

          projects: (analysisPayload.projects && analysisPayload.projects.length > 0)
            ? analysisPayload.projects
            : (localParsedData.projects && localParsedData.projects.length > 0
              ? localParsedData.projects
              : (currentParsedData.projects || [])),

          skills: (analysisPayload.skills && analysisPayload.skills.length > 0)
            ? analysisPayload.skills
            : (localParsedData.skills && localParsedData.skills.length > 0
              ? localParsedData.skills
              : (currentParsedData.skills || [])),

          // 保护基础信息
          basic_info: {
            ...(currentParsedData.basic_info || {}),
            ...(localParsedData.basic_info || {}), // 本地解析可能有更准的手机号/邮箱
            ...(analysisPayload.basic_info || {})
          },

          // 确保 rawText 不丢失
          rawText: currentParsedData.rawText || currentParsedData.raw_text || analysisPayload.rawText || text || ''
        };

        // 确保 name, email, phone 等核心字段有值 (从 mergedParsedData 中提取)
        const finalName = mergedParsedData.name || mergedParsedData.basic_info?.name || localParsedData.name || '';
        const finalEmail = mergedParsedData.email || mergedParsedData.basic_info?.email || localParsedData.email || '';
        const finalPhone = mergedParsedData.phone || mergedParsedData.basic_info?.phone || localParsedData.phone || '';
        const finalJob = mergedParsedData.job_title || mergedParsedData.basic_info?.job_title || localParsedData.job_title || '';
        const finalExp = parseInt(mergedParsedData.experience_years || mergedParsedData.basic_info?.work_years || localParsedData.experience_years || 0);
        const finalEdu = mergedParsedData.highest_education || mergedParsedData.basic_info?.education || localParsedData.highest_education || '';

        let recruitmentStatus = currentResume.recruitment_status || '投递';
        let finalStatus = 'analyzed';
        let autoRejected = false;
        let rejectionReason = null;

        if (isAutoScreening) {
          try {
            let jobId = null;
            if (jobDescription && typeof jobDescription === 'object' && jobDescription.id) {
              jobId = jobDescription.id;
            } else if (options && options.jobId) {
              jobId = options.jobId;
            }

            let rejectThreshold = 60;
            let enableAutoScreening = true;

            if (jobId) {
              const job = await Job.findByPk(jobId);
              if (job) {
                rejectThreshold = job.auto_reject_score || 60;
                enableAutoScreening = job.enable_auto_screening;
              }
            }

            if (enableAutoScreening) {
              if (finalOverallScore < rejectThreshold) {
                recruitmentStatus = '淘汰';
                autoRejected = true;
                rejectionReason = `自动淘汰：评分 ${finalOverallScore} (低于 ${rejectThreshold})`;
              } else {
                recruitmentStatus = '已快评';
              }
            } else {
              const currentStatus = currentResume.recruitment_status || '投递';
              if (currentStatus === '投递' || currentStatus === '新投递') {
                recruitmentStatus = currentStatus;
              } else {
                recruitmentStatus = '已快评';
              }
            }
          } catch (e) {
            console.error('[AI Controller] Error in auto screening logic:', e);
          }
        }

        // 最后更新简历状态
        // 关键修复：将 AI 分析得到的结构化数据回填到 Resume 表的 parsed_data 字段，
        // 确保 resume-details.html 能显示出 AI 提取的详细字段。
        await Resume.update({
          status: finalStatus,
          recruitment_status: recruitmentStatus,
          auto_rejected: autoRejected,
          rejection_reason: rejectionReason,
          last_analysis_date: new Date(),
          score: finalOverallScore,
          parsed_data: mergedParsedData,
          // 同时尝试更新部分核心字段，方便列表页筛选
          // 修复：只有当原姓名为无效值（如"未知"、"未命名"）时才更新，避免覆盖用户手动修改的姓名
          name: (!currentResume.name || ['姓名', '未知', '未命名', 'Unknown'].includes(currentResume.name)) ? (finalName || undefined) : undefined,
          email: finalEmail || undefined,
          phone: finalPhone || undefined,
          job_title: finalJob || undefined,
          experience_years: finalExp || undefined,
          highest_education: finalEdu || undefined
        }, { where: { id: resumeId } });

        // 同时更新关联的 ResumeJob 记录中的 match_score
        try {
          let targetJobId = null;
          if (jobDescription && typeof jobDescription === 'object' && jobDescription.id) {
            targetJobId = jobDescription.id;
          } else if (options && options.jobId) {
            targetJobId = options.jobId;
          }

          if (targetJobId) {
            const updateData = {
              match_score: finalOverallScore,
              status: (recruitmentStatus === '淘汰') ? 'rejected' : 'screening',
              notes: rejectionReason || undefined
            };

            // 如果当前是深度解析场景，更新深度解析状态
            if (scene === 'deep_analysis') {
              updateData.deep_analysis_status = 'completed';
            }

            // 确保至少有一个字段被更新
            await ResumeJob.update(updateData, {
              where: {
                resume_id: resumeId,
                job_id: targetJobId
              }
            });
            console.log(`[AI Controller] Updated ResumeJob match_score to ${finalOverallScore}, status to ${updateData.status} for jobId: ${targetJobId}`);

            // 自动深度解析联动：如果快评通过且开启了自动深度解析，且当前不是深度解析场景，则触发深度解析
            if (recruitmentStatus !== '淘汰' && scene === 'resume_quick_score') {
              const job = await Job.findByPk(targetJobId);
              // 只要开启了深度解析，就应该自动触发，不一定要开启 job.enable_auto_screening
              // 因为如果是手动触发的快评，或者是 autoScreeningService 触发的，都应该联动深度解析
              if (job && job.enable_deep_analysis) {
                console.log(`[AI Controller] Fast screening passed for resume ${resumeId}, triggering auto deep analysis...`);
                const deepAnalysisService = require('../services/deepAnalysisService');
                deepAnalysisService.triggerImmediate(resumeId, targetJobId).catch(err => {
                  console.error('[AI Controller] Failed to trigger immediate deep analysis:', err);
                });
              }
            }

            // 处理高分通知
            if (options.notify_high_score && finalOverallScore >= (options.high_score_threshold || 85)) {
              try {
                console.log(`[AI Controller] High score detected (${finalOverallScore}), triggering notification for jobId: ${targetJobId}`);
                // 这里可以扩展发送邮件、短信或系统通知的逻辑
                // 目前先记录日志并尝试发送邮件通知（如果配置了）
                const emailService = require('../services/emailService');
                const job = await Job.findByPk(targetJobId, { include: [{ model: User, as: 'User' }] });
                if (job && job.User && job.User.email) {
                  const resume = await Resume.findByPk(resumeId);
                  await emailService.sendMail(
                    job.User.email,
                    `【高分简历提醒】职位：${job.title}`,
                    `<p>您发布的职位 <strong>${job.title}</strong> 收到了一份高分简历：</p>
                                 <ul>
                                   <li>候选人：${resume.name || '未知'}</li>
                                   <li>评分：<span style="color: #e11d48; font-size: 1.2em; font-weight: bold;">${finalOverallScore}</span></li>
                                   <li>匹配场景：${scene === 'deep_analysis' ? '深度解析' : '自动快评'}</li>
                                 </ul>
                                 <p>请及时登录系统查看详情。</p>`,
                    `职位 ${job.title} 收到高分简历：候选人 ${resume.name || '未知'}，评分 ${finalOverallScore}。请及时查看。`
                  );
                }
              } catch (notifyErr) {
                console.error('[AI Controller] Failed to send high score notification:', notifyErr);
              }
            }
          }
        } catch (rjErr) {
          console.error('[AI Controller] Failed to update ResumeJob score:', rjErr);
        }

        console.log(`[AI Controller] Resume status updated to 'analyzed' and parsed_data populated for resumeId: ${resumeId}`);

        // 关键修复：确保 AnalysisResult 记录也已经创建成功
        // 在返回 analyzed 状态前，我们可以做一个最终确认
        const finalCheck = await AnalysisResult.findOne({
          where: { resume_id: resumeId, type: 'single' },
          order: [['id', 'DESC']]
        });

        if (!finalCheck) {
          console.warn(`[AI Controller] AnalysisResult not yet found for resumeId: ${resumeId}, status update might be premature.`);
        }

        logger.info('Background analysis completed', { resumeId, score: finalOverallScore });
      } else {
        throw new Error(result.error || 'AI service returned failure');
      }
    } catch (error) {
      console.error(`[AI Controller] Background analysis failed for resumeId ${resumeId}:`, error.message, error.stack);
      logger.error('Background analysis failed', { resumeId, error: error.message });
      await Resume.update({ status: 'failed' }, { where: { id: resumeId } });

      // 如果是深度解析失败，更新 ResumeJob 状态
      try {
        await ResumeJob.update(
          { deep_analysis_status: 'failed' },
          { where: { resume_id: resumeId, deep_analysis_status: 'processing' } }
        );
      } catch (rjErr) {
        console.error('[AI Controller] Failed to update ResumeJob failure status:', rjErr);
      }
    }
  }

  // 获取分析状态
  async getAnalysisStatus(req, res) {
    try {
      const { resumeId } = req.params;
      const resume = await Resume.findByPk(resumeId);

      if (!resume) {
        return res.status(404).json({ success: false, error: '简历不存在' });
      }

      // 关键修复：除了 Resume 表的状态，还需要确认 AnalysisResult 表中是否有深度分析数据
      let currentStatus = resume.status;

      if (currentStatus === 'analyzed') {
        const hasDeepData = await AnalysisResult.findOne({
          where: { resume_id: resumeId, type: 'single' }
        });
        if (!hasDeepData) {
          console.log(`[Status Check] Resume ${resumeId} marked as analyzed but AnalysisResult not found, downgrading status to parsing...`);
          currentStatus = 'parsing';
        }
      }

      res.json({
        success: true,
        data: {
          status: currentStatus,
          progress: currentStatus === 'analyzed' ? 100 : (currentStatus === 'parsing' ? 50 : 0)
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // 获取分析结果
  async getAnalysisResult(req, res) {
    try {
      const { resumeId } = req.params;

      console.log('getAnalysisResult called for resumeId:', resumeId);

      // 仅从 AnalysisResult 获取结果（深度解析结果）
      // 强制只获取 'single' 类型，避免对比分析内容混入
      const { Op } = require('sequelize');
      const where = {
        resume_id: resumeId,
        [Op.or]: [{ type: 'single' }, { type: null }]
      };
      if (req.user && req.user.company_id) {
        where.company_id = req.user.company_id;
      } else if (req.user && req.user.id) {
        where.user_id = req.user.id;
      }
      const rows = await AnalysisResult.findAll({ where, order: [['id', 'DESC']], limit: 20 });
      const parseMaybeJson = (v) => {
        if (!v) return null;
        if (typeof v === 'string') {
          try { return JSON.parse(v); } catch (_) { return null; }
        }
        return v;
      };
      const isValidSingleDeep = (r) => {
        if (!r) return false;
        const da = parseMaybeJson(r.detailed_analysis) || {};
        const dims = parseMaybeJson(r.dimensions) || (da && (da.scores_percent || da.dimensions || da.radar)) || {};
        const hasAnyDim = dims && typeof dims === 'object' && Object.values(dims).some(v => Number(v || 0) > 0);
        const score = Number(r.overall_score || (da && da.overall_score) || 0);
        const looksLikeMulti = !!(da && (da.comparison_data || da.comparison || (Array.isArray(da.candidates) && da.recommendation)));
        return !looksLikeMulti && score > 0 && hasAnyDim;
      };
      let result = rows.find(isValidSingleDeep) || rows[0] || null;

      if (!result) {
        const resume = await Resume.findByPk(resumeId);
        const score = resume ? parseInt(resume.score || 0) : 0;
        if (resume && !isNaN(score) && score > 0) {
          return res.json({
            success: true,
            data: {
              resume_id: resume.id,
              overall_score: score
            }
          });
        }
        return res.json({
          success: true,
          data: null
        });
      }

      // 统一映射逻辑（与 analysisController.getLatestAnalysisResult 保持一致）
      let details = result.detailed_analysis || {};
      if (typeof details === 'string') {
        try { details = JSON.parse(details); } catch (_) { details = {}; }
      }
      const basicInfo = details.basic_info || details.personalInfo || details.parsed_data?.basic_info || {};
      let dimensions = result.dimensions || details.radar || details.dimensions || details.scores_percent || {};
      if (typeof dimensions === 'string') {
        try { dimensions = JSON.parse(dimensions); } catch (_) { dimensions = {}; }
      }

      const mappedData = {
        ...details,
        ...result.toJSON(),
        personalInfo: basicInfo,
        basic_info: basicInfo,
        dimensions,
        detailed_analysis: details,
        scores: details.scores || {
          overall: result.overall_score,
          dimensions
        },
        report: (() => {
          let computedReport = details.evaluation_report || details.analysis_report || details.report || details.evaluation || null;
          const isComputedReportEmpty = !computedReport || computedReport === '暂无报告' || computedReport === '暂无详细报告内容' || (typeof computedReport === 'object' && Object.keys(computedReport).length === 0);
          if (isComputedReportEmpty) {
            const hasAnyDetail = !!(details.summary || (Array.isArray(details.strengths) && details.strengths.length) || (Array.isArray(details.weaknesses) && details.weaknesses.length) || (Array.isArray(details.suggestions) && details.suggestions.length) || details.hiring_advice);
            if (hasAnyDetail) {
              computedReport = {
                summary: details.summary || '',
                strengths: Array.isArray(details.strengths) ? details.strengths : [],
                weaknesses: Array.isArray(details.weaknesses) ? details.weaknesses : [],
                suggestions: Array.isArray(details.suggestions) ? details.suggestions : [],
                hiring_advice: details.hiring_advice || ''
              };
            }
          }
          if (!computedReport) computedReport = '暂无详细报告内容';
          return computedReport;
        })()
      };

      res.json({
        success: true,
        data: mappedData
      });
    } catch (error) {
      console.error('getAnalysisResult error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }


  // 职位匹配
  async matchJobs(req, res) {
    try {
      const { resumeText, jobs } = req.body;
      const userId = req.user.id;

      if (!resumeText || !jobs || !Array.isArray(jobs)) {
        return res.status(400).json({
          success: false,
          error: '参数不完整或格式错误'
        });
      }

      // 记录用户活动
      await UserActivity.create({
        user_id: userId,
        company_id: req.user.company_id || null,
        action: 'job_matching',
        details: {
          jobCount: jobs.length
        }
      });

      // 调用AI服务
      logger.info('Job match request', { userId, jobCount: jobs.length });
      const result = await aiService.matchJobs(resumeText, jobs, req.user);

      if (result.success) {
        res.json({
          success: true,
          data: {
            matches: result.data,
            service: result.service,
            model: result.model,
            cost: result.cost,
            responseTime: result.responseTime
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error || '职位匹配失败'
        });
      }
    } catch (error) {
      logger.error('职位匹配失败', { message: error.message, stack: error.stack });
      res.status(500).json({
        success: false,
        error: '职位匹配失败'
      });
    }
  }

  // 补充分析报告
  async supplementAnalysis(req, res) {
    try {
      const { resumeId } = req.params;
      const userId = req.user.id;

      console.log(`[SupplementAnalysis] Request received for resumeId: ${resumeId}, userId: ${userId}`);
      logger.info('收到补充分析请求', { resumeId, userId });

      if (!resumeId) {
        return res.status(400).json({ success: false, error: '简历ID不能为空' });
      }

      const resume = await Resume.findByPk(resumeId);
      if (!resume) {
        return res.status(404).json({ success: false, error: '简历不存在' });
      }

      // 提取文本
      let text = await extractTextFromFile(resume.file_path);
      if (!text) text = buildFallbackTextFromParsed(resume.parsed_data || {});

      if (!text) {
        return res.status(400).json({ success: false, error: '无法提取简历内容，请检查文件是否正确' });
      }

      // 异步处理补充报告
      res.json({
        success: true,
        message: '补充分析请求已提交，正在生成中...'
      });

      // 执行后台分析
      this.processSupplementBackground(resumeId, text, req.user).catch(err => {
        logger.error('补充分析任务失败', { resumeId, error: err.message });
      });

    } catch (error) {
      logger.error('补充分析请求失败', { message: error.message, stack: error.stack });
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // 后台补充分析任务
  async processSupplementBackground(resumeId, text, user) {
    try {
      logger.info('Starting supplement analysis', { resumeId });

      // 尝试获取职位描述
      let jobDescription = '';
      const existingAnalysis = await AnalysisResult.findOne({
        where: { resume_id: resumeId, type: 'single' },
        order: [['id', 'DESC']],
        include: [{ model: Job, as: 'Job' }]
      });

      if (existingAnalysis && existingAnalysis.Job) {
        const job = existingAnalysis.Job;
        jobDescription = [
          job.title ? `职位名称: ${job.title}` : '',
          job.description ? `职位描述: ${job.description}` : '',
          job.requirements ? `职位要求: ${job.requirements}` : '',
          job.responsibilities ? `岗位职责: ${job.responsibilities}` : ''
        ].filter(Boolean).join('\n\n');
      } else if (existingAnalysis && existingAnalysis.target_job) {
        jobDescription = typeof existingAnalysis.target_job === 'string' ?
          existingAnalysis.target_job : JSON.stringify(existingAnalysis.target_job);
      }

      // 调用 AI 服务，使用新提示词
      // 关键修复：使用 supplement_report 场景以匹配提示词模板
      const result = await aiService.analyzeResume(text, jobDescription, user, 'supplement_report');

      if (result.success) {
        let analysisData = result.data;
        if (!analysisData) throw new Error('解析补充分析结果失败');

        // 统一 JSON 解析逻辑
        if (typeof analysisData === 'string') {
          analysisData = aiService.parseJSONResponse(analysisData);
        }

        if (!analysisData) throw new Error('解析补充分析结果失败（JSON格式错误）');

        // 重新获取记录以防万一
        const record = await AnalysisResult.findOne({
          where: {
            resume_id: resumeId,
            type: 'single'
          },
          order: [['id', 'DESC']]
        });

        // 核心加固：多维度映射逻辑 (支持 Array 和 Object，保持与 aiAnalysisCoreService 一致)
        let radar = {};
        const dimensionMappings = {
          skills: ['技能匹配', 'skills', 'skill_match', 'professional', 'core_skills', 'job_fit', '专业技能', '技能评分', '技术能力', '业务能力'],
          experience: ['经验匹配', 'experience', 'experience_match', 'experience_fit', 'background', '工作经验', '经验契合', '经验评分', '履历背景', '项目经验'],
          project: ['项目履历匹配', 'project', 'project_match', 'project_fit', 'stability', 'work_stability', 'tenure', '稳定性', '离职风险', '职业稳定性', '项目背景', '履历匹配', '项目经验匹配', '项目实战', '项目表现'],
          education: ['学历背景', 'education', 'education_background', 'academic', '教育背景', '学历评分', '学术背景', '学校背景'],
          potential: ['发展潜力', 'potential', 'growth_potential', 'development', 'learning_ability', '潜力评分', '成长性', '爆发力', '进取心', '学习敏锐度', '抗压与韧性'],
          teamwork: ['团队协作', 'teamwork', 'collaboration', 'social', '协作能力', '团队精神', '沟通能力', '领导力', '组织协同力', '文化契合度']
        };

        const rawRadar = analysisData.scores_percent || analysisData.radar_scores || analysisData.radarScores || analysisData.dimensions || analysisData.competency_matrix || {};

        if (Array.isArray(rawRadar)) {
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

        // 统一归一化逻辑
        radar = {
          skills: radar.skills || 0,
          experience: radar.experience || 0,
          project: radar.project || radar.stability || 0,
          stability: radar.stability || radar.project || 0,
          education: radar.education || 0,
          potential: radar.potential || 0,
          teamwork: radar.teamwork || 0
        };

        const report = analysisData.penetration_report || analysisData.evaluation_report || analysisData;
        const evaluationReport = {
          summary: analysisData.summary || report.summary || '',
          strengths: analysisData.strengths || report.strengths || [],
          weaknesses: analysisData.weaknesses || report.weaknesses || [],
          suggestions: analysisData.suggestions || report.suggestions || [],
          hiring_advice: analysisData.hiring_advice || report.hiring_advice || ''
        };

        const newOverallScore = parseInt(analysisData.overall_score || analysisData.score || 0);

        if (record) {
          const currentDetails = record.detailed_analysis || {};

          // 更新详情中的报告部分
          const updatedDetails = {
            ...currentDetails,
            ...analysisData,
            evaluation_report: {
              ...(currentDetails.evaluation_report || {}),
              ...evaluationReport
            }
          };

          await record.update({
            overall_score: newOverallScore > 0 ? newOverallScore : record.overall_score,
            dimensions: Object.keys(radar).length > 0 ? radar : record.dimensions,
            detailed_analysis: updatedDetails,
            analysis_date: new Date()
          });

          logger.info('Supplement analysis completed and record updated', { resumeId, recordId: record.id });
        } else {
          // 如果记录不存在，创建一个新的
          // 关键修复：验证数据完整性
          const hasValidScore = (analysisData.overall_score || 0) > 0;
          const dims = analysisData.scores_percent || analysisData.dimensions || {};
          const hasValidDimensions = dims && Object.values(dims).some(v => Number(v) > 0);

          if (hasValidScore || hasValidDimensions) {
            await AnalysisResult.create({
              resume_id: resumeId,
              user_id: user.id,
              company_id: user.company_id,
              type: 'single',
              overall_score: analysisData.overall_score || 0,
              dimensions: dims,
              detailed_analysis: {
                ...analysisData,
                evaluation_report: evaluationReport
              },
              analysis_date: new Date()
            });
            logger.info('Supplement analysis completed and new record created', { resumeId });
          } else {
            logger.warn('Supplement analysis completed but data empty, skipping record creation', { resumeId });
          }
        }
      } else {
        throw new Error(result.error || 'AI 服务返回失败');
      }
    } catch (error) {
      logger.error('Background supplement analysis failed', { resumeId, error: error.message, stack: error.stack });
    }
  }

  // 内容生成
  async generateContent(req, res) {
    try {
      const { type, data } = req.body;
      const userId = req.user.id;

      if (!type || !data) {
        return res.status(400).json({
          success: false,
          error: '参数不完整'
        });
      }

      // 记录用户活动
      await UserActivity.create({
        user_id: userId,
        company_id: req.user.company_id || null,
        action: 'content_generation',
        details: {
          generationType: type,
          dataKeys: Object.keys(data)
        }
      });

      // 调用AI服务
      logger.info('Content generate request', { userId, type });
      const result = await aiService.generateContent(type, data, req.user);

      if (result.success) {
        res.json({
          success: true,
          data: {
            content: result.data,
            service: result.service,
            model: result.model,
            cost: result.cost,
            responseTime: result.responseTime
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error || '内容生成失败'
        });
      }
    } catch (error) {
      logger.error('内容生成失败', { message: error.message, stack: error.stack });
      res.status(500).json({
        success: false,
        error: '内容生成失败'
      });
    }
  }

  // 批量AI分析
  async batchAnalyzeResumes(req, res) {
    try {
      const { resumeIds, options } = req.body;
      const userId = req.user.id;

      logger.info('Batch analyze request received', {
        userId,
        resumeIds,
        options,
        company_id: req.user.company_id
      });

      if (!resumeIds || !Array.isArray(resumeIds) || resumeIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: '请提供有效的简历ID列表'
        });
      }

      // 构建查询条件，支持公司权限
      const whereClause = req.user.company_id
        ? { id: resumeIds, company_id: req.user.company_id }
        : { id: resumeIds, user_id: userId };

      logger.info('Batch analyze query clause', { whereClause });

      // 获取所有简历
      const resumes = await Resume.findAll({
        where: whereClause
      });

      logger.info(`Found ${resumes.length} resumes for processing`);

      if (resumes.length === 0) {
        return res.status(404).json({
          success: false,
          error: '未找到有效的简历数据'
        });
      }

      const results = [];
      const jobDescription = options?.jobDescription || '';
      const jobId = options?.jobId || null;
      const job = jobId ? await Job.findByPk(jobId) : null;
      const scene = (options && options.scene) ? options.scene : 'analysis';
      const isQuickScreening = scene === 'analysis' || scene === 'talent_pool' || scene === 'resume_quick_score';
      const isDeepAnalysis = scene === 'deep_analysis';
      const force = options?.force === true;

      // 串行处理以避免并发过高
      for (const resume of resumes) {
        logger.info(`Processing resume ID: ${resume.id}, File: ${resume.file_name}`);

        // 如果提供了 jobId 且简历尚未关联该职位，则建立关联
        if (jobId) {
          try {
            const [rj, created] = await ResumeJob.findOrCreate({
              where: { resume_id: resume.id, job_id: jobId },
              defaults: {
                user_id: userId,
                company_id: req.user.company_id,
                status: 'applied'
              }
            });
            if (created) {
              logger.info(`Associated resume ${resume.id} with job ${jobId} during batch analysis`);
            }
          } catch (rjErr) {
            logger.error(`Failed to associate resume ${resume.id} with job ${jobId}`, rjErr);
          }
        }

        let existingDeepRecord = null;
        if (isDeepAnalysis && !force) {
          existingDeepRecord = await AnalysisResult.findOne({
            where: {
              resume_id: resume.id,
              user_id: userId,
              type: 'single'
            },
            order: [['id', 'DESC']]
          });

          const hasDimensions = existingDeepRecord && existingDeepRecord.dimensions &&
            Object.values(existingDeepRecord.dimensions).some(v => Number(v) > 0);

          if (existingDeepRecord && existingDeepRecord.overall_score > 0 && hasDimensions) {
            logger.info(`[Batch Analysis] Found valid AnalysisResult(single) for resumeId: ${resume.id}, skipping AI call.`);
            results.push({
              id: resume.id,
              success: true,
              status: 'analyzed',
              data: {
                analysis: existingDeepRecord.detailed_analysis || {},
                overall_score: existingDeepRecord.overall_score,
                dimensions: existingDeepRecord.dimensions,
                createdAt: existingDeepRecord.analysis_date
              }
            });
            continue;
          }
        }

        let content = resume.parsed_data?.content || '';
        if (!content) {
          try {
            content = await extractTextFromFile(resume.file_path);
            logger.info(`Extracted text from file for resume ${resume.id}, length: ${content ? content.length : 0}`);
          } catch (e) {
            logger.error(`Failed to extract text for resume ${resume.id}`, e);
          }
        }

        if (!content || content.trim().length === 0) {
          logger.warn(`No content found for resume ${resume.id}`);
          results.push({ id: resume.id, success: false, error: '无法提取简历内容' });
          continue;
        }

        // 调用AI服务 (使用模板)
        try {
          logger.info(`Calling AI service for resume ${resume.id}`, {
            scene,
            hasJD: !!jobDescription
          });

          if (isQuickScreening) {
            const existingScore = parseInt(resume.score || 0);
            if (!isNaN(existingScore) && existingScore > 0) {
              let recruitmentStatus = resume.recruitment_status || null;
              let autoRejected = false;
              let rejectionReason = null;
              let shouldUpdateRecruitmentStatus = false;

              if (job && job.enable_auto_screening) {
                const statusRaw = String(resume.recruitment_status || '').trim().toLowerCase();
                const isApplied = !statusRaw || statusRaw === '投递' || statusRaw === '新投递' || statusRaw === 'applied' || statusRaw === 'new';
                if (isApplied) {
                  shouldUpdateRecruitmentStatus = true;
                  if (existingScore < job.auto_reject_score) {
                    recruitmentStatus = '淘汰';
                    autoRejected = true;
                    const scoreDiff = job.auto_reject_score - existingScore;
                    let reason = `自动淘汰：评分 ${existingScore} (低于 ${job.auto_reject_score})`;
                    if (scoreDiff >= 20) reason += '，差距较大';
                    rejectionReason = reason;
                  } else {
                    recruitmentStatus = '已快评';
                  }
                }
              }

              const resumeUpdateData = {
                status: 'analyzed',
                last_analysis_date: new Date(),
                score: existingScore
              };
              if (shouldUpdateRecruitmentStatus) {
                resumeUpdateData.recruitment_status = recruitmentStatus;
                resumeUpdateData.auto_rejected = autoRejected;
                resumeUpdateData.rejection_reason = rejectionReason;
              }

              await resume.update(resumeUpdateData);

              if (jobId) {
                const resumeJob = await ResumeJob.findOne({
                  where: { resume_id: resume.id, job_id: jobId }
                });
                if (resumeJob) {
                  const resumeJobUpdate = { match_score: existingScore };
                  if (shouldUpdateRecruitmentStatus) {
                    const rjStatusRaw = String(resumeJob.status || '').trim().toLowerCase();
                    const rjIsApplied = !rjStatusRaw || rjStatusRaw === 'applied' || rjStatusRaw === 'new' || rjStatusRaw === '投递';
                    if (rjIsApplied) {
                      resumeJobUpdate.status = (recruitmentStatus === '淘汰') ? 'rejected' : 'screening';
                    }
                    if (rejectionReason) resumeJobUpdate.notes = rejectionReason;
                  }
                  await resumeJob.update(resumeJobUpdate);
                }
              }

              results.push({
                id: resume.id,
                success: true,
                score: existingScore,
                overall_score: existingScore,
                data: { overall_score: existingScore }
              });
              continue;
            }
          }

          const aiResult = await aiService.analyzeResume(content, jobDescription, req.user, scene);

          if (aiResult.success) {
            // 保存结果
            let analysisData = aiResult.data;
            logger.info(`AI success for resume ${resume.id}`, {
              service: aiResult.service,
              model: aiResult.model,
              dataType: typeof analysisData
            });

            if (typeof analysisData === 'string') {
              try {
                // 更强大的 JSON 提取逻辑
                const jsonMatch = analysisData.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                  analysisData = JSON.parse(jsonMatch[0]);
                  logger.info(`Successfully parsed JSON for resume ${resume.id}`);
                } else {
                  throw new Error('未在响应中找到 JSON 结构');
                }
              } catch (parseError) {
                logger.error('解析 AI 结果失败', {
                  resumeId: resume.id,
                  error: parseError.message,
                  content: analysisData.substring(0, 200) + '...'
                });
                // 如果解析失败，尝试从文本中正则表达式提取分数
                const scoreMatch = analysisData.match(/(?:overall_score|score|得分|匹配度)\s*[:：]\s*(\d+)/i);
                if (scoreMatch) {
                  analysisData = { overall_score: parseInt(scoreMatch[1]) };
                  logger.info(`Extracted score via regex for resume ${resume.id}: ${analysisData.overall_score}`);

                  // 尝试提取维度分数 (Regex fallback)
                  const dimPatterns = {
                    skills: /(?:技能|专业|技术|skills)\s*[:：]\s*(\d+)/i,
                    experience: /(?:经验|履历|背景|experience)\s*[:：]\s*(\d+)/i,
                    education: /(?:学历|教育|学校|education)\s*[:：]\s*(\d+)/i,
                    stability: /(?:稳定|跳槽|离职|stability)\s*[:：]\s*(\d+)/i,
                    potential: /(?:潜力|发展|成长|potential)\s*[:：]\s*(\d+)/i,
                    teamwork: /(?:协作|团队|沟通|teamwork)\s*[:：]\s*(\d+)/i
                  };

                  analysisData.scores_percent = {};
                  for (const [key, pattern] of Object.entries(dimPatterns)) {
                    const match = aiResult.data.match(pattern);
                    if (match) analysisData.scores_percent[key] = parseInt(match[1]);
                  }
                }
              }
            }

            // 计算分数和提取关键信息
            let overallScore = (analysisData && typeof analysisData === 'object')
              ? (analysisData.overall_score || analysisData.overallScore || analysisData.match_score || analysisData.score || 0)
              : 0;

            // 确保分数是有效的整数
            overallScore = parseInt(overallScore);
            if (isNaN(overallScore)) overallScore = 0;
            if (overallScore > 100) overallScore = 100;
            if (overallScore < 0) overallScore = 0;

            logger.info(`Final score for resume ${resume.id}: ${overallScore}`);

            let recruitmentStatus = resume.recruitment_status || null;
            let autoRejected = false;
            let rejectionReason = null;
            let shouldUpdateRecruitmentStatus = false;

            if (job && job.enable_auto_screening) {
              const statusRaw = String(resume.recruitment_status || '').trim().toLowerCase();
              const isApplied = !statusRaw || statusRaw === '投递' || statusRaw === '新投递' || statusRaw === 'applied' || statusRaw === 'new';
              if (isApplied) {
                shouldUpdateRecruitmentStatus = true;
                if (overallScore < job.auto_reject_score) {
                  recruitmentStatus = '淘汰';
                  autoRejected = true;
                  const scoreDiff = job.auto_reject_score - overallScore;
                  let reason = `自动淘汰：评分 ${overallScore} (低于 ${job.auto_reject_score})`;
                  if (scoreDiff >= 20) reason += '，差距较大';
                  rejectionReason = reason;
                } else if (overallScore > 0) {
                  recruitmentStatus = '已快评';
                } else {
                  recruitmentStatus = '待快评';
                }
              }
            } else {
              // 如果未开启自动快评，只有在有分数的情况下才显示“已快评”
              const statusRaw = String(resume.recruitment_status || '').trim().toLowerCase();
              const isApplied = !statusRaw || statusRaw === '投递' || statusRaw === '新投递' || statusRaw === 'applied' || statusRaw === 'new' || statusRaw === '待快评';
              if (isApplied) {
                shouldUpdateRecruitmentStatus = true;
                recruitmentStatus = overallScore > 0 ? '已快评' : '待快评';
              }
            }

            if (isQuickScreening) {
              const resumeUpdateData = {
                status: 'analyzed',
                last_analysis_date: new Date(),
                score: overallScore
              };
              if (shouldUpdateRecruitmentStatus) {
                resumeUpdateData.recruitment_status = recruitmentStatus;
                resumeUpdateData.auto_rejected = autoRejected;
                resumeUpdateData.rejection_reason = rejectionReason;
              }

              await resume.update(resumeUpdateData);

              if (jobId) {
                const resumeJob = await ResumeJob.findOne({
                  where: { resume_id: resume.id, job_id: jobId }
                });
                if (resumeJob) {
                  const resumeJobUpdate = { match_score: overallScore };
                  if (shouldUpdateRecruitmentStatus) {
                    const rjStatusRaw = String(resumeJob.status || '').trim().toLowerCase();
                    const rjIsApplied = !rjStatusRaw || rjStatusRaw === 'applied' || rjStatusRaw === 'new' || rjStatusRaw === '投递';
                    if (rjIsApplied) {
                      resumeJobUpdate.status = (recruitmentStatus === '淘汰') ? 'rejected' : 'screening';
                    }
                    if (rejectionReason) resumeJobUpdate.notes = rejectionReason;
                  }
                  await resumeJob.update(resumeJobUpdate);
                }
              }

              results.push({
                id: resume.id,
                success: true,
                score: overallScore,
                overall_score: overallScore,
                data: { overall_score: overallScore }
              });
              continue;
            }

            const report = (analysisData && analysisData.evaluation_report) || (analysisData && analysisData.report) || (analysisData && analysisData.analysis_report) || {};
            const rawRadar = (analysisData && analysisData.scores_percent) || (analysisData && analysisData.radar_scores) || (analysisData && analysisData.radarScores) || (analysisData && analysisData.score_detail) || (analysisData && analysisData.dimensions) || analysisData || {};

            const radar = {};
            const dimensionKeys = ['skills', 'experience', 'education', 'project', 'stability', 'potential', 'teamwork'];
            const dimensionMappings = {
              skills: ['skills', 'skill_match', 'professional', 'core_skills', 'job_fit', '专业技能', '技能评分', '技能匹配'],
              experience: ['experience', 'experience_match', 'experience_fit', 'background', '工作经验', '经验契合', '经验评分'],
              education: ['education', 'education_background', 'academic', '学历背景', '教育背景', '学历评分'],
              project: ['project', 'project_match', 'project_fit', '项目背景', '项目履历', '项目履历匹配'],
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

            // 统一归一化逻辑
            radar.project = radar.project || radar.stability || 0;
            radar.stability = radar.stability || radar.project || 0;

            const totalRadarScore = Object.values(radar).reduce((a, b) => a + b, 0);
            if (totalRadarScore === 0) {
              logger.info(`[Batch Analysis] Radar scores are all 0, attempting root-level extraction for resume ${resume.id}`);
              dimensionKeys.forEach(key => {
                const possibleKeys = dimensionMappings[key];
                for (const pKey of possibleKeys) {
                  if (analysisData[pKey] !== undefined && typeof analysisData[pKey] !== 'object') {
                    radar[key] = parseInt(analysisData[pKey]) || 0;
                    if (radar[key] > 0) break;
                  }
                }
              });
            }

            await AnalysisResult.create({
              resume_id: resume.id,
              user_id: userId,
              company_id: req.user.company_id || null,
              overall_score: overallScore,
              dimensions: radar,
              summary: report.summary || analysisData.summary || report.hiring_advice || '',
              suggestions: report.career_advice || report.suggestions || analysisData.suggestions || [],
              strengths: report.core_strengths || report.strengths || analysisData.strengths || [],
              weaknesses: report.potential_issues || report.weaknesses || analysisData.weaknesses || [],
              hiring_advice: report.hiring_advice || analysisData.hiring_advice || '',
              detailed_analysis: analysisData,
              ai_provider: aiResult.service,
              ai_model: aiResult.model,
              processing_time: aiResult.responseTime,
              analysis_date: new Date(),
              type: 'single'
            });

            // 更新简历状态和分数
            const resumeUpdateData = {
              status: 'analyzed',
              last_analysis_date: new Date(),
              score: overallScore
            };
            if (shouldUpdateRecruitmentStatus) {
              resumeUpdateData.recruitment_status = recruitmentStatus;
              resumeUpdateData.auto_rejected = autoRejected;
              resumeUpdateData.rejection_reason = rejectionReason;
            }

            await resume.update(resumeUpdateData);

            if (jobId) {
              const resumeJob = await ResumeJob.findOne({
                where: { resume_id: resume.id, job_id: jobId }
              });
              if (resumeJob) {
                const resumeJobUpdate = { match_score: overallScore };
                if (shouldUpdateRecruitmentStatus) {
                  const rjStatusRaw = String(resumeJob.status || '').trim().toLowerCase();
                  const rjIsApplied = !rjStatusRaw || rjStatusRaw === 'applied' || rjStatusRaw === 'new' || rjStatusRaw === '投递';
                  if (rjIsApplied) {
                    resumeJobUpdate.status = (recruitmentStatus === '淘汰') ? 'rejected' : 'screening';
                  }
                  if (rejectionReason) resumeJobUpdate.notes = rejectionReason;
                }
                await resumeJob.update(resumeJobUpdate);
              }
            }

            logger.info(`Updated resume ${resume.id} record in DB`);

            results.push({
              id: resume.id,
              success: true,
              score: overallScore,
              overall_score: overallScore,
              data: analysisData,
              basic_info: analysisData.basic_info,
              scores_star: radar,
              scores_percent: radar
            });
          } else {
            logger.error(`AI failed for resume ${resume.id}`, { error: aiResult.error });
            results.push({ id: resume.id, success: false, error: aiResult.error });
          }
        } catch (err) {
          logger.error(`Batch analysis iteration failed for ${resume.id}`, err);
          results.push({ id: resume.id, success: false, error: err.message });
        }
      }

      logger.info('Batch analysis completed', {
        total: results.length,
        successful: results.filter(r => r.success).length
      });

      res.json({
        success: true,
        data: {
          total: results.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
          results: results
        },
        message: '批量分析完成'
      });

    } catch (error) {
      console.error('批量分析错误:', error);
      res.status(500).json({
        success: false,
        error: '批量分析失败: ' + error.message
      });
    }
  }

  // 获取AI服务状态
  async getServiceStatus(req, res) {
    try {
      const stats = aiService.getServiceStats();
      logger.info('获取服务状态', { userId: req.user?.id, stats });

      res.json({
        success: true,
        data: {
          services: stats.services,
          totalCost: stats.totalCost,
          serviceAvailability: stats.serviceAvailability
        }
      });
    } catch (error) {
      logger.error('获取服务状态失败', { message: error.message, stack: error.stack });
      res.status(500).json({
        success: false,
        error: '获取服务状态失败'
      });
    }
  }

  // 重置服务统计
  async resetServiceStats(req, res) {
    try {
      // 检查用户权限（仅管理员）
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: '权限不足'
        });
      }

      aiService.resetServiceStats();

      res.json({
        success: true,
        message: '服务统计已重置'
      });
    } catch (error) {
      console.error('重置服务统计失败:', error);
      res.status(500).json({
        success: false,
        error: '重置服务统计失败'
      });
    }
  }

  // 快速分析（使用轻量级模型）
  async quickAnalyze(req, res) {
    try {
      const { text, analysisType } = req.body;
      const userId = req.user.id;

      if (!text || !analysisType) {
        return res.status(400).json({
          success: false,
          error: '参数不完整'
        });
      }

      // 记录用户活动
      await UserActivity.create({
        user_id: userId,
        company_id: req.user.company_id || null,
        action: 'quick_analysis',
        details: {
          analysisType: analysisType,
          textLength: text.length
        }
      });

      // 构建快速分析提示词
      const prompt = await promptService.getPrompt(`quick_analysis_${analysisType}`, { text });

      // 使用轻量级模型
      const result = await aiService.generateContent('quick_analysis', {
        prompt: prompt,
        analysisType: analysisType
      }, req.user);

      if (result.success) {
        res.json({
          success: true,
          data: {
            analysis: result.data,
            service: result.service,
            model: result.model,
            cost: result.cost,
            responseTime: result.responseTime
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error || '快速分析失败'
        });
      }
    } catch (error) {
      console.error('快速分析失败:', error);
      res.status(500).json({
        success: false,
        error: '快速分析失败'
      });
    }
  }



  async compareResumes(req, res) {
    try {
      let { resumeIds, resumeIdA, resumeIdB, jobDescription } = req.body;
      const userId = req.user.id;

      // 兼容旧参数
      if (!resumeIds) {
        if (resumeIdA && resumeIdB) {
          resumeIds = [resumeIdA, resumeIdB];
        } else {
          return res.status(400).json({ success: false, error: '参数不完整' });
        }
      }

      if (!Array.isArray(resumeIds) || resumeIds.length < 2 || resumeIds.length > 5) {
        return res.status(400).json({ success: false, error: '请选择2-5份简历进行对比' });
      }

      // Helper to get text
      const getResumeText = async (id) => {
        try {
          const r = await Resume.findByPk(id);
          if (r) {
            let text = await extractTextFromFile(r.file_path);
            if (!text) text = buildFallbackTextFromParsed(r.parsed_data || {});
            return { id, name: r.file_name || '未知简历', text: text || '' };
          }
        } catch (_) { }
        return null;
      };

      const resumeList = [];
      for (const id of resumeIds) {
        const r = await getResumeText(id);
        if (r && r.text) {
          resumeList.push(r);
        }
      }

      if (resumeList.length < 2) {
        return res.status(400).json({ success: false, error: '无法获取足够的简历内容' });
      }

      await UserActivity.create({
        user_id: userId,
        company_id: req.user.company_id || null,
        action: 'resume_compare',
        details: { resumeIds, hasJobDescription: !!jobDescription }
      });
      console.log(`[AI Controller] Comparing resumes: ${resumeIds.join(', ')}`);
      const result = await aiService.compareResumes(resumeList, jobDescription || '');

      if (result.success) {
        // 增加对数据结构的校验
        if (!result.data || typeof result.data !== 'object') {
          console.error('[AI Controller] Comparison failed: Invalid data structure returned from AI service');
          return res.status(500).json({ success: false, error: 'AI 返回的数据格式不正确' });
        }

        console.log('[AI Controller] Comparison successful, data length:', JSON.stringify(result.data).length);

        // 为每一位候选人保存分析结果到 AnalysisResult（多候选对比）
        if (result.data && result.data.candidates && Array.isArray(result.data.candidates)) {
          for (const candidate of result.data.candidates) {
            try {
              let matchedResume = null;

              // 1. 尝试通过 candidate_label 匹配 (例如 "简历A" -> index 0)
              if (candidate.candidate_label) {
                const labelMatch = candidate.candidate_label.match(/(?:简历|Resume)\s*([A-Z])/i);
                if (labelMatch && labelMatch[1]) {
                  const index = labelMatch[1].toUpperCase().charCodeAt(0) - 65;
                  if (index >= 0 && index < resumeList.length) {
                    matchedResume = resumeList[index];
                  }
                }
              }

              // 2. 尝试通过文件名匹配 resumeId (优先)，如果失败则回退到名字匹配
              if (!matchedResume) {
                matchedResume = resumeList.find(r => r.name === candidate.file_name);
              }

              // 3. 回退机制：如果文件名不匹配，尝试通过名字模糊匹配
              if (!matchedResume) {
                matchedResume = resumeList.find(r => r.name.includes(candidate.name) || (candidate.name && candidate.name.includes(r.name)));
              }

              if (matchedResume) {
                // 构建完整的对比报告内容，作为每个人的 evaluation_report
                let fullComparisonReport = `### 简历对比分析报告\n\n`;
                fullComparisonReport += `#### 总体评价\n${result.data.comparison_summary || '暂无总体评价'}\n\n`;

                // 处理可能为对象的 recommendation
                const recommendationText = typeof result.data.recommendation === 'object'
                  ? (result.data.recommendation.reason || JSON.stringify(result.data.recommendation))
                  : (result.data.recommendation || '暂无核心建议');

                fullComparisonReport += `#### 核心建议\n${recommendationText}\n\n`;
                fullComparisonReport += `#### 候选人对比详情\n`;

                // 添加对比表格或列表
                result.data.candidates.forEach(c => {
                  const isCurrent = c.name === candidate.name;
                  fullComparisonReport += `**${c.name || '未知候选人'}** ${isCurrent ? '(当前候选人)' : ''}: 总分 ${c.overall_score || 0}\n`;
                  if (c.evaluation) {
                    fullComparisonReport += `- 评价: ${c.evaluation}\n`;
                  }
                  fullComparisonReport += `\n`;
                });

                await AnalysisResult.create({
                  resume_id: matchedResume.id,
                  user_id: userId,
                  company_id: req.user.company_id || null,
                  type: 'multi',
                  overall_score: parseInt(candidate.overall_score) || 0,
                  dimensions: candidate.scores_percent || {},
                  detailed_analysis: {
                    ...candidate,
                    evaluation_report: fullComparisonReport,
                    comparison_data: result.data,
                    basic_info: {
                      name: candidate.name,
                      experience: candidate.experience || '未提及',
                      education: candidate.education || '未提及'
                    }
                  },
                  analysis_date: new Date()
                });

                // 同时更新简历状态
                await Resume.update({
                  status: 'analyzed',
                  last_analysis_date: new Date(),
                  score: parseInt(candidate.overall_score) || 0
                }, { where: { id: matchedResume.id } });
              }
            } catch (itemError) {
              console.error(`[AI Controller] Error saving comparison result for candidate:`, itemError);
              // 继续处理下一个候选人
            }
          }
        }

        return res.json({ success: true, data: result.data });
      }
      console.error('[AI Controller] Comparison failed:', result.error);
      return res.status(500).json({ success: false, error: result.error || '简历对比失败' });
    } catch (e) {
      logger.error('简历对比失败', { message: e.message });
      return res.status(500).json({ success: false, error: '简历对比失败' });
    }
  }

  // 获取分析记录列表
  async getAnalysisRecords(req, res) {
    try {
      const userId = req.user.id;
      const companyId = req.user.company_id;

      logger.info('Fetching analysis records', { userId, companyId });

      // 企业用户查看全公司的记录，普通用户查看自己的
      const whereClause = companyId ? { company_id: companyId } : { user_id: userId };

      const records = await AnalysisResult.findAll({
        where: whereClause,
        include: [
          {
            model: Resume,
            as: 'Resume',
            attributes: ['id', 'name', 'file_name', 'file_type', 'upload_date', 'job_title', 'recruitment_status', 'avatar']
          }
        ],
        order: [['analysis_date', 'DESC']]
      });

      res.json({
        success: true,
        data: records
      });
    } catch (error) {
      logger.error('获取分析记录失败', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id
      });
      res.status(500).json({ success: false, error: '获取分析记录失败: ' + error.message });
    }
  }

  // 获取单个分析记录详情
  async getAnalysisDetail(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const companyId = req.user.company_id;

      logger.info('Fetching analysis detail', { id, userId, companyId });

      const whereClause = { id };
      // 权限检查：要么是记录的所有者，要么属于同一个公司
      if (companyId) {
        whereClause.company_id = companyId;
      } else {
        whereClause.user_id = userId;
      }

      const record = await AnalysisResult.findOne({
        where: whereClause,
        include: [
          {
            model: Resume,
            as: 'Resume',
            attributes: ['id', 'name', 'file_name', 'file_type', 'file_path', 'recruitment_status']
          }
        ]
      });

      if (!record) {
        logger.warn('Analysis record not found', { id, whereClause });
        return res.status(404).json({ success: false, error: '分析记录不存在或无权访问' });
      }

      res.json({
        success: true,
        data: record
      });
    } catch (error) {
      logger.error('获取分析详情失败', {
        error: error.message,
        stack: error.stack,
        recordId: req.params.id
      });
      res.status(500).json({ success: false, error: '获取分析详情失败: ' + error.message });
    }
  }

  async readResumeFromUrl(req, res) {
    try {
      const { url } = req.body;
      const userId = req.user.id;
      if (!url) {
        return res.status(400).json({ success: false, error: '请提供有效的链接' });
      }
      let html = '';
      try {
        const r = await axios.get(url, { timeout: 15000 });
        html = String(r.data || '');
      } catch (e) {
        return res.status(500).json({ success: false, error: '链接内容获取失败' });
      }
      let text = '';
      try {
        const $ = cheerio.load(html);
        $('script, style, noscript').remove();
        text = $('body').text().replace(/\s+/g, ' ').trim();
      } catch (_) {
        text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      }
      if (!text || text.length < 50) {
        return res.status(400).json({ success: false, error: '无法从链接中提取有效的简历文本' });
      }
      const maxLen = 20000;
      if (text.length > maxLen) text = text.slice(0, maxLen);
      await UserActivity.create({
        user_id: userId,
        company_id: req.user.company_id || null,
        action: 'url_read',
        details: { url }
      });
      const result = await aiService.analyzeUrlResume(text, req.user);
      if (result.success) {
        let analysisData = result.data;
        if (typeof analysisData === 'string') {
          try {
            const cleanJson = analysisData.replace(/```json\n?|```/g, '').trim();
            analysisData = JSON.parse(cleanJson);
          } catch (_) { }
        }
        const fileSize = Buffer.byteLength(text || '', 'utf8');
        let fileName = '链接简历';
        try { const u = new URL(url); fileName = `${u.hostname}${u.pathname}`.replace(/\/+$/, '') || '链接简历'; } catch (_) { }
        const resume = await Resume.create({
          user_id: userId,
          file_name: fileName,
          file_size: fileSize,
          file_type: 'link',
          file_path: url,
          parsed_data: { source_url: url, raw_text: text },
          status: 'analyzed',
          tags: ['from_url']
        });
        await Resume.update({ analysis_count: (resume.analysis_count || 0) + 1, last_analysis_date: new Date() }, { where: { id: resume.id } });
        const overall = Number(analysisData?.overall_score || 0);
        const dims = analysisData?.radar_scores || {};
        const evalRep = analysisData?.evaluation_report || {};
        await AnalysisResult.create({
          resume_id: resume.id,
          user_id: userId,
          overall_score: isNaN(overall) ? 0 : overall,
          dimensions: dims,
          suggestions: evalRep?.career_advice || [],
          strengths: evalRep?.core_strengths || [],
          weaknesses: evalRep?.potential_issues || [],
          detailed_analysis: analysisData || {},
          ai_provider: result.service,
          ai_model: result.model,
          processing_time: result.responseTime
        });
        return res.json({ success: true, data: { analysis: analysisData, service: result.service, model: result.model, cost: result.cost, responseTime: result.responseTime, resumeId: resume.id } });
      }
      return res.status(500).json({ success: false, error: result.error || 'AI分析失败' });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message || '链接读取失败' });
    }
  }
}

module.exports = new AIController();
