const path = require('path')
const fs = require('fs')
const { Resume } = require('../models')
const emailImport = require('../services/emailImportService')
const AIAnalysisService = require('../services/aiAnalysisService')
const ResumeParseService = require('../services/resumeParseService')
const EnhancedResumeParseService = require('../services/enhancedResumeParseService')
const OptimizedResumeParseService = require('../services/optimizedResumeParseService')
const { extractTextFromFile } = require('../services/textExtractor')
const aiController = require('./aiController')

const aiAnalysisService = new AIAnalysisService()
const resumeParseService = new ResumeParseService()
const enhancedResumeParseService = new EnhancedResumeParseService()
const optimizedResumeParseService = new OptimizedResumeParseService()

async function getTalentPoolResumes(req, res){
  try{
    const { groupByStatus } = req.query || {};
    
    // 构建查询条件，支持公司权限
    const whereClause = req.user.company_id 
      ? { is_talent_pool: true, company_id: req.user.company_id }
      : { is_talent_pool: true, user_id: req.user.id };
    
    // 引入 Job 模型以获取关联职位
    const { Job } = require('../models');
    
    const rows = await Resume.findAll({ 
        where: whereClause, 
        order:[['upload_date','DESC']],
        attributes: { 
            exclude: ['raw_text', 'work_experience', 'education', 'skills', 'projects', 'summary'] 
        },
        include: [{
            model: Job,
            through: { attributes: [] }, // 不返回中间表数据
            attributes: ['id', 'title'],
            required: false // 左连接，即使没有关联职位也返回简历
        }]
    });
    
    if (groupByStatus === 'true') {
      // 返回按招聘状态分组的数据结构，与 /resumes/recruitment/status-grouped 兼容
      const statusGroups = {
        '投递': [],
        '初筛': [],
        '面试': [],
        'Offer': [],
        '入职': []
      };

      rows.forEach(resume => {
        const status = resume.recruitment_status || '投递';
        if (statusGroups[status]) {
          const parsedData = resume.parsed_data || {};
          // 获取关联的第一个职位名称（如果有）
          const associatedJobTitle = (resume.Jobs && resume.Jobs.length > 0) ? resume.Jobs[0].title : null;
          
          statusGroups[status].push({
            id: resume.id,
            name: resume.name || parsedData.name || resume.file_name || '未命名',
            file_name: resume.file_name,
            email: resume.email || parsedData.email || '',
            phone: resume.phone || parsedData.phone || '',
            // 优先显示关联的职位，否则显示解析出的当前职位
            job_title: associatedJobTitle || resume.job_title || parsedData.jobTitle || parsedData.position || '未知职位',
            position: associatedJobTitle || resume.job_title || parsedData.jobTitle || parsedData.position || '未知职位',
            recruitment_status: resume.recruitment_status,
            upload_date: resume.upload_date,
            score: resume.score || 0,
            experience: resume.experience_years !== null ? String(resume.experience_years) : (parsedData.workYears || '0'),
            education: resume.highest_education || parsedData.education || '未知学历',
            lastUpdated: resume.updated_at ? new Date(resume.updated_at).toLocaleDateString() : (resume.upload_date ? new Date(resume.upload_date).toLocaleDateString() : '未知'),
            parsed_data: parsedData
          });
        }
      });
      
      res.json({ success: true, data: statusGroups });
    } else {
      // 返回原始格式，但也带上关联职位信息以便前端处理
      const enrichedRows = rows.map(resume => {
          const r = resume.toJSON();
          const parsedData = r.parsed_data || {};
          const associatedJobTitle = (resume.Jobs && resume.Jobs.length > 0) ? resume.Jobs[0].title : null;
          const associatedJobId = (resume.Jobs && resume.Jobs.length > 0) ? resume.Jobs[0].id : null;
          
          // 统一字段映射，确保前端展示正常
          return {
              ...r,
              id: r.id,
              name: r.name || parsedData.name || r.file_name || '未命名',
              position: associatedJobTitle || r.job_title || parsedData.jobTitle || parsedData.position || '未知职位',
              job_title: associatedJobTitle || r.job_title || parsedData.jobTitle || parsedData.position || '未知职位',
              experience: r.experience_years !== null ? String(r.experience_years) : (parsedData.workYears || '0'),
              education: r.highest_education || parsedData.education || '未知学历',
              score: r.score || 0,
              lastUpdated: r.updated_at ? new Date(r.updated_at).toLocaleDateString() : (r.upload_date ? new Date(r.upload_date).toLocaleDateString() : '未知'),
              status: r.recruitment_status || '投递',
              associated_job_title: associatedJobTitle,
              associated_job_id: associatedJobId,
              isAssociated: !!associatedJobTitle
          };
      });
      res.json({ success: true, data: enrichedRows });
    }
  }catch(e){
    res.status(500).json({ success: false, error: { code: 'LIBRARY_LIST_ERROR', message: e.message } });
  }
}

async function uploadToLibrary(req, res){
  try{
    // Check if this is a save_preview action (step 2 of import)
    if (req.body.save_preview === true || req.body.save_preview === 'true' || req.body.action === 'save_preview') {
        const { file_path, parsed_data, raw_text, jobId } = req.body;
        if (!file_path || !parsed_data) {
            return res.status(400).json({ success:false, error:{ code:'INVALID_INPUT', message:'Missing file path or resume data' } });
        }
        
        // Validate file exists
        if (!fs.existsSync(file_path)) {
             return res.status(400).json({ success:false, error:{ code:'FILE_NOT_FOUND', message:'Temporary file not found' } });
        }

        const fileName = path.basename(file_path);
        const stats = await fs.promises.stat(file_path);
        const fileSize = stats.size;
        const ext = (fileName.toLowerCase().split('.').pop()||'txt');
        const type = ['pdf','docx','doc','txt'].includes(ext)? ext : 'txt';

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
    if (!file_name || !file_base64) return res.status(400).json({ success:false, error:{ code:'INVALID_FILE', message:'缺少文件名或内容' } })
    const baseDir = path.resolve(__dirname, '..', 'uploads', 'resumes')
    if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true })
    const safe = file_name.replace(/[^\w\-\.\u4e00-\u9fa5]/g,'_')
    const p = path.join(baseDir, safe)
    const m = file_base64.split(',')
    const b64 = m.length>1 ? m[1] : m[0]
    const buf = Buffer.from(b64, 'base64')
    await fs.promises.writeFile(p, buf)
    const ext = (safe.toLowerCase().split('.').pop()||'txt')
    const type = ['pdf','docx','doc','txt'].includes(ext)? ext : 'txt'
    
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
        // 优先使用优化的解析服务
        parsedData = await optimizedResumeParseService.parseResumeContent(content, type, safe)
        // ... existing logging ...
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

  }catch(e){
    res.status(500).json({ success:false, error:{ code:'LIBRARY_UPLOAD_ERROR', message: e.message } })
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
      resumeData.name = parsedData.name || null
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

    // 触发后台AI深度解析 (如果rawText存在且parsedData可能不完整)
    // 即使regex解析成功，也运行AI分析以获取更好的结构化数据
    if (rawText && rawText.length > 50) {
        // 使用 processAnalysisBackground 进行异步分析
        // 这里的 req.user 需要确保包含 id
        setTimeout(async () => {
            try {
                console.log(`[LibraryController] Triggering background AI analysis for resume ${resume.id}`);
                
                let jobDescription = '';
                const options = {};
                
                if (jobId) {
                    const { Job } = require('../models');
                    const job = await Job.findByPk(jobId);
                    if (job) {
                        // 优先使用详细描述，如果没有则使用职位名称
                        jobDescription = job.description || job.title || '';
                        options.jobId = jobId;
                    }
                }
                
                await aiController.processAnalysisBackground(resume.id, rawText, jobDescription, req.user, options);
            } catch (err) {
                console.error(`[LibraryController] Background AI analysis failed for resume ${resume.id}:`, err);
            }
        }, 100); // 稍微延迟，确保主事务提交
    }

    return res.status(201).json({ success:true, data: resume, message:'已加入人才库' + (jobId ? '并关联职位' : '') })
}

module.exports = { getTalentPoolResumes, uploadToLibrary }
// 额外导出：邮箱导入到人才库
module.exports.importEmailToLibrary = async (req, res) => {
  try{
    const { host, port, secure, email, username, password, limit, mode, uids, senderFilter, onlyAttachments, onlyUnseen } = req.body || {}
    if (!host || !email || !password){
      return res.status(400).json({ success:false, error:{ code:'INVALID_INPUT', message:'缺少邮箱配置' } })
    }
    const lim = Math.max(1, Math.min(Number(limit||10), 200))
    
    // Mode: 'scan' (list only), 'import' (process specific UIDs), or default (import all unseen)
    if (mode === 'scan') {
        const list = await emailImport.scanEmails({ 
            host, 
            port: port||993, 
            secure: secure!==false, 
            auth: { user: (username||email), pass: password }, 
            limit: lim,
            senderFilter,
            onlyAttachments,
            onlyUnseen: onlyUnseen !== false // default true
        });
        return res.json({ success:true, data: list });
    } else if (mode === 'import_selected') {
        if (!Array.isArray(uids) || uids.length === 0) {
            return res.status(400).json({ success:false, error:{ code:'INVALID_INPUT', message:'未选择任何邮件' } });
        }
        const resp = await emailImport.importSelectedEmails({ 
            host, 
            port: port||993, 
            secure: secure!==false, 
            auth: { user: (username||email), pass: password }, 
            uids, 
            userId: req.user.id 
        });
        return res.json({ success:true, data: resp });
    } else {
        // Fallback to old behavior (import all unseen)
        const resp = await emailImport.importFromEmail({ 
            host, 
            port: port||993, 
            secure: secure!==false, 
            auth:{ user: (username||email), pass: password }, 
            limit: lim, 
            userId: req.user.id, 
            markSeen: true 
        });
        return res.json({ success:true, data: resp });
    }
  }catch(e){
    return res.status(500).json({ success:false, error:{ code:'EMAIL_IMPORT_ERROR', message:e.message } })
  }
}
