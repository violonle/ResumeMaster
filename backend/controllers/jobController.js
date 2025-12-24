const { Job, User } = require('../models');
const jobImportService = require('../services/jobImportService');

// 获取所有职位
const getAllJobs = async (req, res) => {
  try {
    const { status } = req.query;
    let whereClause = {};
    
    // 多租户隔离逻辑
    if (req.user.company_id) {
      whereClause.company_id = req.user.company_id;
    } else {
      whereClause.user_id = req.user.id;
    }
    
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
    
    // 多租户隔离逻辑
    const whereClause = req.user.company_id 
      ? { id, company_id: req.user.company_id } 
      : { id, user_id: req.user.id };

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
    const { title, description, requirements, salary_range, location, experience_required, status } = req.body;

    const job = await Job.create({
      user_id: req.user.id,
      company_id: req.user.company_id || null, // 记录公司ID
      title,
      description,
      requirements,
      salary_range,
      location,
      experience_required,
      status
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
    const { title, description, requirements, salary_range, location, experience_required, status } = req.body;

    // 多租户隔离逻辑
    const whereClause = req.user.company_id 
      ? { id, company_id: req.user.company_id } 
      : { id, user_id: req.user.id };

    const updatedJob = await Job.update(
      { title, description, requirements, salary_range, location, experience_required, status },
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

module.exports = {
  getAllJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
  importJobFromUrl
};