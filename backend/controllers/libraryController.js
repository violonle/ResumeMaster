const path = require('path')
const fs = require('fs')
const { Resume } = require('../models')
const emailImport = require('../services/emailImportService')
const AIAnalysisService = require('../services/aiAnalysisService')
const ResumeParseService = require('../services/resumeParseService')
const EnhancedResumeParseService = require('../services/enhancedResumeParseService')
const OptimizedResumeParseService = require('../services/optimizedResumeParseService')
const DomesticAIService = require('../services/domesticAIService')
const { extractTextFromFile } = require('../services/textExtractor')
const { createAnalysisJson } = require('../utils/dimensionNormalizer')
const aiController = require('./aiController')
const autoScreeningService = require('../services/autoScreeningService')

const aiAnalysisService = new AIAnalysisService()
const resumeParseService = new ResumeParseService()
const enhancedResumeParseService = new EnhancedResumeParseService()
const optimizedResumeParseService = new OptimizedResumeParseService()
const domesticAIService = new DomesticAIService()

/**
 * 状态映射工具：将各种可能的状态字符串统一映射为中文标准状态
 * 确保返回的键与 getTalentPoolResumes 中的 groups 对象键一致
 */
const toCN = (s) => {
  const k = String(s || '').toLowerCase();
  if (k === 'applied' || k === '待快评' || k === '投递' || k === 'new' || k === '新投递' || k === '') return '投递';
  if (k === 'screening' || k === '快评' || k === '已快评' || k === 'passed') return '快评';
  if (k === 'interview' || k === '面试' || k === '面试中') return '面试';
  if (k === 'offer' || k === '已发offer' || k === '待录用') return 'Offer';
  if (k === 'hired' || k === '入职' || k === '已入职' || k === '已录用') return '入职';
  if (k === 'rejected' || k === '淘汰' || k === '已淘汰' || k === '放弃') return '淘汰';
  return '投递';
};

async function getTalentPoolResumes(req, res) {
  try {
    const { groupByStatus, page = 1, pageSize = 20, status, jobId, q, include_rejected } = req.query || {};
    const { sequelize, Resume, Job, AnalysisResult, User } = require('../models');
    const dialect = sequelize.getDialect();
    let companyUserIds = null;
    if (!req.user.company_id && req.user.company_name) {
      const users = await User.findAll({
        where: { company_name: req.user.company_name },
        attributes: ['id']
      });
      companyUserIds = users.map(u => u.id);
      if (companyUserIds.length === 0) {
        companyUserIds = [req.user.id];
      }
    }
    const isAdmin = req.user.role === 'admin' || req.user.role === 'SUPER_ADMIN';

    // 统一处理 jobId 筛选值
    let jobIdRaw = jobId;
    // 某些浏览器可能发送 [object Object] 或其他奇怪的值，需要防御
    if (typeof jobIdRaw === 'object') {
      jobIdRaw = null;
    }

    let effectiveJobId = (jobIdRaw === 'all' || !jobIdRaw || jobIdRaw === 'undefined' || jobIdRaw === 'null' || String(jobIdRaw).trim() === '') ? null : jobIdRaw;

    // 强制清理 jobId 中可能存在的空格或不可见字符
    if (effectiveJobId) {
      effectiveJobId = String(effectiveJobId).trim();
      if (effectiveJobId !== 'unassigned') {
        // 如果包含非数字字符且不是 UUID 格式，则视为无效
        if (!/^\d+$/.test(effectiveJobId) && effectiveJobId.length < 10) {
          effectiveJobId = null;
        }
      }
    }

    const statusFilter = status || null;
    const normalizeStatusToEn = (raw) => {
      const s = String(raw || '').trim();
      if (!s) return null;
      const cnToEn = { '待快评': 'applied', '新投递': 'applied', '投递': 'applied', '已快评': 'screening', '快评': 'screening', '面试': 'interview', 'Offer': 'offer', '入职': 'hired', '淘汰': 'rejected', '已淘汰': 'rejected' };
      if (cnToEn[s]) return cnToEn[s];
      const allowed = new Set(['applied', 'screening', 'interview', 'offer', 'hired', 'rejected']);
      return allowed.has(s) ? s : null;
    };
    const normalizeStatusToCn = (raw) => {
      const s = String(raw || '').trim();
      if (!s) return null;
      const enToCn = { applied: '投递', screening: '快评', interview: '面试', offer: 'Offer', hired: '入职', rejected: '淘汰' };
      if (enToCn[s]) return enToCn[s];
      const allowed = new Set(['投递', '快评', '面试', 'Offer', '入职', '淘汰', '已淘汰']);
      return allowed.has(s) ? s : null;
    };

    // 如果 effectiveJobId 是数字字符串，转为数字以确保后续比较准确
    if (effectiveJobId && effectiveJobId !== 'unassigned' && !isNaN(effectiveJobId) && effectiveJobId !== '') {
      effectiveJobId = parseInt(effectiveJobId);
    }

    console.log(`[LibraryController] getTalentPoolResumes: dialect=${dialect}, user=${req.user.id}, company=${req.user.company_id}, queryJobId=${jobId} -> effectiveJobId=${effectiveJobId}, status=${statusFilter}, groupByStatus=${groupByStatus}`);

    if (dialect === 'postgres') {
      const { Op } = require('sequelize');
      const filters = [];
      const params = {};
      const offset = Math.max(0, (parseInt(page) - 1) * parseInt(pageSize));
      const limit = Math.max(1, parseInt(pageSize));

      // 核心筛选逻辑：
      // 1. 如果指定了特定 jobId: 仅显示关联该职位的简历
      // 2. 如果是 "全部岗位" (effectiveJobId 为 null):
      //    a. 如果 is_talent_pool=true: 显示所有人才库简历
      //    b. 否则 (招聘看板模式): 显示所有已关联职位的简历

      if (effectiveJobId === 'unassigned') {
        filters.push('rj.job_id IS NULL');
      } else if (effectiveJobId) {
        // 关键：强制转换为整数，并使用更明确的表别名过滤
        filters.push('rj.job_id = :jobId');
        params.jobId = parseInt(effectiveJobId);
      } else {
        if (req.query.is_talent_pool === 'true') {
          // 人才库模式：显示所有
        } else {
          // 招聘看板默认模式：显示所有进入流程的简历（即已关联职位的）
          filters.push('rj.job_id IS NOT NULL');
        }
      }

      // 多租户权限过滤
      if (!isAdmin) {
        if (req.user.company_id) {
          filters.push('(r.company_id = :companyId OR r.user_id = :userId)');
          params.companyId = req.user.company_id;
          params.userId = req.user.id;
        } else if (companyUserIds && companyUserIds.length > 0) {
          filters.push('r.user_id IN (:userIds)');
          params.userIds = companyUserIds;
        } else {
          filters.push('r.user_id = :userId');
          params.userId = req.user.id;
        }
      }

      // 状态过滤增加对 rj.status 的支持，因为 ResumeJob.status 是最准确的职位相关状态
      if (statusFilter) {
        const statusEn = normalizeStatusToEn(statusFilter);
        const statusCn = normalizeStatusToCn(statusFilter);

        if (statusEn === 'rejected' || statusCn === '淘汰' || statusCn === '已淘汰') {
          filters.push("(rj.status = 'rejected' OR r.recruitment_status IN ('淘汰','已淘汰','rejected') OR r.auto_rejected = true)");
        } else if (statusEn) {
          if (effectiveJobId && effectiveJobId !== 'unassigned') {
            filters.push('rj.status = :status_en');
            params.status_en = statusEn;
          } else {
            filters.push('(rj.status = :status_en OR r.recruitment_status = :status_cn)');
            params.status_en = statusEn;
            params.status_cn = statusCn || statusFilter;
          }
        } else if (statusCn) {
          filters.push('r.recruitment_status = :status_cn');
          params.status_cn = statusCn;
        } else {
          filters.push('r.recruitment_status = :status_raw');
          params.status_raw = statusFilter;
        }
      } else {
        // 默认排除已淘汰的简历，除非用户明确选择查看淘汰池
        if (include_rejected !== 'true') {
          filters.push("NOT (rj.status = 'rejected' OR r.recruitment_status IN ('淘汰','已淘汰','rejected') OR r.auto_rejected = true)");
        }
      }

      if (q) {
        filters.push("(LOWER(r.file_name) LIKE :q OR LOWER(r.name) LIKE :q OR LOWER(r.job_title) LIKE :q)");
        params.q = `%${String(q).toLowerCase()}%`;
      }

      const whereSql = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
      const countSql = `SELECT COUNT(DISTINCT r.id) AS cnt FROM resumes r LEFT JOIN resume_jobs rj ON r.id = rj.resume_id ${whereSql}`;

      // 如果指定了 jobId，不需要 DISTINCT ON，因为我们只看该职位的关联
      // 如果是“全部岗位”，使用 DISTINCT ON 确保每个简历只出现一次
      // 关键改进：在全部岗位模式下，ORDER BY 增加对状态权重的排序，确保 DISTINCT ON 选中状态最先进的记录
      const distinctSql = (effectiveJobId && effectiveJobId !== 'unassigned') ? '' : 'DISTINCT ON (r.id)';
      const statusWeightSql = `
        CASE 
          WHEN rj.status = 'hired' THEN 6
          WHEN rj.status = 'offer' THEN 5
          WHEN rj.status = 'interview' THEN 4
          WHEN rj.status = 'screening' THEN 3
          WHEN rj.status = 'applied' THEN 2
          WHEN rj.status = 'rejected' THEN 1
          ELSE 0
        END
      `;

      const dataSql = `
        SELECT ${distinctSql} r.id, r.user_id, r.company_id, r.file_name, r.name, r.email, r.phone, r.job_title as parsed_job_title, 
               r.recruitment_status, rj.status as rj_status, r.experience_years, r.highest_education, 
               r.upload_date, r.score, r.updated_at, r.parsed_data,
               j.id as associated_job_id, j.title as associated_job_title, 
               rj.id as resume_job_id, rj.job_id as rj_job_id,
               EXISTS(
                 SELECT 1 FROM analysis_results ar WHERE ar.resume_id = r.id
                 UNION ALL
                 SELECT 1 FROM deep_analysis_records dar WHERE dar.resume_id = r.id
               ) AS deep_available,
                COALESCE(
                  (SELECT json_build_object('id', ar.id, 'overall_score', ar.overall_score, 'dimensions', ar.dimensions, 'detailed_analysis', ar.detailed_analysis)
                   FROM analysis_results ar
                   WHERE ar.resume_id = r.id
                     AND (ar.dimensions IS NOT NULL OR ar.detailed_analysis IS NOT NULL)
                   ORDER BY ar.analysis_date DESC LIMIT 1),
                  (SELECT json_build_object('id', ar.id, 'overall_score', ar.overall_score, 'dimensions', ar.dimensions, 'detailed_analysis', ar.detailed_analysis)
                   FROM analysis_results ar
                   WHERE ar.resume_id = r.id
                   ORDER BY ar.analysis_date DESC LIMIT 1),
                  (SELECT json_build_object('id', dar.id, 'overall_score', 0, 'dimensions', dar.analysis_data)
                   FROM deep_analysis_records dar
                   WHERE dar.resume_id = r.id
                   ORDER BY dar.created_at DESC LIMIT 1)
                ) as analysis
        FROM resumes r
        LEFT JOIN resume_jobs rj ON r.id = rj.resume_id
        LEFT JOIN jobs j ON rj.job_id = j.id
        ${whereSql}
        ORDER BY r.id, ${effectiveJobId ? '' : statusWeightSql + ' DESC,'} r.upload_date DESC
        LIMIT :limit OFFSET :offset
      `;



      const [countRows] = await sequelize.query(countSql, { replacements: params, type: sequelize.QueryTypes.SELECT });
      const rows = await sequelize.query(dataSql, { replacements: { ...params, limit, offset }, type: sequelize.QueryTypes.SELECT });

      console.log(`[LibraryController] PG query returned ${rows.length} rows, total=${countRows.cnt}`);

      const groups = { '投递': [], '快评': [], '面试': [], 'Offer': [], '入职': [], '淘汰': [] };

      if (groupByStatus === 'true') {
        rows.forEach(r => {
          const cn = toCN(r.rj_status || r.recruitment_status);
          let parsedData = r.parsed_data || {};
          if (typeof parsedData === 'string') {
            try { parsedData = JSON.parse(parsedData); } catch (e) { parsedData = {}; }
          }

          // 增强姓名提取逻辑，适配 basic_info 和 personalInfo
          const basicInfo = parsedData.basic_info || parsedData.personalInfo || parsedData;
          const realName = (parsedData.name && parsedData.name !== '姓名' && parsedData.name !== '未知') ? parsedData.name :
            (basicInfo.name && basicInfo.name !== '姓名' && basicInfo.name !== '未知') ? basicInfo.name : null;

          // 标准化维度数据 - 使用共享工具函数
          let standardizedAnalysis = r.analysis ? createAnalysisJson(r.analysis) : null;

          // 修复：如果 groups[cn] 不存在，默认放入 '投递'
          const targetGroup = groups[cn] ? cn : '投递';

          groups[targetGroup].push({
            id: r.id,
            name: r.name || realName || r.file_name || '未命名',
            file_name: r.file_name,
            email: r.email || parsedData.email || '',
            phone: r.phone || parsedData.phone || '',
            job_title: r.associated_job_title || r.parsed_job_title || parsedData.jobTitle || parsedData.position || '未知职位',
            position: r.associated_job_title || r.parsed_job_title || parsedData.jobTitle || parsedData.position || '未知职位',
            associated_job_title: r.associated_job_title,
            associated_job_id: r.associated_job_id,
            resume_job_id: r.resume_job_id,
            job_id: r.rj_job_id || r.associated_job_id,
            recruitment_status: cn,
            upload_date: r.upload_date,
            score: (standardizedAnalysis && standardizedAnalysis.overall_score > 0) ? standardizedAnalysis.overall_score : (r.score || 0),
            experience: r.experience_years !== null ? String(r.experience_years) : (parsedData.workYears || '0'),
            education: r.highest_education || parsedData.education || '未知学历',
            lastUpdated: r.updated_at ? new Date(r.updated_at).toLocaleDateString() : (r.upload_date ? new Date(r.upload_date).toLocaleDateString() : '未知'),
            parsed_data: parsedData,
            analysis: standardizedAnalysis,
            has_deep_analysis: !!r.deep_available || !!r.analysis
          });
        });
        return res.json({ success: true, data: groups, total: parseInt(countRows.cnt || 0), page: parseInt(page), pageSize: limit });
      } else {
        const data = rows.map(r => {
          let parsedData = r.parsed_data || {};
          if (typeof parsedData === 'string') {
            try { parsedData = JSON.parse(parsedData); } catch (e) { parsedData = {}; }
          }

          // 增强姓名提取逻辑，适配 basic_info 和 personalInfo
          const basicInfo = parsedData.basic_info || parsedData.personalInfo || parsedData;
          const realName = (parsedData.name && parsedData.name !== '姓名' && parsedData.name !== '未知') ? parsedData.name :
            (basicInfo.name && basicInfo.name !== '姓名' && basicInfo.name !== '未知') ? basicInfo.name : null;

          const rawStatus = r.rj_status || r.recruitment_status;
          let currentStatus = toCN(rawStatus);

          let standardizedAnalysis = null;
          if (r.analysis) {
            const dims = r.analysis.dimensions || {};
            const parsedDims = typeof dims === 'string' ? (function () { try { return JSON.parse(dims); } catch (e) { return {}; } })() : dims;
            standardizedAnalysis = {
              id: r.analysis.id,
              overall_score: r.analysis.overall_score || 0,
              dimensions: {
                skills: parsedDims.skills || parsedDims.core_skills || parsedDims.job_fit || 0,
                experience: parsedDims.experience || parsedDims.experience_fit || 0,
                education: parsedDims.education || 0,
                project: parsedDims.project || parsedDims.project_fit || parsedDims.project_experience || 0,
                potential: parsedDims.potential || parsedDims.learning_ability || 0,
                teamwork: parsedDims.teamwork || 0
              }
            };
          }

          const score = (standardizedAnalysis && standardizedAnalysis.overall_score > 0) ? standardizedAnalysis.overall_score : (r.score || 0);

          // 逻辑一致性：如果没有分数且状态是“快评”或“applied”，将其修正为“投递” (前端对应待快评)
          if ((currentStatus === '快评' || currentStatus === '投递') && (!score || score <= 0)) {
            currentStatus = '投递';
          } else if (currentStatus === '投递' && score > 0) {
            // 如果有分数且状态还是“投递”，自动升级为“快评”
            currentStatus = '快评';
          }

          return {
            id: r.id,
            name: r.name || realName || r.file_name || '未命名',
            position: r.associated_job_title || r.parsed_job_title || parsedData.jobTitle || parsedData.position || '未知职位',
            job_title: r.associated_job_title || r.parsed_job_title || parsedData.jobTitle || parsedData.position || '未知职位',
            experience: r.experience_years !== null ? String(r.experience_years) : (parsedData.workYears || '0'),
            education: r.highest_education || parsedData.education || '未知学历',
            score: score,
            lastUpdated: r.updated_at ? new Date(r.updated_at).toLocaleDateString() : (r.upload_date ? new Date(r.upload_date).toLocaleDateString() : '未知'),
            status: currentStatus,
            recruitment_status: currentStatus,
            associated_job_title: r.associated_job_title,
            associated_job_id: r.associated_job_id,
            isAssociated: !!r.associated_job_title,
            is_rejected: (currentStatus === '淘汰' || currentStatus === 'rejected' || currentStatus === '已淘汰'),
            analysis: standardizedAnalysis,
            has_deep_analysis: !!r.deep_available || !!r.analysis
          };
        });
        return res.json({ success: true, data, total: parseInt(countRows.cnt || 0), page: parseInt(page), pageSize: limit });
      }
    }

    // 非 PostgreSQL 路径 (如 SQLite/MySQL)
    const { Op } = require('sequelize');

    // 统一的多租户权限过滤条件
    let accessClause = {};
    if (!isAdmin) {
      if (req.user.company_id) {
        accessClause = {
          [Op.or]: [
            { company_id: req.user.company_id },
            { user_id: req.user.id }
          ]
        };
      } else if (companyUserIds && companyUserIds.length > 0) {
        accessClause = { user_id: { [Op.in]: companyUserIds } };
      } else {
        accessClause = { user_id: req.user.id };
      }
    }

    const conditions = Object.keys(accessClause).length > 0 ? [accessClause] : [];

    // 如果是招聘看板模式（非人才库模式）且选择了“全部岗位”，我们需要过滤掉未关联职位的简历
    const isTalentPool = req.query.is_talent_pool === 'true';

    // 构建 Job Include
    const jobInclude = {
      model: Job,
      through: { attributes: ['id', 'status'] },
      attributes: ['id', 'title'],
      required: false
    };

    if (effectiveJobId === 'unassigned') {
      jobInclude.required = false;
      conditions.push({ '$Jobs.id$': { [Op.is]: null } });
    } else if (effectiveJobId) {
      jobInclude.where = { id: effectiveJobId };
      jobInclude.required = true;
    } else if (!isTalentPool) {
      // 招聘看板“全部岗位”模式：强制关联以过滤掉未进入流程的简历
      jobInclude.required = true;
    }

    // 状态过滤逻辑
    if (statusFilter) {
      const statusEn = normalizeStatusToEn(statusFilter);
      const statusCn = normalizeStatusToCn(statusFilter);

      if (statusEn === 'rejected' || statusCn === '淘汰' || statusCn === '已淘汰') {
        conditions.push({
          [Op.or]: [
            { recruitment_status: { [Op.in]: ['淘汰', '已淘汰', 'rejected'] } },
            { auto_rejected: true },
            { '$Jobs.ResumeJob.status$': 'rejected' }
          ]
        });
      } else if (statusEn) {
        if (effectiveJobId && effectiveJobId !== 'unassigned') {
          conditions.push({ '$Jobs.ResumeJob.status$': statusEn });
        } else {
          conditions.push({
            [Op.or]: [
              { recruitment_status: statusCn || statusFilter },
              { '$Jobs.ResumeJob.status$': statusEn }
            ]
          });
        }
      } else if (statusCn) {
        conditions.push({ recruitment_status: statusCn });
      } else {
        conditions.push({ recruitment_status: statusFilter });
      }
    } else {
      if (include_rejected !== 'true') {
        conditions.push({
          [Op.and]: [
            { recruitment_status: { [Op.notIn]: ['淘汰', '已淘汰', 'rejected'] } },
            {
              [Op.or]: [
                { auto_rejected: { [Op.ne]: true } },
                { auto_rejected: { [Op.is]: null } }
              ]
            },
            {
              [Op.or]: [
                { '$Jobs.ResumeJob.status$': { [Op.ne]: 'rejected' } },
                { '$Jobs.ResumeJob.status$': { [Op.is]: null } }
              ]
            }
          ]
        });
      }
    }

    if (q) {
      conditions.push({
        [Op.or]: [
          { file_name: { [Op.like]: `%${q}%` } },
          { name: { [Op.like]: `%${q}%` } },
          { job_title: { [Op.like]: `%${q}%` } }
        ]
      });
    }

    const rows = await Resume.findAll({
      where: { [Op.and]: conditions },
      order: [['upload_date', 'DESC']],
      attributes: {
        exclude: ['raw_text', 'work_experience', 'education', 'skills', 'projects', 'summary']
      },
      include: [
        {
          model: AnalysisResult,
          as: 'AnalysisResults',
          attributes: ['id', 'overall_score', 'dimensions', 'detailed_analysis', 'analysis_date'],
          required: false,
          separate: true, // 独立查询以支持 limit
          limit: 3, // 获取最近3条，以便后续挑选有维度数据的一条
          order: [['analysis_date', 'DESC']]
        },
        jobInclude
      ],
      subQuery: false // 重要：避免带 include 的分页/过滤查询出现逻辑错误
    });

    console.log(`[LibraryController] Non-PG query returned ${rows.length} rows for jobId=${effectiveJobId}`);

    // --- De-duplication Logic ---
    const uniqueCandidates = new Map();
    rows.forEach(resume => {
      const r = resume.toJSON ? resume.toJSON() : resume;

      // 关键：确定该简历关联的职位 ID
      // 如果使用了 effectiveJobId 过滤，这里必然是那个职位的 ID
      const r_job_id = (resume.Jobs && resume.Jobs.length > 0) ? resume.Jobs[0].id : null;

      // 关键改进：确保唯一键的生成逻辑鲁棒
      // 如果筛选了特定职位，唯一键应该是 简历ID + 职位ID
      // 如果是“全部岗位”，唯一键仅为 简历ID，确保每个简历只出现一次
      const key = effectiveJobId ? `${r.id}-${r_job_id}` : String(r.id);

      if (!uniqueCandidates.has(key)) {
        uniqueCandidates.set(key, resume);
      } else {
        // 如果已经存在（通常发生在“全部岗位”模式下，一个简历关联了多个职位）
        // 我们优先保留状态更先进的或者有分析结果的
        const existing = uniqueCandidates.get(key);
        const existingR = existing.toJSON ? existing.toJSON() : existing;

        const getStatusWeight = (res) => {
          const s = (res.Jobs && res.Jobs.length > 0 && res.Jobs[0].ResumeJob) ? res.Jobs[0].ResumeJob.status : res.recruitment_status;
          const weights = {
            'hired': 6, '入职': 6, '已录用': 6,
            'offer': 5, '已发offer': 5,
            'interview': 4, '面试': 4, '面试中': 4,
            'screening': 3, '快评': 3, '已快评': 3,
            'applied': 2, '待快评': 2, '新投递': 2,
            'rejected': 1, '淘汰': 1, '已淘汰': 1
          };
          return weights[String(s).toLowerCase()] || 0;
        };

        const existingWeight = getStatusWeight(existingR);
        const currentWeight = getStatusWeight(r);

        if (currentWeight > existingWeight) {
          uniqueCandidates.set(key, resume);
        } else if (currentWeight === existingWeight) {
          // 权重相同时，保留有分析结果的
          const hasAnalysis = (r.AnalysisResults && r.AnalysisResults.length > 0);
          const existingHasAnalysis = (existingR.AnalysisResults && existingR.AnalysisResults.length > 0);
          if (!existingHasAnalysis && hasAnalysis) {
            uniqueCandidates.set(key, resume);
          }
        }
      }
    });

    const finalRows = Array.from(uniqueCandidates.values());
    console.log(`[LibraryController] After de-duplication: ${finalRows.length} candidates`);

    if (groupByStatus === 'true') {
      const statusGroups = { '投递': [], '快评': [], '面试': [], 'Offer': [], '入职': [], '淘汰': [] };
      finalRows.forEach(resume => {
        const r = resume.toJSON ? resume.toJSON() : resume;
        const rj_status = (resume.Jobs && resume.Jobs.length > 0 && resume.Jobs[0].ResumeJob) ? resume.Jobs[0].ResumeJob.status : null;
        let cn = toCN(rj_status || r.recruitment_status);

        // 优化：从最近的3条分析记录中挑选最有效的一条
        let analysisJson = null;
        if (r.AnalysisResults && r.AnalysisResults.length > 0) {
          for (const analysis of r.AnalysisResults) {
            const result = createAnalysisJson(analysis);
            // 如果维度总分大于0，说明是有效数据，直接采用
            if (result && Object.values(result.dimensions).reduce((a, b) => a + (Number(b) || 0), 0) > 0) {
              analysisJson = result;
              break;
            }
            // 如果还没有找到有效数据，暂存第一条的结果作为备选
            if (!analysisJson) analysisJson = result;
          }
        }
        const latestAnalysis = analysisJson;
        const score = r.score || (analysisJson ? analysisJson.overall_score : 0);

        // 逻辑一致性：如果没有分数且状态是“快评”或“投递”，将其修正为“投递” (前端对应待快评)
        if ((cn === '快评' || cn === '投递') && (!score || score <= 0)) {
          cn = '投递';
        } else if (cn === '投递' && score > 0) {
          // 如果有分数且状态还是“投递”，自动升级为“快评”
          cn = '快评';
        }

        // 修复：如果 statusGroups[cn] 不存在，默认放入 '投递'
        const targetGroup = statusGroups[cn] ? cn : '投递';

        const parsedData = r.parsed_data || {};
        const associatedJobTitle = (resume.Jobs && resume.Jobs.length > 0) ? resume.Jobs[0].title : null;
        const associatedJobId = (resume.Jobs && resume.Jobs.length > 0) ? resume.Jobs[0].id : null;

        const basicInfo = parsedData.basic_info || parsedData.personalInfo || parsedData;
        const realName = (parsedData.name && parsedData.name !== '姓名' && parsedData.name !== '未知') ? parsedData.name :
          (basicInfo.name && basicInfo.name !== '姓名' && basicInfo.name !== '未知') ? basicInfo.name : null;

        // 使用共享工具函数构建标准化的analysis对象
        // analysisJson 已在上方计算

        statusGroups[targetGroup].push({
          id: r.id,
          name: r.name || realName || r.file_name || '未命名',
          file_name: r.file_name,
          email: r.email || parsedData.email || '',
          phone: r.phone || parsedData.phone || '',
          job_title: associatedJobTitle || r.job_title || parsedData.jobTitle || parsedData.position || '未知职位',
          position: associatedJobTitle || r.job_title || parsedData.jobTitle || parsedData.position || '未知职位',
          associated_job_title: associatedJobTitle,
          associated_job_id: associatedJobId,
          resume_job_id: (resume.Jobs && resume.Jobs.length > 0 && resume.Jobs[0].ResumeJob) ? resume.Jobs[0].ResumeJob.id : null,
          job_id: associatedJobId,
          recruitment_status: cn,
          upload_date: r.upload_date,
          score: r.score || (analysisJson ? analysisJson.overall_score : 0),
          experience: r.experience_years !== null ? String(r.experience_years) : (parsedData.workYears || '0'),
          education: r.highest_education || parsedData.education || '未知学历',
          lastUpdated: r.updated_at ? new Date(r.updated_at).toLocaleDateString() : (r.upload_date ? new Date(r.upload_date).toLocaleDateString() : '未知'),
          parsed_data: parsedData,
          analysis: analysisJson,
          has_deep_analysis: !!latestAnalysis
        });
      });
      return res.json({ success: true, data: statusGroups, total: finalRows.length, page: parseInt(page), pageSize: parseInt(pageSize) });
    } else {
      const data = finalRows.map(resume => {
        const r = resume.toJSON ? resume.toJSON() : resume;
        const parsedData = r.parsed_data || {};
        const associatedJobTitle = (resume.Jobs && resume.Jobs.length > 0) ? resume.Jobs[0].title : null;
        const associatedJobId = (resume.Jobs && resume.Jobs.length > 0) ? resume.Jobs[0].id : null;

        const basicInfo = parsedData.basic_info || parsedData.personalInfo || parsedData;
        const realName = (r.name && r.name !== '姓名' && r.name !== '未知' && r.name !== '未命名') ? r.name :
          (parsedData.name && parsedData.name !== '姓名' && parsedData.name !== '未知' && parsedData.name !== '未命名') ? parsedData.name :
            (basicInfo.name && basicInfo.name !== '姓名' && basicInfo.name !== '未知' && basicInfo.name !== '未命名') ? basicInfo.name : null;

        const rj_status = (resume.Jobs && resume.Jobs.length > 0 && resume.Jobs[0].ResumeJob) ? resume.Jobs[0].ResumeJob.status : null;
        let currentStatus = toCN(rj_status || r.recruitment_status);
        // 优化：从最近的3条分析记录中挑选最有效的一条
        let analysisJson = null;
        if (r.AnalysisResults && r.AnalysisResults.length > 0) {
          for (const analysis of r.AnalysisResults) {
            const result = createAnalysisJson(analysis);
            // 如果维度总分大于0，说明是有效数据，直接采用
            if (result && Object.values(result.dimensions).reduce((a, b) => a + (Number(b) || 0), 0) > 0) {
              analysisJson = result;
              break;
            }
            // 如果还没有找到有效数据，暂存第一条的结果作为备选
            if (!analysisJson) analysisJson = result;
          }
        }
        const latestAnalysis = analysisJson;

        return {
          id: r.id,
          name: realName || r.file_name || '未命名',
          position: associatedJobTitle || r.job_title || parsedData.jobTitle || parsedData.position || '未知职位',
          job_title: associatedJobTitle || r.job_title || parsedData.jobTitle || parsedData.position || '未知职位',
          experience: r.experience_years !== null ? String(r.experience_years) : (parsedData.workYears || '0'),
          education: r.highest_education || parsedData.education || '未知学历',
          score: score,
          lastUpdated: r.updated_at ? new Date(r.updated_at).toLocaleDateString() : (r.upload_date ? new Date(r.upload_date).toLocaleDateString() : '未知'),
          status: currentStatus,
          recruitment_status: currentStatus,
          associated_job_title: associatedJobTitle,
          associated_job_id: associatedJobId,
          resume_job_id: (resume.Jobs && resume.Jobs.length > 0 && resume.Jobs[0].ResumeJob) ? resume.Jobs[0].ResumeJob.id : null,
          job_id: associatedJobId,
          isAssociated: !!associatedJobTitle,
          is_rejected: (currentStatus === '淘汰' || currentStatus === 'rejected' || currentStatus === '已淘汰'),
          analysis: analysisJson,
          has_deep_analysis: !!latestAnalysis
        };
      });
      return res.json({ success: true, data, total: finalRows.length, page: parseInt(page), pageSize: parseInt(pageSize) });
    }
  } catch (e) {
    console.error('[LibraryController] getTalentPoolResumes error:', e);
    res.status(500).json({ success: false, error: { code: 'LIBRARY_LIST_ERROR', message: e.message } });
  }
}

async function uploadToLibrary(req, res) {
  try {
    // Check if this is a save_preview action (step 2 of import)
    if (req.body.save_preview === true || req.body.save_preview === 'true' || req.body.action === 'save_preview') {
      const { file_path, parsed_data, raw_text, jobId } = req.body;
      if (!file_path || !parsed_data) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Missing file path or resume data' } });
      }

      // Validate file exists
      if (!fs.existsSync(file_path)) {
        return res.status(400).json({ success: false, error: { code: 'FILE_NOT_FOUND', message: 'Temporary file not found' } });
      }

      const fileName = path.basename(file_path);
      const stats = await fs.promises.stat(file_path);
      const fileSize = stats.size;
      const ext = (fileName.toLowerCase().split('.').pop() || 'txt');
      const type = ['pdf', 'docx', 'doc', 'txt'].includes(ext) ? ext : 'txt';

      return await createResumeRecord(req, res, {
        file_name: fileName,
        file_size: fileSize,
        file_type: type,
        file_path: file_path,
        parsedData: parsed_data,
        rawText: raw_text || '',
        jobId
      });
    }

    // Standard upload (step 1 or direct upload)
    const { file_name, file_base64 } = req.body || {}
    if (!file_name || !file_base64) return res.status(400).json({ success: false, error: { code: 'INVALID_FILE', message: '缺少文件名或内容' } })
    const baseDir = path.resolve(__dirname, '..', 'uploads', 'resumes')
    if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true })
    const safe = file_name.replace(/[^\w\-\.\u4e00-\u9fa5]/g, '_')
    const p = path.join(baseDir, safe)
    const m = file_base64.split(',')
    const b64 = m.length > 1 ? m[1] : m[0]
    const buf = Buffer.from(b64, 'base64')
    await fs.promises.writeFile(p, buf)
    const ext = (safe.toLowerCase().split('.').pop() || 'txt')
    const type = ['pdf', 'docx', 'doc', 'txt'].includes(ext) ? ext : 'txt'

    let parsedData = {}
    let rawText = ''
    try {
      const content = await extractTextFromFile(p)
      // ... existing logging ...

      rawText = content
      if (!content || content.trim().length === 0) {
        console.warn('文档内容为空，跳过解析')
        parsedData = { rawText: '', parseError: '文档内容为空' }
      } else {
        // 1. 优先使用优化的正则解析服务 (速度快)
        parsedData = await optimizedResumeParseService.parseResumeContent(content, type, safe)

        // 2. 核心优化：如果关键信息缺失（姓名、电话、邮箱任一缺失），则触发 AI 结构化提取
        const isCoreMissing = !parsedData.name || parsedData.name === '姓名' || parsedData.name === '未知' ||
          !parsedData.phone || !parsedData.email;

        if (isCoreMissing) {
          const aiResult = await domesticAIService.extractStructuredData(content, req.user);
          if (aiResult.success && aiResult.data) {
            // 合并 AI 结果到 parsedData，优先保留 AI 提取的关键字段
            parsedData = {
              ...parsedData,
              ...aiResult.data,
              // 特殊处理：如果 AI 提取了更准确的姓名/电话/邮箱，则覆盖
              name: aiResult.data.name || parsedData.name,
              phone: aiResult.data.phone || parsedData.phone,
              email: aiResult.data.email || parsedData.email
            };
          } else {
            console.warn(`[LibraryController] AI structured extraction failed or returned no data for ${safe}`);
          }
        }


      }
    } catch (parseError) {
      console.warn('增强文档解析失败，尝试基础解析:', parseError.message)
      try {
        const content = await extractTextFromFile(p)
        rawText = content
        parsedData = await resumeParseService.parseResumeContent(content, type, safe)
      } catch (fallbackError) {
        console.warn('基础解析也失败，仅保存文件信息:', fallbackError.message)
        parsedData = { rawText: '', parseError: fallbackError.message }
      }
    }

    // Check for preview mode
    const { preview } = req.body;

    // 如果是预览模式，返回解析数据和临时文件信息，不保存到数据库
    if (preview === true || preview === 'true') {
      return res.status(200).json({
        success: true,
        data: {
          parsed_data: parsedData,
          raw_text: rawText,
          file_name: safe,
          file_path: p,
          file_type: type
        },
        message: '解析成功，请确认信息'
      });
    }

    // Create record directly
    return await createResumeRecord(req, res, {
      file_name: safe,
      file_size: buf.length,
      file_type: type,
      file_path: p,
      parsedData,
      rawText,
      jobId: req.body.jobId
    });

  } catch (e) {
    res.status(500).json({ success: false, error: { code: 'LIBRARY_UPLOAD_ERROR', message: e.message } })
  }
}

// Helper function to create resume record
async function createResumeRecord(req, res, { file_name, file_size, file_type, file_path, parsedData, rawText, jobId }) {
  // 将解析后的数据映射到新字段
  const resumeData = {
    user_id: req.user.id,
    company_id: req.user.company_id || null,
    file_name,
    file_size,
    file_type,
    file_path,
    status: 'uploaded',
    source: 'manual_pool',
    is_talent_pool: true,
    parsed_data: parsedData,
    raw_text: rawText
  }

  // 如果关联了职位，设置状态和来源
  if (jobId) {
    resumeData.source = 'recruitment_flow'; // 视为招聘流程来源
    resumeData.recruitment_status = '投递'; // 初始状态为投递
    resumeData.is_talent_pool = true; // 同时也在人才库
  }

  // 从parsedData中提取各个字段
  if (parsedData) {
    const resumeName = (parsedData.name && parsedData.name !== '姓名' && parsedData.name !== '未知') ? parsedData.name : file_name;
    resumeData.name = resumeName
    resumeData.phone = parsedData.phone || null
    resumeData.email = parsedData.email || null
    resumeData.location = parsedData.location || parsedData.city || parsedData.expectCity || null
    resumeData.job_title = parsedData.job_title || null
    resumeData.experience_years = parsedData.experience_years || null
    resumeData.highest_education = parsedData.highest_education || null
    resumeData.job_status = parsedData.job_status || null
    resumeData.expected_salary = parsedData.expected_salary || null
    resumeData.work_experience = parsedData.work_experience || null
    resumeData.education = parsedData.education || null
    resumeData.skills = parsedData.skills || null
    resumeData.summary = parsedData.summary || null
    resumeData.projects = parsedData.projects || null
  }

  // 随机分配头像 (1.svg - 12.svg)
  if (!resumeData.avatar) {
    const avatarIndex = Math.floor(Math.random() * 12) + 1;
    resumeData.avatar = `/avatars/${avatarIndex}.svg`;
  }

  const resume = await Resume.create(resumeData)

  // 如果有 jobId，创建 ResumeJob 关联
  if (jobId) {
    try {
      // 动态引入 ResumeJob 模型，避免循环依赖
      const { ResumeJob } = require('../models');
      if (ResumeJob) {
        await ResumeJob.create({
          resume_id: resume.id,
          job_id: jobId,
          user_id: req.user.id,
          status: 'applied', // 对应 '投递'
          created_at: new Date(),
          updated_at: new Date()
        });
      } else {
        console.warn('ResumeJob model not found, skipping job association');
      }
    } catch (assocError) {
      console.error('Failed to associate resume with job:', assocError);
      // 不阻断主流程，仅记录错误
    }
  }

  // 立即触发自动快评 (Requirement 1)
  // 即使没有关联职位，也可以触发快评（使用该用户的默认上下文）
  autoScreeningService.triggerImmediateScreening(resume.id, jobId || 'unassigned').catch(err => {
    console.error('[LibraryController] 触发即时快评失败:', err);
  });

  return res.status(201).json({ success: true, data: resume, message: '已加入人才库' + (jobId ? '并关联职位' : '') })
}

module.exports = { getTalentPoolResumes, uploadToLibrary }
// 额外导出：邮箱导入到人才库
module.exports.importEmailToLibrary = async (req, res) => {
  try {
    const { host, port, secure, email, username, password, limit, mode, uids, senderFilter, onlyAttachments, onlyUnseen } = req.body || {}
    if (!host || !email || !password) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: '缺少邮箱配置' } })
    }
    const lim = Math.max(1, Math.min(Number(limit || 10), 200))

    // Mode: 'scan' (list only), 'import' (process specific UIDs), or default (import all unseen)
    if (mode === 'scan') {
      const list = await emailImport.scanEmails({
        host,
        port: port || 993,
        secure: secure !== false,
        auth: { user: (username || email), pass: password },
        limit: lim,
        senderFilter,
        onlyAttachments,
        onlyUnseen: onlyUnseen !== false // default true
      });
      return res.json({ success: true, data: list });
    } else if (mode === 'import_selected') {
      if (!Array.isArray(uids) || uids.length === 0) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: '未选择任何邮件' } });
      }
      const resp = await emailImport.importSelectedEmails({
        host,
        port: port || 993,
        secure: secure !== false,
        auth: { user: (username || email), pass: password },
        uids,
        userId: req.user.id
      });
      return res.json({ success: true, data: resp });
    } else {
      // Fallback to old behavior (import all unseen)
      const resp = await emailImport.importFromEmail({
        host,
        port: port || 993,
        secure: secure !== false,
        auth: { user: (username || email), pass: password },
        limit: lim,
        userId: req.user.id,
        markSeen: true
      });
      return res.json({ success: true, data: resp });
    }
  } catch (e) {
    return res.status(500).json({ success: false, error: { code: 'EMAIL_IMPORT_ERROR', message: e.message } })
  }
}
