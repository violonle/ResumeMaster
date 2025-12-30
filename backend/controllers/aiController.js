const DomesticAIService = require('../services/domesticAIService');
const axios = require('axios');
const cheerio = require('cheerio');
const { extractTextFromFile, buildFallbackTextFromParsed } = require('../services/textExtractor');
const { Resume, AnalysisResult, DeepAnalysisRecord, Job } = require('../models');
const logger = require('../utils/logger');
const promptService = require('../services/promptService');
const { UserActivity } = require('../models');

const aiService = new DomesticAIService();

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

        if (existingDeepRecord) {
           console.log(`[AI Controller] Found existing DeepAnalysisRecord for resumeId: ${resumeId}, skipping AI call.`);
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
      const result = await aiService.analyzeResume(text, jobDescription, user, options ? options.scene : null);

        if (result.success) {
          // 保存分析结果
          let analysisData = aiService.parseJSONResponse(result.data);
          console.log(`[AI Controller] AI Service response for resumeId ${resumeId}:`, 
            typeof result.data === 'string' ? result.data.substring(0, 300) + '...' : 'Object');
          
          if (!analysisData) {
              logger.error('解析 AI 结果失败', { 
                  resumeId: resumeId, 
                  content: typeof result.data === 'string' ? result.data.substring(0, 200) + '...' : 'Non-string result'
              });
              // 如果解析失败，尝试从文本中正则表达式提取分数
              if (typeof result.data === 'string') {
                  const scoreMatch = result.data.match(/(?:overall_score|score|得分|匹配度)\s*[:：]\s*(\d+)/i);
                  analysisData = { overall_score: scoreMatch ? parseInt(scoreMatch[1]) : 0 };
              } else {
                  analysisData = { overall_score: 0 };
              }
          }
        
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
        const rawRadar = (analysisData && analysisData.scores_percent) || (analysisData && analysisData.radar_scores) || (analysisData && analysisData.radarScores) || (analysisData && analysisData.score_detail) || (analysisData && analysisData.dimensions) || {};
        
        const dimensionKeys = ['skills', 'experience', 'education', 'stability', 'potential', 'teamwork'];
        dimensionKeys.forEach(key => {
            let val = rawRadar[key];
            if (val === undefined || val === null) {
                // 尝试从 analysisData 顶层查找
                val = analysisData[key];
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
        
        // 同时保存到 DeepAnalysisRecord
        await DeepAnalysisRecord.create({
          user_id: user.id,
          company_id: user.company_id || null,
          resume_id: resumeId,
          type: 'single',
          overall_score: overallScore,
          dimensions: radar,
          details: analysisData
        });
        
        console.log(`[AI Controller] Analysis record created for resumeId: ${resumeId}`);
        
        // 最后更新简历状态
        await Resume.update({ 
          status: 'analyzed',
          last_analysis_date: new Date(),
          score: overallScore
        }, { where: { id: resumeId } });
        console.log(`[AI Controller] Resume status updated to 'analyzed' for resumeId: ${resumeId}`);
        
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

      let currentStatus = resume.status;
      // 检查是否有分析结果记录，如果有，状态强制修正为 analyzed
      const resultCount = await AnalysisResult.count({ where: { resume_id: resumeId } });
      if (resultCount > 0) {
        currentStatus = 'analyzed';
      } else if (currentStatus === 'analyzed') {
        // 如果状态是 analyzed 但没结果记录，说明出错了或还在写
        currentStatus = 'parsing';
      }

      res.json({
        success: true,
        data: {
          status: currentStatus,
          resumeId: resume.id
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // 获取分析结果
  async getAnalysisResult(req, res) {
    try {
      const { resumeId } = req.params;
      
      console.log('getAnalysisResult called for resumeId:', resumeId);
      
      // 获取最新的分析结果
      const result = await AnalysisResult.findOne({
        where: { resume_id: resumeId },
        order: [['id', 'DESC']]
      });

      console.log('Found analysis result:', result ? 'Yes' : 'No');
      if (result) {
        console.log('Analysis result data keys:', Object.keys(result.toJSON()));
        console.log('Detailed analysis type:', typeof result.detailed_analysis);
        console.log('Detailed analysis full:', JSON.stringify(result.detailed_analysis, null, 2));
        console.log('Dimensions (radar scores):', result.dimensions);
        console.log('Strengths:', result.strengths);
        console.log('Weaknesses:', result.weaknesses);
        console.log('Suggestions:', result.suggestions);
      }

      if (!result) {
        return res.status(404).json({ success: false, error: '分析结果不存在' });
      }

      // Log the response we're sending
      // Return the analysis data in a consistent format that matches the AI service response
                // --- Diagnostic Logs ---
                console.log(`[AI Controller] Fetching results for resumeId: ${resumeId}`);
                
                // 确保 dimensions 是对象
                let dimensions = result.dimensions || {};
                if (typeof dimensions === 'string') {
                    try { dimensions = JSON.parse(dimensions); } catch (e) { dimensions = {}; }
                }

                // 确保 strengths, weaknesses, suggestions 是数组
                let strengths = result.strengths || [];
                if (typeof strengths === 'string') {
                    try { strengths = JSON.parse(strengths); } catch (e) { strengths = []; }
                }
                let weaknesses = result.weaknesses || [];
                if (typeof weaknesses === 'string') {
                    try { weaknesses = JSON.parse(weaknesses); } catch (e) { weaknesses = []; }
                }
                let suggestions = result.suggestions || [];
                if (typeof suggestions === 'string') {
                    try { suggestions = JSON.parse(suggestions); } catch (e) { suggestions = []; }
                }

                // 获取原始解析数据
                let rawAnalysisData = result.detailed_analysis || {};
                if (typeof rawAnalysisData === 'string') {
                    try { rawAnalysisData = JSON.parse(rawAnalysisData); } catch (e) { rawAnalysisData = {}; }
                }

                // 构建平铺的响应数据，确保前端能直接访问
                const responseData = {
                    // 核心数据
                    success: true, // 增加冗余的 success 标记
                    overall_score: result.overall_score || 0,
                    scores_percent: dimensions,
                    evaluation_report: {
                        summary: result.summary || result.hiring_advice || rawAnalysisData.evaluation_report?.summary || rawAnalysisData.summary || '',
                        strengths: (strengths && strengths.length > 0) ? strengths : (rawAnalysisData.evaluation_report?.strengths || rawAnalysisData.strengths || []),
                        weaknesses: (weaknesses && weaknesses.length > 0) ? weaknesses : (rawAnalysisData.evaluation_report?.weaknesses || rawAnalysisData.weaknesses || []),
                        suggestions: (suggestions && suggestions.length > 0) ? suggestions : (rawAnalysisData.evaluation_report?.suggestions || rawAnalysisData.suggestions || []),
                        hiring_advice: result.hiring_advice || rawAnalysisData.evaluation_report?.hiring_advice || rawAnalysisData.hiring_advice || ''
                    },
                    
                    // 补充原始解析数据
                    basic_info: rawAnalysisData.basic_info || rawAnalysisData.basicInfo || rawAnalysisData.personalInfo || {},
                    parsed_data: rawAnalysisData,
        
        // 元数据
        service: result.ai_provider,
        model: result.ai_model,
        responseTime: result.processing_time,
        createdAt: result.analysis_date
      };
      
      console.log(`[AI Controller] Sending analysis results for resumeId: ${resumeId}`, {
        score: responseData.overall_score,
        hasReport: !!responseData.evaluation_report.summary,
        dimensionsCount: Object.keys(responseData.scores_percent).length
      });

      res.json({
        success: true,
        data: responseData
      });
    } catch (error) {
      console.error('getAnalysisResult error:', error);
      res.status(500).json({ success: false, error: error.message });
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

                const report = (analysisData && analysisData.evaluation_report) || (analysisData && analysisData.report) || {};
                const radar = (analysisData && analysisData.radar_scores) || (analysisData && analysisData.radarScores) || (analysisData && analysisData.score_detail) || (analysisData && analysisData.dimensions) || {};

                // 创建记录
                await AnalysisResult.create({
                    resume_id: resume.id,
                    user_id: userId,
                    company_id: req.user.company_id || null,
                    overall_score: overallScore,
                    dimensions: radar,
                    suggestions: report.career_advice || report.suggestions || [],
                    strengths: report.core_strengths || report.strengths || [],
                    weaknesses: report.potential_issues || report.weaknesses || [],
                    detailed_analysis: analysisData,
                    ai_provider: aiResult.service,
                    ai_model: aiResult.model,
                    processing_time: aiResult.responseTime
                });

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
            // 尝试通过名字匹配 resumeId
            const matchedResume = resumeList.find(r => r.name.includes(candidate.name) || candidate.name.includes(r.name));
            if (matchedResume) {
              await DeepAnalysisRecord.create({
                user_id: userId,
                company_id: req.user.company_id || null,
                resume_id: matchedResume.id,
                type: 'multi',
                overall_score: candidate.overall_score || 0,
                dimensions: candidate.scores_percent || {},
                details: {
                  ...candidate,
                  comparison_summary: result.data.comparison_summary,
                  recommendation: result.data.recommendation
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
