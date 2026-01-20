const { Job, User } = require('../models');
const { Op } = require('sequelize');
const jobImportService = require('../services/jobImportService');

// 获取所有职位
const getAllJobs = async (req, res) => {
  try {
    const { status } = req.query;
    
    // 多租户隔离逻辑：允许查看自己创建的或所属公司的职位
    let whereClause = {
      [Op.or]: req.user.company_id 
        ? [
            { company_id: req.user.company_id },
            { user_id: req.user.id }
          ]
        : [
            { user_id: req.user.id }
          ]
    };
    
    if (status) {
      whereClause.status = status;
    }

    const jobs = await Job.findAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      include: [
        { model: User, attributes: ['id', 'username', 'avatar'] } // 包含创建者信息
      ]
    });

    res.json({
      success: true,
      data: jobs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'JOB_ERROR',
        message: error.message
      }
    });
  }
};

// 获取特定职位详情
const getJobById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // 多租户隔离逻辑：允许查看自己创建的或所属公司的职位
    const whereClause = {
      id,
      [Op.or]: req.user.company_id 
        ? [
            { company_id: req.user.company_id },
            { user_id: req.user.id }
          ]
        : [
            { user_id: req.user.id }
          ]
    };

    const job = await Job.findOne({
      where: whereClause,
      include: [
        { model: User, attributes: ['id', 'username', 'avatar'] }
      ]
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'JOB_NOT_FOUND',
          message: '职位不存在'
        }
      });
    }

    res.json({
      success: true,
      data: job
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'JOB_ERROR',
        message: error.message
      }
    });
  }
};

// 创建新职位
const createJob = async (req, res) => {
  try {
    const { 
      title, description, requirements, salary_range, location, experience_required, status,
      enable_auto_screening, auto_reject_score, notify_high_score, high_score_threshold, weight_preference,
      positions_count, expiry_date
    } = req.body;

    const job = await Job.create({
      user_id: req.user.id,
      company_id: req.user.company_id || null, // 记录公司ID
      title,
      description,
      requirements,
      salary_range,
      location,
      experience_required,
      status,
      enable_auto_screening: enable_auto_screening || false,
      auto_reject_score: auto_reject_score || 60,
      notify_high_score: notify_high_score || false,
      high_score_threshold: high_score_threshold || 85,
      weight_preference: weight_preference || 'balanced',
      positions_count: positions_count || 1,
      expiry_date: expiry_date || null
    });

    res.status(201).json({
      success: true,
      data: job,
      message: '职位创建成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'JOB_ERROR',
        message: error.message
      }
    });
  }
};

// 更新职位信息
const updateJob = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      title, description, requirements, salary_range, location, experience_required, status,
      enable_auto_screening, auto_reject_score, notify_high_score, high_score_threshold, weight_preference,
      positions_count, expiry_date
    } = req.body;

    // 多租户隔离逻辑
    const whereClause = req.user.company_id 
      ? { id, company_id: req.user.company_id } 
      : { id, user_id: req.user.id };

    const updateData = { 
      title, description, requirements, salary_range, location, experience_required, status,
      enable_auto_screening, auto_reject_score, notify_high_score, high_score_threshold, weight_preference,
      positions_count, expiry_date
    };

    // 过滤掉 undefined 的值，避免覆盖已有数据（如果某些字段没传）
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    const updatedJob = await Job.update(
      updateData,
      { where: whereClause, returning: true }
    );

    if (updatedJob[0] === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'JOB_NOT_FOUND',
          message: '职位不存在'
        }
      });
    }

    const job = await Job.findByPk(id);

    res.json({
      success: true,
      data: job,
      message: '职位更新成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'JOB_ERROR',
        message: error.message
      }
    });
  }
};

// 删除职位
const deleteJob = async (req, res) => {
  try {
    const { id } = req.params;

    // 多租户隔离逻辑
    const whereClause = req.user.company_id 
      ? { id, company_id: req.user.company_id } 
      : { id, user_id: req.user.id };

    const deletedRows = await Job.destroy({
      where: whereClause
    });

    if (deletedRows === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'JOB_NOT_FOUND',
          message: '职位不存在'
        }
      });
    }

    res.json({
      success: true,
      message: '职位删除成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'JOB_ERROR',
        message: error.message
      }
    });
  }
};

// URL导入职位解析
const importJobFromUrl = async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_URL',
          message: '请提供有效的URL'
        }
      });
    }

    const data = await jobImportService.parseUrl(url);

    res.json({
      success: true,
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'IMPORT_ERROR',
        message: error.message
      }
    });
  }
};

// 获取公开职位列表（供Portal使用）
const getPublicJobs = async (req, res) => {
  try {
    const { keyword, location, experience } = req.query;
    let whereClause = { status: 'published' }; // 只显示已发布的职位

    if (keyword) {
      whereClause[Op.or] = [
        { title: { [Op.like]: `%${keyword}%` } },
        { description: { [Op.like]: `%${keyword}%` } }
      ];
    }
    
    if (location) {
      whereClause.location = { [Op.like]: `%${location}%` };
    }

    if (experience) {
      whereClause.experience_required = experience;
    }

    const jobs = await Job.findAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      include: [
        { model: User, attributes: ['id', 'username', 'avatar'] }
      ]
    });

    res.json({
      success: true,
      data: jobs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'JOB_ERROR',
        message: error.message
      }
    });
  }
};

// 获取公开职位详情（供Portal使用）
const getPublicJobById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const job = await Job.findOne({
      where: { id, status: 'published' },
      include: [
        { model: User, attributes: ['id', 'username', 'avatar'] }
      ]
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'JOB_NOT_FOUND',
          message: '职位不存在或已下架'
        }
      });
    }

    res.json({
      success: true,
      data: job
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'JOB_ERROR',
        message: error.message
      }
    });
  }
};

module.exports = {
  getAllJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
  importJobFromUrl,
  getPublicJobs,
  getPublicJobById
};