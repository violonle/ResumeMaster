const { User, Job, RecruitmentProcess, Company, Resume, AnalysisResult, ResumeJob } = require('../models');
const { Op } = require('sequelize');

// 获取公司团队成员（同 company_name）
const getCompanyTeam = async (req, res) => {
  try {
    const companyName = req.user?.company_name || null;
    if (!companyName) {
      return res.status(200).json({ success: true, data: [] });
    }

    const team = await User.findAll({
      where: { company_name: companyName },
      attributes: ['id', 'username', 'email', 'avatar', 'role', 'company_name']
    });

    res.json({ success: true, data: team });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'COMPANY_TEAM_ERROR', message: error.message }
    });
  }
};

// 获取公司层面的招聘状态统计
const getRecruitmentStats = async (req, res) => {
  try {
    // 找到同公司所有用户ID
    const companyName = req.user?.company_name || null;
    let userIds = [req.user.id];

    if (companyName) {
      const users = await User.findAll({
        where: { company_name: companyName },
        attributes: ['id']
      });
      userIds = users.map(u => u.id);
    }

    // 查询这些用户的岗位并按状态分组
    const jobs = await Job.findAll({
      where: { user_id: userIds },
      attributes: ['id', 'status']
    });

    const stats = {
      active: 0,
      paused: 0,
      closed: 0,
      draft: 0,
      total: jobs.length
    };

    jobs.forEach(j => {
      const s = (j.status || '').toLowerCase();
      if (stats.hasOwnProperty(s)) {
        stats[s] += 1;
      }
    });

    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'RECRUITMENT_STATS_ERROR', message: error.message }
    });
  }
};

// 招聘漏斗统计（applied→screening→interview→offer→hired→rejected）
const getFunnelStats = async (req, res) => {
  try {
    const companyName = req.user?.company_name || null;
    let userIds = [req.user.id];
    if (companyName) {
      const users = await User.findAll({ where: { company_name: companyName }, attributes: ['id'] });
      userIds = users.map(u => u.id);
    }
    const whereUser = userIds.length === 1 ? { user_id: userIds[0] } : { user_id: { [Op.in]: userIds } };
    const { fn, col } = require('sequelize');
    const rows = await ResumeJob.findAll({ where: whereUser, attributes: ['status', [fn('COUNT', col('id')), 'count']], group: ['status'] });
    const map = { applied: 0, screening: 0, interview: 0, offer: 0, hired: 0, rejected: 0 };
    for (const r of rows) { map[(r.status || '').toLowerCase()] = Number((r.dataValues && r.dataValues.count) || 0); }
    res.json({ success: true, data: map });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'FUNNEL_ERROR', message: error.message } });
  }
};

module.exports = {
  getCompanyTeam,
  getRecruitmentStats,
  getFunnelStats,
  async getCompanyResumeStats(req, res) {
    try {
      const companyName = req.user?.company_name || null;
      let userIds = [req.user.id];
      if (companyName) {
        const users = await User.findAll({ where: { company_name: companyName }, attributes: ['id'] });
        userIds = users.map(u => u.id);
      }
      const whereUser = userIds.length === 1 ? { user_id: userIds[0] } : { user_id: { [Op.in]: userIds } };
      const resumes = await Resume.findAll({ where: whereUser, attributes: ['id','file_name','upload_date'] });
      const total = resumes.length;
      const weekCounts = [0,0,0,0,0,0,0];
      const typeCounts = { pdf:0, doc:0, docx:0, txt:0, other:0 };
      for (const r of resumes) {
        const d = new Date(r.upload_date);
        const dow = d.getDay();
        const idx = dow===0?6:(dow-1);
        weekCounts[idx]++;
        const fn = String(r.file_name||'').toLowerCase();
        if (fn.endsWith('.pdf')) typeCounts.pdf++;
        else if (fn.endsWith('.doc')) typeCounts.doc++;
        else if (fn.endsWith('.docx')) typeCounts.docx++;
        else if (fn.endsWith('.txt')) typeCounts.txt++;
        else typeCounts.other++;
      }
      res.json({ success: true, data: { total, weekCounts, typeCounts } });
    } catch (error) {
      res.status(500).json({ success: false, error: { code: 'COMPANY_RESUME_STATS_ERROR', message: error.message } });
    }
  },
  async getCompanyAnalysisStats(req, res) {
    try {
      const companyName = req.user?.company_name || null;
      let userIds = [req.user.id];
      if (companyName) {
        const users = await User.findAll({ where: { company_name: companyName }, attributes: ['id'] });
        userIds = users.map(u => u.id);
      }
      const whereUser = userIds.length === 1 ? { user_id: userIds[0] } : { user_id: { [Op.in]: userIds } };
      const analyses = await AnalysisResult.findAll({ where: whereUser, attributes: ['id','overall_score','analysis_date'] });
      const total = analyses.length;
      const excellent = analyses.reduce((acc,a)=> acc + (a.overall_score>=80?1:0), 0);
      const weekCounts = [0,0,0,0,0,0,0];
      for (const a of analyses) {
        const d = new Date(a.analysis_date);
        const dow = d.getDay();
        const idx = dow===0?6:(dow-1);
        weekCounts[idx]++;
      }
      res.json({ success: true, data: { total, excellent, weekCounts } });
    } catch (error) {
      res.status(500).json({ success: false, error: { code: 'COMPANY_ANALYSIS_STATS_ERROR', message: error.message } });
    }
  },
  async getTopRoles(req, res) {
    try {
      const companyName = req.user?.company_name || null;
      let userIds = [req.user.id];
      if (companyName) {
        const users = await User.findAll({ where: { company_name: companyName }, attributes: ['id'] });
        userIds = users.map(u => u.id);
      }
      const whereUser = userIds.length === 1 ? { user_id: userIds[0] } : { user_id: { [Op.in]: userIds } };
      const resumes = await Resume.findAll({ where: whereUser, attributes: ['id','tags','parsed_data'] });
      const map = new Map();
      for (const r of resumes) {
        const role = (r.parsed_data && r.parsed_data.jobTitle) || (Array.isArray(r.tags) && r.tags[0]) || '未分类';
        map.set(role, (map.get(role) || 0) + 1);
      }
      const top = Array.from(map.entries()).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([name,count])=>({ name, count }));
      res.json({ success: true, data: top });
    } catch (error) {
      res.status(500).json({ success: false, error: { code: 'COMPANY_TOP_ROLES_ERROR', message: error.message } });
    }
  },
  async getRecentActivity(req, res) {
    try {
      const companyName = req.user?.company_name || null;
      let userIds = [req.user.id];
      if (companyName) {
        const users = await User.findAll({ where: { company_name: companyName }, attributes: ['id'] });
        userIds = users.map(u => u.id);
      }
      const whereUser = userIds.length === 1 ? { user_id: userIds[0] } : { user_id: { [Op.in]: userIds } };
      const resumes = await Resume.findAll({ where: whereUser, attributes: ['file_name','upload_date'], order: [['upload_date','DESC']], limit: 20 });
      const analyses = await AnalysisResult.findAll({ where: whereUser, attributes: ['overall_score','analysis_date'], order: [['analysis_date','DESC']], limit: 20 });
      const act = [];
      for (const r of resumes) act.push({ type: 'resume', title: `上传简历: ${r.file_name}`, time: r.upload_date, icon: 'fa-file-alt' });
      for (const a of analyses) act.push({ type: 'analysis', title: `分析完成: ${a.overall_score}分`, time: a.analysis_date, icon: 'fa-chart-line' });
      const list = act.sort((a,b)=> new Date(b.time) - new Date(a.time)).slice(0, 10);
      res.json({ success: true, data: list });
    } catch (error) {
      res.status(500).json({ success: false, error: { code: 'COMPANY_RECENT_ACTIVITY_ERROR', message: error.message } });
    }
  },
  async getCompanyProfile(req, res) {
    try {
      const companyId = req.user?.company_id || null;
      const companyName = req.user?.company_name || null;
      let company = null;
      if (companyId) {
        company = await Company.findOne({ where: { id: companyId } });
      } else if (companyName) {
        company = await Company.findOne({ where: { name: companyName } });
      }
      if (!company) {
        return res.json({ success: true, data: null });
      }
      res.json({ success: true, data: company });
    } catch (error) {
      res.status(500).json({ success: false, error: { code: 'COMPANY_PROFILE_ERROR', message: error.message } });
    }
  },
  async upsertCompanyProfile(req, res) {
    try {
      const { name, province, city, district, address, contact_name, contact_phone } = req.body || {};
      if (!name || String(name).trim().length === 0) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_COMPANY', message: '企业名称不能为空' } });
      }

      let company = null;
      // 优先通过当前用户的 company_id 查找
      if (req.user?.company_id) {
        company = await Company.findOne({ where: { id: req.user.company_id } });
      }
      if (!company) {
        company = await Company.findOne({ where: { name } });
      }

      if (!company) {
        company = await Company.create({
          name,
          province: province || null,
          city: city || null,
          district: district || null,
          address: address || null,
          contact_account_id: req.user.id,
          verification_info: { contact_name: contact_name || null, contact_phone: contact_phone || null }
        });
      } else {
        await company.update({
          name,
          province: province || null,
          city: city || null,
          district: district || null,
          address: address || null,
          contact_account_id: req.user.id,
          verification_info: { ...(company.verification_info || {}), contact_name: contact_name || null, contact_phone: contact_phone || null }
        });
      }

      // 更新用户的公司关联信息
      await User.update({ company_name: company.name, company_id: company.id }, { where: { id: req.user.id } });

      const updatedUser = await User.findOne({ where: { id: req.user.id }, attributes: ['id','username','email','phone','company_name'] });

      res.json({ success: true, data: { company, user: updatedUser }, message: '企业信息已保存' });
    } catch (error) {
      res.status(500).json({ success: false, error: { code: 'COMPANY_UPSERT_ERROR', message: error.message } });
    }
  },
  // 招聘流程 CRUD
  async getCompanyProcesses(req, res) {
    try {
      const companyName = req.user?.company_name || null;
      const where = companyName ? { company_name: companyName } : { user_id: req.user.id };
      const processes = await RecruitmentProcess.findAll({
        where,
        order: [['created_at', 'DESC']]
      });
      res.json({ success: true, data: processes });
    } catch (error) {
      res.status(500).json({ success: false, error: { code: 'PROCESS_LIST_ERROR', message: error.message } });
    }
  },

  async createCompanyProcess(req, res) {
    try {
      const { name, steps, is_default } = req.body;
      if (!name || !steps || !Array.isArray(steps)) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_PROCESS', message: '缺少名称或步骤' } });
      }
      const process = await RecruitmentProcess.create({
        user_id: req.user.id,
        company_name: req.user?.company_name || null,
        name,
        steps,
        is_default: !!is_default,
        status: 'active'
      });
      res.json({ success: true, data: process, message: '流程创建成功' });
    } catch (error) {
      res.status(500).json({ success: false, error: { code: 'PROCESS_CREATE_ERROR', message: error.message } });
    }
  },

  async updateCompanyProcess(req, res) {
    try {
      const { id } = req.params;
      const { name, steps, is_default, status } = req.body;
      const companyName = req.user?.company_name || null;
      const where = companyName ? { id, company_name: companyName } : { id, user_id: req.user.id };
      const [count] = await RecruitmentProcess.update(
        { name, steps, is_default, status },
        { where, returning: true }
      );
      if (count === 0) {
        return res.status(404).json({ success: false, error: { code: 'PROCESS_NOT_FOUND', message: '流程不存在' } });
      }
      const process = await RecruitmentProcess.findOne({ where });
      res.json({ success: true, data: process, message: '流程更新成功' });
    } catch (error) {
      res.status(500).json({ success: false, error: { code: 'PROCESS_UPDATE_ERROR', message: error.message } });
    }
  },

  async deleteCompanyProcess(req, res) {
    try {
      const { id } = req.params;
      const companyName = req.user?.company_name || null;
      const where = companyName ? { id, company_name: companyName } : { id, user_id: req.user.id };
      const count = await RecruitmentProcess.destroy({ where });
      if (count === 0) {
        return res.status(404).json({ success: false, error: { code: 'PROCESS_NOT_FOUND', message: '流程不存在' } });
      }
      res.json({ success: true, message: '流程删除成功' });
    } catch (error) {
      res.status(500).json({ success: false, error: { code: 'PROCESS_DELETE_ERROR', message: error.message } });
    }
  }
};
