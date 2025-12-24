const { Resume, AnalysisResult, User } = require('../models');

// 获取用户所有简历
const getAllResumes = async (req, res) => {
  try {
    // 多租户隔离逻辑
    const whereClause = req.user.company_id 
      ? { company_id: req.user.company_id } 
      : { user_id: req.user.id };

    const resumes = await Resume.findAll({
      where: whereClause,
      order: [['upload_date', 'DESC']],
      include: [
        { model: User, attributes: ['id', 'username', 'avatar'] } // 包含上传者信息
      ]
    });

    res.json({
      success: true,
      data: resumes
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'RESUME_ERROR',
        message: error.message
      }
    });
  }
};

// 获取特定简历详情
const getResumeById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // 多租户隔离逻辑
    const whereClause = req.user.company_id 
      ? { id, company_id: req.user.company_id } 
      : { id, user_id: req.user.id };

    const resume = await Resume.findOne({
      where: whereClause,
      include: [
        { model: User, attributes: ['id', 'username', 'avatar'] }
      ]
    });

    if (!resume) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'RESUME_NOT_FOUND',
          message: '简历不存在'
        }
      });
    }

    res.json({
      success: true,
      data: resume
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'RESUME_ERROR',
        message: error.message
      }
    });
  }
};

// 上传新简历
const createResume = async (req, res) => {
  try {
    const { file_name, file_size, file_type, parsed_data, tags } = req.body;

    const resume = await Resume.create({
      user_id: req.user.id,
      company_id: req.user.company_id || null, // 记录公司ID
      file_name,
      file_size,
      file_type,
      parsed_data,
      tags
    });

    res.status(201).json({
      success: true,
      data: resume,
      message: '简历上传成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'RESUME_ERROR',
        message: error.message
      }
    });
  }
};

// 更新简历信息
const updateResume = async (req, res) => {
  try {
    const { id } = req.params;
    const { file_name, parsed_data, status, tags } = req.body;

    // 多租户隔离逻辑
    const whereClause = req.user.company_id 
      ? { id, company_id: req.user.company_id } 
      : { id, user_id: req.user.id };

    const updatedResume = await Resume.update(
      { file_name, parsed_data, status, tags },
      { where: whereClause, returning: true }
    );

    if (updatedResume[0] === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'RESUME_NOT_FOUND',
          message: '简历不存在'
        }
      });
    }

    const resume = await Resume.findByPk(id);

    res.json({
      success: true,
      data: resume,
      message: '简历更新成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'RESUME_ERROR',
        message: error.message
      }
    });
  }
};

// 删除简历
const deleteResume = async (req, res) => {
  try {
    const { id } = req.params;

    // 先删除相关的分析结果
    await AnalysisResult.destroy({
      where: { resume_id: id }
    });

    // 删除简历
    const whereClause = req.user.company_id 
      ? { id, company_id: req.user.company_id } 
      : { id, user_id: req.user.id };

    const deletedRows = await Resume.destroy({
      where: whereClause
    });

    if (deletedRows === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'RESUME_NOT_FOUND',
          message: '简历不存在'
        }
      });
    }

    res.json({
      success: true,
      message: '简历删除成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'RESUME_ERROR',
        message: error.message
      }
    });
  }
};

module.exports = {
  getAllResumes,
  getResumeById,
  createResume,
  updateResume,
  deleteResume
};