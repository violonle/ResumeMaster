const DomesticAIService = require('../services/domesticAIService');
const axios = require('axios');
const cheerio = require('cheerio');
const { extractTextFromFile, buildFallbackTextFromParsed } = require('../services/textExtractor');
const { AnalysisResult, Resume, Job, User, DeepAnalysisRecord } = require('../models');
const logger = require('../utils/logger');
const promptService = require('../services/promptService');
const { UserActivity } = require('../models');

const aiService = new DomesticAIService();

const OptimizedResumeParseService = require('../services/optimizedResumeParseService');

class AIController {
  // 简历分析
  async analyzeResume(req, res) {
    try {
      const { resumeText, jobDescription, resumeId, options } = req.body;
      const userId = req.user.id;

      let text = resumeText || '';
      if (!text && resumeId) {
        try {
          const r = await Resume.findByPk(resumeId);
          if (r) {
            const fp = r.file_path;
            text = await extractTextFromFile(fp);
            if (!text) text = buildFallbackTextFromParsed(r.parsed_data || {});
          }
        } catch (_) {}
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
          hasJobDescription: !!jobDescription
        }
      });

      // 如果有resumeId，使用异步处理
      if (resumeId) {
        // 先检查是否已经有深度分析记录了，避免重复分析
        const existingDeepRecord = await DeepAnalysisRecord.findOne({
          where: { 
            resume_id: resumeId,
            user_id: userId
          },
          order: [['id', 'DESC']]
        });

        // 核心修复：只有当存在记录、总分大于 0 且维度分不全为 0 时，才跳过 AI 调用
        // 这样如果之前因为某种原因解析出了 0 分或空维度，再次点击分析时会重新触发 AI
        const hasDimensions = existingDeepRecord && existingDeepRecord.dimensions && 
                             Object.values(existingDeepRecord.dimensions).some(v => v > 0);
                             
        if (existingDeepRecord && existingDeepRecord.overall_score > 0 && hasDimensions) {
           console.log(`[AI Controller] Found valid DeepAnalysisRecord for resumeId: ${resumeId}, skipping AI call.`);
           return res.json({
             success: true,
             status: 'analyzed',
             resumeId: resumeId,
             data: {
               analysis: existingDeepRecord.details || {},
               overall_score: existingDeepRecord.overall_score,
               dimensions: existingDeepRecord.dimensions,
               createdAt: existingDeepRecord.analysis_date
             }
           });
        }

        // 兼容性检查：如果旧表有结果也可以考虑返回
        const existingResult = await AnalysisResult.findOne({
          where: { resume_id: resumeId },
          order: [['id', 'DESC']]
        });

        // 更新状态为解析中
        await Resume.update({ status: 'parsing' }, { where: { id: resumeId } });
        
        // 立即返回处理中状态
        res.json({
          success: true,
          status: 'processing',
          resumeId: resumeId,
          message: '分析请求已接收，正在后台处理中'
        });

        // 触发后台处理
      console.log(`[AI Controller] Starting background process for resumeId: ${resumeId}`);
      this.processAnalysisBackground(resumeId, text, jobDescription, req.user, options).catch(err => {
        logger.error('后台分析任务失败', { resumeId, error: err.message });
      });
        
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
  async processAnalysisBackground(resumeId, text, jobDescription, user, options = {}) {
    try {
      console.log(`[AI Controller] Background analysis started for resumeId: ${resumeId}`);
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

      const result = await aiService.analyzeResume(text, jobDescription, user, options ? options.scene : null);

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
                      skills: /(?:技能|专业|技术|skills)\s*[:：]\s*(\d+)/i,
                      experience: /(?:经验|履历|背景|experience)\s*[:：]\s*(\d+)/i,
                      education: /(?:学历|教育|学校|education)\s*[:：]\s*(\d+)/i,
                      stability: /(?:稳定|跳槽|离职|stability)\s*[:：]\s*(\d+)/i,
                      potential: /(?:潜力|发展|成长|potential)\s*[:：]\s*(\d+)/i,
                      teamwork: /(?:协作|团队|沟通|teamwork)\s*[:：]\s*(\d+)/i
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

          console.log(`[AI Controller] Final analysisData for resume ${resumeId}:`, JSON.stringify(analysisData).substring(0, 500));
        
        // 计算分数和提取关键信息用于存储
        let overallScore = (analysisData && typeof analysisData === 'object') 
            ? (analysisData.overall_score || analysisData.overallScore || analysisData.match_score || analysisData.score || 0)
            : 0;
        
        // 确保分数是有效的整数
        overallScore = parseInt(overallScore);
        if (isNaN(overallScore)) overallScore = 0;
        if (overallScore > 100) overallScore = 100;
        if (overallScore < 0) overallScore = 0;

        const report = (analysisData && analysisData.evaluation_report) || (analysisData && analysisData.report) || (analysisData && analysisData.analysis_report) || {};
        // 提取维度分数，并确保是数字
        const radar = {};
        const rawRadar = (analysisData && analysisData.scores_percent) || (analysisData && analysisData.radar_scores) || (analysisData && analysisData.radarScores) || (analysisData && analysisData.score_detail) || (analysisData && analysisData.dimensions) || analysisData || {};
        
        const dimensionKeys = ['skills', 'experience', 'education', 'stability', 'potential', 'teamwork'];
        const dimensionMappings = {
            skills: ['skills', 'skill_match', 'professional', '专业技能', '技能评分', '技能匹配'],
            experience: ['experience', 'experience_match', 'background', '工作经验', '经验契合', '经验评分'],
            education: ['education', 'education_background', 'academic', '学历背景', '教育背景', '学历评分'],
            stability: ['stability', 'work_stability', 'tenure', '稳定性', '离职风险', '职业稳定性'],
            potential: ['potential', 'growth_potential', 'development', '发展潜力', '潜力评分', '成长性'],
            teamwork: ['teamwork', 'collaboration', 'social', '团队协作', '协作能力', '团队精神']
        };

        dimensionKeys.forEach(key => {
            let val = 0;
            const possibleKeys = dimensionMappings[key];
            
            for (const pKey of possibleKeys) {
                // 1. 尝试从 rawRadar 中查找（区分大小写）
                if (rawRadar[pKey] !== undefined) {
                    val = rawRadar[pKey];
                    break;
                }
                // 2. 尝试不区分大小写查找
                const foundKey = Object.keys(rawRadar).find(k => k.toLowerCase() === pKey.toLowerCase());
                if (foundKey) {
                    val = rawRadar[foundKey];
                    break;
                }
            }
            
            // 如果是对象格式 { score: 80 } 或 { value: 80 }
            if (typeof val === 'object' && val !== null) {
                val = val.score || val.value || val.rating || 0;
            }
            
            radar[key] = parseInt(val) || 0;
        });

        const strengths = report.strengths || report.core_strengths || analysisData.strengths || [];
        const weaknesses = report.weaknesses || report.potential_issues || report.risks || analysisData.weaknesses || [];
        const suggestions = report.suggestions || report.career_advice || analysisData.suggestions || [];
        const summary = report.summary || analysisData.summary || report.hiring_advice || '';

        console.log(`[AI Controller] Extracted Overall Score: ${overallScore}`);
        console.log(`[AI Controller] Extracted Radar: ${JSON.stringify(radar)}`);

        console.log(`[AI Controller] Saving AnalysisResult to DB for resumeId: ${resumeId}`);
        await AnalysisResult.create({
          resume_id: resumeId,
          user_id: user.id,
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
          analysis_date: new Date()
        });
        
        // 仅在深度解析场景下保存到 DeepAnalysisRecord
        if (!options || options.scene === 'deep_analysis' || options.scene === 'analysis') {
            console.log(`[AI Controller] Saving to DeepAnalysisRecord for scene: ${options?.scene || 'default'}`);
            await DeepAnalysisRecord.create({
              user_id: user.id,
              company_id: user.company_id || null,
              resume_id: resumeId,
              type: 'single',
              overall_score: overallScore,
              dimensions: radar,
              details: analysisData
            });
        } else {
            console.log(`[AI Controller] Skipping DeepAnalysisRecord for scene: ${options?.scene}`);
        }
        
        console.log(`[AI Controller] Analysis record created for resumeId: ${resumeId}`);
        
        // 获取当前简历数据以便合并而非覆盖
        const currentResume = await Resume.findByPk(resumeId);
        const currentParsedData = currentResume.parsed_data || {};
        
        // 智能合并策略：
        // 1. 优先使用本地正则解析的数据 (localParsedData)，因为它更稳定
        // 2. 其次使用当前 DB 中的数据 (currentParsedData)
        // 3. 最后合并 AI 分析的数据 (analysisData)
        const mergedParsedData = {
            ...currentParsedData,
            ...localParsedData, // 本地解析覆盖旧数据
            ...analysisData,    // AI 数据覆盖 (主要是 scores, summary 等)
            
            // 保护关键列表字段
            // 优先级: AI > 本地解析 > 原有数据 (因为 AI 可能做了更好的结构化)
            // 但如果 AI 是空的，必须回退到本地解析
            work_experience: (analysisData.work_experience && analysisData.work_experience.length > 0) 
                ? analysisData.work_experience 
                : (localParsedData.work_experience && localParsedData.work_experience.length > 0 
                    ? localParsedData.work_experience 
                    : (currentParsedData.work_experience || [])),
            
            education: (analysisData.education && analysisData.education.length > 0) 
                ? analysisData.education 
                : (localParsedData.education && localParsedData.education.length > 0 
                    ? localParsedData.education 
                    : (currentParsedData.education || [])),
            
            projects: (analysisData.projects && analysisData.projects.length > 0) 
                ? analysisData.projects 
                : (localParsedData.projects && localParsedData.projects.length > 0 
                    ? localParsedData.projects 
                    : (currentParsedData.projects || [])),
            
            skills: (analysisData.skills && analysisData.skills.length > 0)
                ? analysisData.skills
                : (localParsedData.skills && localParsedData.skills.length > 0 
                    ? localParsedData.skills 
                    : (currentParsedData.skills || [])),
            
            // 保护基础信息
            basic_info: {
                ...(currentParsedData.basic_info || {}),
                ...(localParsedData.basic_info || {}), // 本地解析可能有更准的手机号/邮箱
                ...(analysisData.basic_info || {})
            },
            
            // 确保 rawText 不丢失
            rawText: currentParsedData.rawText || currentParsedData.raw_text || analysisData.rawText || text || ''
        };

        // 确保 name, email, phone 等核心字段有值 (从 mergedParsedData 中提取)
        const finalName = mergedParsedData.name || mergedParsedData.basic_info?.name || localParsedData.name || '';
        const finalEmail = mergedParsedData.email || mergedParsedData.basic_info?.email || localParsedData.email || '';
        const finalPhone = mergedParsedData.phone || mergedParsedData.basic_info?.phone || localParsedData.phone || '';
        const finalJob = mergedParsedData.job_title || mergedParsedData.basic_info?.job_title || localParsedData.job_title || '';
        const finalExp = parseInt(mergedParsedData.experience_years || mergedParsedData.basic_info?.work_years || localParsedData.experience_years || 0);
        const finalEdu = mergedParsedData.highest_education || mergedParsedData.basic_info?.education || localParsedData.highest_education || '';

        // 最后更新简历状态
        // 关键修复：将 AI 分析得到的结构化数据回填到 Resume 表的 parsed_data 字段，
        // 确保 resume-details.html 能显示出 AI 提取的详细字段。
        await Resume.update({ 
          status: 'analyzed',
          last_analysis_date: new Date(),
          score: overallScore,
          parsed_data: mergedParsedData,
          // 同时尝试更新部分核心字段，方便列表页筛选
          name: finalName || undefined,
          email: finalEmail || undefined,
          phone: finalPhone || undefined,
          job_title: finalJob || undefined,
          experience_years: finalExp || undefined,
          highest_education: finalEdu || undefined
        }, { where: { id: resumeId } });
        console.log(`[AI Controller] Resume status updated to 'analyzed' and parsed_data populated for resumeId: ${resumeId}`);
        
        logger.info('Background analysis completed', { resumeId, score: overallScore });
      } else {
        throw new Error(result.error || 'AI service returned failure');
      }
    } catch (error) {
      logger.error('Background analysis failed', { resumeId, error: error.message });
      await Resume.update({ status: 'failed' }, { where: { id: resumeId } });
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

      // 直接使用数据库中的状态
      let currentStatus = resume.status;
      
      // 如果状态是 analyzed，但其实没有结果，可能需要修正（可选，但目前反过来才是问题）
      // 我们优先信任 Resume 表中的 status 字段，因为它是由后台任务明确更新的
      
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
      
      // 1. 仅从 DeepAnalysisRecord 获取结果（深度解析结果）
      // 排除掉 AnalysisResult（初筛结果），确保深度解析的独立性
      let result = await DeepAnalysisRecord.findOne({
        where: { resume_id: resumeId },
        order: [['id', 'DESC']]
      });

      if (!result) {
        return res.json({
          success: true,
          data: null
        });
      }

      // 统一映射逻辑（与 analysisController.getLatestAnalysisResult 保持一致）
      const details = result.details || result.detailed_analysis || {};
      const basicInfo = details.basic_info || details.personalInfo || details.parsed_data?.basic_info || {};
      
      const mappedData = {
        ...details,
        ...result.toJSON(),
        personalInfo: basicInfo,
        basic_info: basicInfo,
        dimensions: result.dimensions || details.radar || details.dimensions || details.scores_percent || {},
        detailed_analysis: details,
        scores: details.scores || { 
          overall: result.overall_score,
          dimensions: result.dimensions || details.radar || details.dimensions || details.scores_percent || {}
        },
        report: details.evaluation_report || details.analysis_report || details.report || details.evaluation || '暂无详细报告内容'
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
      this.processSupplementBackground(resumeId, text, userId).catch(err => {
        logger.error('补充分析任务失败', { resumeId, error: err.message });
      });

    } catch (error) {
      logger.error('补充分析请求失败', { message: error.message, stack: error.stack });
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // 后台补充分析任务
  async processSupplementBackground(resumeId, text, userId) {
    try {
      logger.info('Starting supplement analysis', { resumeId });
      
      // 调用 AI 服务，使用新提示词
      const result = await aiService.analyzeResume(text, '', { id: userId }, 'supplement_report');

      if (result.success) {
        let analysisData = result.data;
        if (!analysisData) throw new Error('解析补充分析结果失败');

        // 获取最新的深度分析记录
        const record = await DeepAnalysisRecord.findOne({
          where: { resume_id: resumeId },
          order: [['id', 'DESC']]
        });

        if (record) {
          const currentDetails = record.details || {};
          
          // 构建结构化的报告对象
          const evaluationReport = {
            summary: analysisData.summary || '',
            strengths: analysisData.strengths || [],
            weaknesses: analysisData.weaknesses || [],
            suggestions: analysisData.suggestions || [],
            hiring_advice: analysisData.hiring_advice || ''
          };

          // 更新详情中的报告部分
          const updatedDetails = {
            ...currentDetails,
            evaluation_report: evaluationReport, // 存储结构化对象，以便前端分板块渲染
            ...evaluationReport // 同时也将这些字段平铺到 details 中
          };

          await record.update({
            details: updatedDetails
          });
          
          logger.info('Supplement analysis completed and record updated', { resumeId });
        } else {
          // 如果记录不存在，创建一个新的
          const evaluationReport = {
            summary: analysisData.summary || '',
            strengths: analysisData.strengths || [],
            weaknesses: analysisData.weaknesses || [],
            suggestions: analysisData.suggestions || [],
            hiring_advice: analysisData.hiring_advice || ''
          };

          await DeepAnalysisRecord.create({
            user_id: userId,
            resume_id: resumeId,
            type: 'single',
            overall_score: analysisData.overall_score || 0,
            dimensions: analysisData.scores_percent || {},
            details: {
              ...analysisData,
              evaluation_report: evaluationReport
            }
          });
          logger.info('Supplement analysis completed and new record created', { resumeId });
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

      // 串行处理以避免并发过高
      for (const resume of resumes) {
        logger.info(`Processing resume ID: ${resume.id}, File: ${resume.file_name}`);
        
        // 1. 检查是否已经存在深度解析记录
        const existingDeepRecord = await DeepAnalysisRecord.findOne({
          where: { 
            resume_id: resume.id,
            user_id: userId
          },
          order: [['id', 'DESC']]
        });

        // 核心修复：只有当存在记录、总分大于 0 且维度分不全为 0 时，才跳过 AI 调用
        const hasDimensions = existingDeepRecord && existingDeepRecord.dimensions && 
                             Object.values(existingDeepRecord.dimensions).some(v => v > 0);
                             
        if (existingDeepRecord && existingDeepRecord.overall_score > 0 && hasDimensions) {
          logger.info(`[Batch Analysis] Found valid DeepAnalysisRecord for resumeId: ${resume.id}, skipping AI call.`);
          results.push({
            id: resume.id,
            success: true,
            status: 'analyzed',
            data: {
              analysis: existingDeepRecord.details || {},
              overall_score: existingDeepRecord.overall_score,
              dimensions: existingDeepRecord.dimensions,
              createdAt: existingDeepRecord.analysis_date
            }
          });
          continue;
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
                scene: options?.scene,
                hasJD: !!jobDescription 
            });
            
            const aiResult = await aiService.analyzeResume(content, jobDescription, req.user, options ? options.scene : null);
            
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

                const report = (analysisData && analysisData.evaluation_report) || (analysisData && analysisData.report) || (analysisData && analysisData.analysis_report) || {};
                const rawRadar = (analysisData && analysisData.scores_percent) || (analysisData && analysisData.radar_scores) || (analysisData && analysisData.radarScores) || (analysisData && analysisData.score_detail) || (analysisData && analysisData.dimensions) || analysisData || {};

                const radar = {};
                const dimensionKeys = ['skills', 'experience', 'education', 'stability', 'potential', 'teamwork'];
                const dimensionMappings = {
                    skills: ['skills', 'skill_match', 'professional', '专业技能', '技能评分', '技能匹配'],
                    experience: ['experience', 'experience_match', 'background', '工作经验', '经验契合', '经验评分'],
                    education: ['education', 'education_background', 'academic', '学历背景', '教育背景', '学历评分'],
                    stability: ['stability', 'work_stability', 'tenure', '稳定性', '离职风险', '职业稳定性'],
                    potential: ['potential', 'growth_potential', 'development', '发展潜力', '潜力评分', '成长性'],
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

                // 核心修复：如果所有维度都是 0，尝试从 analysisData 的根级别直接寻找可能的维度字段
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

                // 创建记录
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
                    analysis_date: new Date()
                });

                // 仅在深度解析场景下保存到 DeepAnalysisRecord，确保数据一致性
                if (!options || options.scene === 'deep_analysis' || options.scene === 'analysis') {
                    await DeepAnalysisRecord.create({
                        user_id: userId,
                        company_id: req.user.company_id || null,
                        resume_id: resume.id,
                        type: 'batch',
                        overall_score: overallScore,
                        dimensions: radar,
                        details: analysisData
                    });
                }

                // 更新简历状态和分数
                await resume.update({ 
                    status: 'analyzed', 
                    last_analysis_date: new Date(),
                    score: overallScore
                });
                
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
        } catch (_) {}
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
        console.log('[AI Controller] Comparison successful, data length:', JSON.stringify(result.data).length);
        
        // 为每一位候选人保存分析结果到 DeepAnalysisRecord
              if (result.data && result.data.candidates && Array.isArray(result.data.candidates)) {
                for (const candidate of result.data.candidates) {
                  // 尝试通过文件名匹配 resumeId (优先)，如果失败则回退到名字匹配
                  let matchedResume = resumeList.find(r => r.name === candidate.file_name);
                  
                  // 回退机制：如果文件名不匹配，尝试通过名字模糊匹配
                  if (!matchedResume) {
                    matchedResume = resumeList.find(r => r.name.includes(candidate.name) || candidate.name.includes(r.name));
                  }

                  if (matchedResume) {
              // 构建完整的对比报告内容，作为每个人的 evaluation_report
              let fullComparisonReport = `### 简历对比分析报告\n\n`;
              fullComparisonReport += `#### 总体评价\n${result.data.comparison_summary || '暂无总体评价'}\n\n`;
              fullComparisonReport += `#### 核心建议\n${result.data.recommendation || '暂无核心建议'}\n\n`;
              fullComparisonReport += `#### 候选人对比详情\n`;
              
              // 添加对比表格或列表
              result.data.candidates.forEach(c => {
                const isCurrent = c.name === candidate.name;
                fullComparisonReport += `**${c.name}** ${isCurrent ? '(当前候选人)' : ''}: 总分 ${c.overall_score}\n`;
                if (c.evaluation) {
                  fullComparisonReport += `- 评价: ${c.evaluation}\n`;
                }
                fullComparisonReport += `\n`;
              });

              await DeepAnalysisRecord.create({
                user_id: userId,
                company_id: req.user.company_id || null,
                resume_id: matchedResume.id,
                type: 'multi',
                overall_score: candidate.overall_score || 0,
                dimensions: candidate.scores_percent || {},
                details: {
                  ...candidate,
                  // 将完整的对比报告存入 evaluation_report，确保详情页能显示
                  evaluation_report: fullComparisonReport,
                  comparison_data: result.data, // 保留原始完整数据备用
                  basic_info: {
                    name: candidate.name,
                    experience: candidate.experience || '未提及',
                    education: candidate.education || '未提及'
                  }
                }
              });
              
              // 同时更新简历状态
              await Resume.update({ 
                status: 'analyzed',
                last_analysis_date: new Date(),
                score: candidate.overall_score || 0
              }, { where: { id: matchedResume.id } });
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
      
      const records = await DeepAnalysisRecord.findAll({
        where: whereClause,
        include: [
          {
            model: Resume,
            attributes: ['id', 'file_name', 'file_type', 'upload_date', 'job_title']
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
      
      const record = await DeepAnalysisRecord.findOne({
        where: whereClause,
        include: [
          {
            model: Resume,
            attributes: ['id', 'file_name', 'file_type', 'file_path']
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
          } catch (_) {}
        }
        const fileSize = Buffer.byteLength(text || '', 'utf8');
        let fileName = '链接简历';
        try { const u = new URL(url); fileName = `${u.hostname}${u.pathname}`.replace(/\/+$/, '') || '链接简历'; } catch (_) {}
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
