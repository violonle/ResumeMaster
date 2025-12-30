const { AnalysisResult, Resume, DeepAnalysisRecord } = require('../models');
const AIAnalysisService = require('../services/aiAnalysisService');
const promptService = require('../services/promptService');
const textExtractor = require('../services/textExtractor');
const ResumeParseService = require('../services/resumeParseService');

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

    // 优先从 DeepAnalysisRecord 获取最新的深度解析记录
    const result = await DeepAnalysisRecord.findOne({
      where: { resume_id: resumeId },
      order: [['analysis_date', 'DESC']]
    });

    if (!result) {
      return res.json({
        success: true,
        data: null
      });
    }

    // 将 DeepAnalysisRecord 结构映射为前端期望的格式（兼容旧的 AnalysisResult 结构和新版 V2 结构）
    const details = result.details || {};
    
    // 兼容性处理：提取基础信息
    const basicInfo = details.basic_info || details.personalInfo || details.parsed_data?.basic_info || {};
    
    const mappedResult = {
      ...details, // 展开详情内容
      ...result.toJSON(), // 覆盖基础字段
      // 兼容性字段
      personalInfo: basicInfo,
      basic_info: basicInfo,
      // 确保维度得分存在
      dimensions: result.dimensions || details.radar || details.dimensions || details.scores_percent || {},
      detailed_analysis: details,
      // 兼容 legacy 前端 (resume-tools-controller.js) 预期的 scores 结构
      scores: details.scores || { 
        overall: result.overall_score,
        dimensions: result.dimensions || details.radar || details.dimensions || details.scores_percent || {}
      },
      // 兼容 V2 版本的 report 字段
      report: details.evaluation_report || details.analysis_report || details.report || details.evaluation || '暂无详细报告内容'
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