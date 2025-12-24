const { AnalysisResult } = require('../models');

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

    const result = await AnalysisResult.findOne({
      where: { resume_id: resumeId },
      order: [['analysis_date', 'DESC']]
    });

    if (!result) {
      return res.json({
        success: true,
        data: null
      });
    }

    res.json({
      success: true,
      data: result
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