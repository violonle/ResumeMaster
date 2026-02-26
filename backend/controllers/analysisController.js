const { AnalysisResult, Resume, Job } = require('../models');
const AIAnalysisService = require('../services/aiAnalysisService');
const promptService = require('../services/promptService');
const textExtractor = require('../services/textExtractor');
const ResumeParseService = require('../services/resumeParseService');

const { createAnalysisJson } = require('../utils/dimensionNormalizer');
const { Op } = require('sequelize');

const aiAnalysisService = new AIAnalysisService();
const resumeParseService = new ResumeParseService();

// 获取所有分析结果
const getAllAnalysisResults = async (req, res) => {
  try {
    // 多租户隔离逻辑
    const whereClause = req.user.company_id
      ? { company_id: req.user.company_id }
      : { user_id: req.user.id };

    const results = await AnalysisResult.findAll({
      include: [{
        model: require('../models').Resume,
        as: 'Resume',
        // 与模型关系保持一致，不使用错误的别名
        where: whereClause
      }],
      order: [['analysis_date', 'DESC']]
    });

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'ANALYSIS_ERROR',
        message: error.message
      }
    });
  }
};

// 获取特定简历的分析结果
const getAnalysisResultsByResume = async (req, res) => {
  try {
    const { resumeId } = req.params;

    const results = await AnalysisResult.findAll({
      where: { resume_id: resumeId },
      order: [['analysis_date', 'DESC']]
    });

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'ANALYSIS_ERROR',
        message: error.message
      }
    });
  }
};

// 创建新的分析结果
const createAnalysisResult = async (req, res) => {
  try {
    const { resume_id, overall_score, dimensions, suggestions, strengths, weaknesses, target_job, detailed_analysis } = req.body;

    const whereClause = req.user.company_id
      ? { id: resume_id, company_id: req.user.company_id }
      : { id: resume_id, user_id: req.user.id };

    // 验证简历属于当前用户
    const resume = await require('../models').Resume.findOne({
      where: whereClause
    });

    if (!resume) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'RESUME_NOT_FOUND',
          message: '简历不存在或不属于当前用户'
        }
      });
    }

    const result = await AnalysisResult.create({
      resume_id,
      user_id: req.user.id,
      company_id: req.user.company_id,
      overall_score,
      dimensions,
      suggestions,
      strengths,
      weaknesses,
      target_job,
      detailed_analysis
    });

    res.status(201).json({
      success: true,
      data: result,
      message: '分析结果创建成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'ANALYSIS_ERROR',
        message: error.message
      }
    });
  }
};

// 获取简历最新分析结果
const getLatestAnalysisResult = async (req, res) => {
  try {
    const { resumeId } = req.params;
    const userId = req.user.id;
    const companyId = req.user.company_id;

    const whereClause = {
      resume_id: resumeId,
      [Op.or]: [{ type: 'single' }, { type: null }]
    };
    if (companyId) {
      whereClause.company_id = companyId;
    } else {
      whereClause.user_id = userId;
    }

    const rows = await AnalysisResult.findAll({
      where: whereClause,
      include: [
        {
          model: Resume,
          as: 'Resume',
          attributes: ['id', 'name', 'file_name', 'file_type', 'file_path', 'recruitment_status']
        },
        {
          model: Job,
          as: 'Job',
          attributes: ['id', 'title']
        }
      ],
      order: [['analysis_date', 'DESC']], // 核心修正：严格按照时间倒序取最新一条
      limit: 10
    });

    const parseMaybeJson = (val) => {
      if (!val) return null;
      if (typeof val === 'string') {
        try { return JSON.parse(val); } catch (_) { return null; }
      }
      return val;
    };

    // 改进：增加权重计算，优先返回得分完整且内容丰富的记录
    const getDeepScore = (row) => {
      if (!row) return -1;
      let score = 0;

      const dims = parseMaybeJson(row.dimensions) || {};
      const keys = ['skills', 'experience', 'education', 'stability', 'potential', 'teamwork'];
      const dimCount = keys.filter(k => Object.prototype.hasOwnProperty.call(dims, k)).length;
      const hasAnyDimValue = Object.values(dims).some(v => Number(v || 0) > 0);

      if (dimCount >= 4) score += 50; // 维度基本完整
      if (hasAnyDimValue) score += 30; // 有实际分数
      if (row.overall_score > 0) score += 20; // 有总分

      const detail = parseMaybeJson(row.detailed_analysis) || {};
      const hasText = !!(row.summary || row.hiring_advice || detail.summary);
      if (hasText) score += 40; // 有详细文本内容

      return score;
    };

    // 按权重排序，取最高分的一条
    let result = null;
    if (rows && rows.length > 0) {
      const scoredRows = rows.map(r => ({ row: r, score: getDeepScore(r) }));
      scoredRows.sort((a, b) => b.score - a.score);
      if (scoredRows[0].score > 30) { // 设定一个最小阈值，确保质量
        result = scoredRows[0].row;
      }
    }

    if (!result) {
      // 尝试从 deep_analysis_records 表获取 (兼容旧数据)
      try {
        const { DeepAnalysisRecord } = require('../models');
        const deepRecord = await DeepAnalysisRecord.findOne({
          where: { resume_id: resumeId },
          order: [['created_at', 'DESC']]
        });

        if (deepRecord) {
          // 构造兼容 AnalysisResult 的结构
          result = {
            id: deepRecord.id,
            resume_id: deepRecord.resume_id,
            overall_score: 0,
            dimensions: deepRecord.analysis_data || {},
            detailed_analysis: deepRecord.analysis_data || {},
            analysis_date: deepRecord.created_at,
            type: 'single'
          };

          // 补全关联信息
          const resume = await Resume.findByPk(resumeId, {
            attributes: ['id', 'file_name', 'file_type', 'file_path', 'recruitment_status']
          });
          if (resume) {
            result.Resume = resume;
            result.dataValues = { ...result, Resume: resume }; // Sequelize structure compatibility
          }
        }
      } catch (err) {
        console.warn('Failed to fetch from DeepAnalysisRecord:', err);
      }
    }

    if (!result) {
      return res.json({
        success: true,
        data: null
      });
    }

    // 将 AnalysisResult 结构映射为前端期望的格式（兼容旧结构和新版 V2 结构）
    let details = result.detailed_analysis || {};
    if (typeof details === 'string') {
      try { details = JSON.parse(details); } catch (_) { details = {}; }
    }
    // Use shared utility to normalize dimensions and apply fallback logic
    // This replaces ~100 lines of duplicate logic
    const analysisJson = createAnalysisJson({
      id: result.id,
      overall_score: (result && result.overall_score > 0) ? result.overall_score : 0,
      dimensions: rawDimensions,
      detailed_analysis: details
    });

    let dimensions = analysisJson ? analysisJson.dimensions : {};


    // 兼容性处理：提取基础信息
    const basicInfo = details.basic_info || details.personalInfo || details.parsed_data?.basic_info || {};

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

    const mappedResult = {
      ...details,
      ...result.toJSON(),
      // 兼容性字段
      personalInfo: basicInfo,
      basic_info: basicInfo,
      // 确保维度得分存在
      dimensions,
      detailed_analysis: details,
      // 兼容 legacy 前端 (resume-tools-controller.js) 预期的 scores 结构
      scores: details.scores || {
        overall: result.overall_score,
        dimensions
      },
      // 兼容 V2 版本的 report 字段
      report: computedReport
    };

    res.json({
      success: true,
      data: mappedResult
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'ANALYSIS_ERROR',
        message: error.message
      }
    });
  }
};

module.exports = {
  getAllAnalysisResults,
  getAnalysisResultsByResume,
  createAnalysisResult,
  getLatestAnalysisResult
};
