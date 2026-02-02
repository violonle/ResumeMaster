const { Resume, AnalysisResult, User, Job, ResumeJob } = require('../models');
const { Op } = require('sequelize');
const path = require('path');
const fs = require('fs');
const autoScreeningService = require('../services/autoScreeningService');

// 获取用户所有简历
const getAllResumes = async (req, res) => {
  try {
    const { jobId, groupByStatus } = req.query;
    
    // 如果请求包含 groupByStatus 或 jobId，转发给 libraryController 的逻辑处理
    // 这样可以兼容旧版客户端调用 /api/resumes 但期望新版过滤效果的情况
    if (groupByStatus === 'true' || jobId) {
      const libraryController = require('./libraryController');
      return libraryController.getTalentPoolResumes(req, res);
    }

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

    // 增强显示逻辑：如果数据库中的 name 是 "姓名"、"未知" 或空，尝试从 parsed_data 或 file_name 中获取
    const r = resume.toJSON ? resume.toJSON() : resume;
    if (!r.name || r.name === '姓名' || r.name === '未知' || r.name === '未命名') {
      const parsedData = r.parsed_data || {};
      const basicInfo = parsedData.basic_info || parsedData.personalInfo || parsedData;
      const realName = (parsedData.name && parsedData.name !== '姓名' && parsedData.name !== '未知' && parsedData.name !== '未命名') ? parsedData.name : 
                       (basicInfo.name && basicInfo.name !== '姓名' && basicInfo.name !== '未知' && basicInfo.name !== '未命名') ? basicInfo.name : 
                       r.file_name || '未命名';
      r.name = realName;
    }

    res.json({
      success: true,
      data: r
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
    const { file_name, file_size, file_type, file_path, raw_text, parsed_data, tags } = req.body;

    // 为新简历分配随机头像 (01-10.png)
    const randomAvatarIndex = Math.floor(Math.random() * 10) + 1;
    const avatar = `/dist/avatar/${randomAvatarIndex.toString().padStart(2, '0')}.png`;

    const resume = await Resume.create({
      user_id: req.user.id,
      company_id: req.user.company_id || null,
      file_name,
      file_size,
      file_type,
      file_path: file_path || 'uploads/temp.pdf', // 兼容测试
      raw_text,
      parsed_data,
      tags,
      avatar, // 分配固定的随机头像
      recruitment_status: '投递'
    });

    res.status(201).json({
      success: true,
      data: resume,
      message: '简历上传成功'
    });

    // 触发自动快评 (即使没有关联职位，也尝试寻找默认职位进行快评)
    autoScreeningService.triggerImmediateScreening(resume.id, 'unassigned').catch(err => {
        console.error('[ResumeController] 触发即时快评失败:', err);
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
      '快评': [],
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

// 更新简历招聘状态 (fallback logic)
const updateResumeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: '缺少状态参数'
        }
      });
    }

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

    const updateData = { recruitment_status: status };
    if (notes) {
      const parsedData = resume.parsed_data || {};
      parsedData.status_notes = notes;
      updateData.parsed_data = parsedData;
    }

    await resume.update(updateData);

    res.json({
      success: true,
      data: resume,
      message: '简历状态更新成功'
    });
  } catch (error) {
    console.error('更新简历状态失败:', error);
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
  getResumesByStatusGroup,
  updateResumeStatus
};