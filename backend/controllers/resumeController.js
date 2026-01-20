const { Resume, AnalysisResult, User } = require('../models');
const { Op } = require('sequelize');

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
    
    // 构建多租户隔离的查询条件
    const whereClause = {
      id,
      [Op.or]: [
        { user_id: req.user.id },
        req.user.company_id ? { company_id: req.user.company_id } : null
      ].filter(Boolean)
    };
    
    console.log('Resume query where clause:', whereClause);
    console.log('Current user:', req.user);
    
    const resume = await Resume.findOne({
      where: whereClause,
      include: [
        { model: User, attributes: ['id', 'username', 'avatar'] }
      ]
    });

    if (!resume) {
      console.log('Resume not found for id:', id, 'and user:', req.user.id);
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
    console.error('Error in getResumeById:', error);
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
      company_id: req.user.company_id || null,
      file_name,
      file_size,
      file_type,
      parsed_data,
      tags,
      recruitment_status: '投递'
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
    const { parsed_data, tags, job_title, recruitment_status, is_talent_pool, status } = req.body;

    // 检查简历是否存在且属于当前用户
    const resume = await Resume.findOne({
      where: {
        id,
        [Op.or]: [
          { user_id: req.user.id },
          req.user.company_id ? { company_id: req.user.company_id } : null
        ].filter(Boolean)
      }
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

    // 更新简历信息
    await resume.update({
      parsed_data,
      tags,
      job_title,
      recruitment_status,
      is_talent_pool,
      status
    });

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

    // 检查简历是否存在且属于当前用户
    const resume = await Resume.findOne({
      where: {
        id,
        [Op.or]: [
          { user_id: req.user.id },
          req.user.company_id ? { company_id: req.user.company_id } : null
        ].filter(Boolean)
      }
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

    // 删除关联的分析结果
    await AnalysisResult.destroy({ where: { resume_id: id } });

    // 删除简历
    await resume.destroy();

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

// 批量删除简历
const batchDeleteResumes = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: '请提供要删除的简历ID列表'
        }
      });
    }

    // 构建多租户隔离的查询条件
    const whereClause = {
      id: { [Op.in]: ids },
      [Op.or]: [
        { user_id: req.user.id },
        req.user.company_id ? { company_id: req.user.company_id } : null
      ].filter(Boolean)
    };

    // 查找要删除的简历
    const resumes = await Resume.findAll({ where: whereClause });

    if (resumes.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'RESUME_NOT_FOUND',
          message: '未找到可删除的简历'
        }
      });
    }

    const resumeIds = resumes.map(r => r.id);

    // 删除关联的分析结果
    await AnalysisResult.destroy({ 
      where: { 
        resume_id: { [Op.in]: resumeIds } 
      } 
    });

    // 批量删除简历
    await Resume.destroy({ where: { id: { [Op.in]: resumeIds } } });

    res.json({
      success: true,
      message: `成功删除 ${resumes.length} 份简历`
    });
  } catch (error) {
    console.error('批量删除简历失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'RESUME_ERROR',
        message: '批量删除失败: ' + error.message
      }
    });
  }
};

// 获取招聘状态分组的简历
const getResumesByStatusGroup = async (req, res) => {
  try {
    // 多租户隔离逻辑
    const whereClause = req.user.company_id 
      ? { company_id: req.user.company_id } 
      : { user_id: req.user.id };

    const resumes = await Resume.findAll({
      where: whereClause,
      order: [['upload_date', 'DESC']]
    });

    // 按招聘状态分组
    const statusGroups = {
      '投递': [],
      '初筛': [],
      '面试': [],
      'Offer': [],
      '入职': []
    };

    resumes.forEach(resume => {
      const status = resume.recruitment_status || '投递';
      if (statusGroups[status]) {
        statusGroups[status].push(resume);
      }
    });

    res.json({
      success: true,
      data: statusGroups
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
  deleteResume,
  batchDeleteResumes,
  getResumesByStatusGroup
};