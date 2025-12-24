const DomesticAIService = require('../services/domesticAIService');
const axios = require('axios');
const cheerio = require('cheerio');
const { extractTextFromFile, buildFallbackTextFromParsed } = require('../services/textExtractor');
const { Resume, AnalysisResult } = require('../models');
const logger = require('../utils/logger');
const promptService = require('../services/promptService');
const { UserActivity } = require('../models');

const aiService = new DomesticAIService();

class AIController {
  // 简历分析
  async analyzeResume(req, res) {
    try {
      const { resumeText, jobDescription, resumeId } = req.body;
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
        this.processAnalysisBackground(resumeId, text, jobDescription, req.user).catch(err => {
          logger.error('后台分析任务失败', { resumeId, error: err.message });
        });
        
        return;
      }

      // 没有resumeId的情况（直接文本分析），保持同步调用
      logger.info('Analyze request (sync)', { userId, hasJobDescription: !!jobDescription });
      const result = await aiService.analyzeResume(text, jobDescription, req.user);

      if (result.success) {
        let analysisData = result.data;
        if (typeof analysisData === 'string') {
            try {
                const cleanJson = analysisData.replace(/```json\n?|```/g, '').trim();
                analysisData = JSON.parse(cleanJson);
            } catch (e) {
                logger.error('Failed to parse AI result JSON', { error: e.message });
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
  async processAnalysisBackground(resumeId, text, jobDescription, user) {
    try {
      logger.info('Starting background analysis', { resumeId });
      const result = await aiService.analyzeResume(text, jobDescription, user);

      if (result.success) {
        // 保存分析结果
        let analysisData = result.data;
        console.log('AI Service returned data type:', typeof analysisData);
        console.log('AI Service returned data:', JSON.stringify(analysisData, null, 2));
        
        if (typeof analysisData === 'string') {
            try {
                const cleanJson = analysisData.replace(/```json\n?|```/g, '').trim();
                analysisData = JSON.parse(cleanJson);
            } catch (e) {
                logger.error('Failed to parse AI result JSON', { error: e.message });
            }
        }
        
        // 计算分数和提取关键信息用于存储
        const overallScore = analysisData.overall_score || analysisData.overallScore || 0;
        const report = analysisData.evaluation_report || analysisData.report || {};
        const radar = analysisData.radar_scores || analysisData.radarScores || {};

        console.log('Extracted for storage:', {
          overallScore,
          reportKeys: Object.keys(report),
          radarKeys: Object.keys(radar)
        });

        await AnalysisResult.create({
          resume_id: resumeId,
          user_id: user.id,
          overall_score: overallScore,
          dimensions: radar,
          suggestions: report.career_advice || report.suggestions || [],
          strengths: report.core_strengths || report.strengths || [],
          weaknesses: report.potential_issues || report.weaknesses || [],
          detailed_analysis: analysisData,
          ai_provider: result.service,
          ai_model: result.model,
          processing_time: result.responseTime
        });

        console.log('AnalysisResult created successfully for resumeId:', resumeId);

        // 更新简历状态
        await Resume.update({ 
          status: 'analyzed',
          last_analysis_date: new Date()
        }, { where: { id: resumeId } });
        
        logger.info('Background analysis completed', { resumeId });
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

      res.json({
        success: true,
        data: {
          status: resume.status,
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
        order: [['analysis_date', 'DESC']]
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
      const analysisData = result.detailed_analysis || {};
      
      // Ensure we have the expected structure with fallbacks to stored fields
      const responseData = {
        analysis: {
          basic_info: analysisData.basic_info || analysisData.basicInfo || {},
          evaluation_report: analysisData.evaluation_report || analysisData.report || {
            core_strengths: result.strengths || [],
            potential_issues: result.weaknesses || [],
            career_advice: result.suggestions || []
          },
          radar_scores: analysisData.radar_scores || analysisData.radarScores || result.dimensions || {},
          overall_score: analysisData.overall_score || analysisData.overallScore || result.overall_score || 0,
          summary: analysisData.summary || ''
        },
        service: result.ai_provider,
        model: result.ai_model,
        responseTime: result.processing_time,
        createdAt: result.analysis_date
      };
      
      console.log('Sending response with analysis data:', {
        hasAnalysis: !!responseData.analysis,
        analysisType: typeof responseData.analysis,
        analysisKeys: responseData.analysis ? Object.keys(responseData.analysis) : 'N/A'
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

      if (!resumeIds || !Array.isArray(resumeIds) || resumeIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: '请提供有效的简历ID列表'
        });
      }

      // 获取所有简历
      const resumes = await Resume.findAll({
        where: { 
          id: resumeIds, 
          user_id: userId 
        }
      });

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
        let content = resume.parsed_data?.content || '';
        if (!content) {
            try {
                content = await extractTextFromFile(resume.file_path);
            } catch (e) {
                logger.error(`Failed to extract text for resume ${resume.id}`, e);
            }
        }

        if (!content) {
            results.push({ id: resume.id, success: false, error: '无法提取简历内容' });
            continue;
        }

        // 调用AI服务 (使用模板)
        try {
            const aiResult = await aiService.analyzeResume(content, jobDescription, req.user);
            
            if (aiResult.success) {
                // 保存结果
                let analysisData = aiResult.data;
                if (typeof analysisData === 'string') {
                    try { analysisData = JSON.parse(analysisData.replace(/```json\n?|```/g, '').trim()); } catch (_) {}
                }

                // 创建记录
                await AnalysisResult.create({
                    resume_id: resume.id,
                    user_id: userId,
                    overall_score: analysisData.overall_score || 0,
                    dimensions: analysisData.radar_scores || {},
                    suggestions: analysisData.evaluation_report?.career_advice || [],
                    strengths: analysisData.evaluation_report?.core_strengths || [],
                    weaknesses: analysisData.evaluation_report?.potential_issues || [],
                    detailed_analysis: analysisData,
                    ai_provider: aiResult.service,
                    ai_model: aiResult.model,
                    processing_time: aiResult.responseTime
                });

                // 更新简历状态
                await resume.update({ status: 'analyzed', last_analysis_date: new Date() });

                results.push({ 
                    id: resume.id, 
                    success: true, 
                    data: analysisData,
                    basic_info: analysisData.basic_info,
                    scores_star: analysisData.radar_scores,
                    scores_percent: analysisData.radar_scores // Simplified mapping
                });
            } else {
                results.push({ id: resume.id, success: false, error: aiResult.error });
            }
        } catch (err) {
            logger.error(`Batch analysis failed for ${resume.id}`, err);
            results.push({ id: resume.id, success: false, error: err.message });
        }
      }

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
      const result = await aiService.compareResumes(resumeList, jobDescription || '');
      
      if (result.success) {
        return res.json({ success: true, data: result.data });
      }
      return res.status(500).json({ success: false, error: result.error || '简历对比失败' });
    } catch (e) {
      logger.error('简历对比失败', { message: e.message });
      return res.status(500).json({ success: false, error: '简历对比失败' });
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
