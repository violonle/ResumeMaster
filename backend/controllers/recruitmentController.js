const { ResumeJob, Resume, Job, User, Company } = require('../models')
const sms = require('../services/smsService')
const emailService = require('../services/emailService')
const emailImport = require('../services/emailImportService')

function safeJson(obj){
  try{ return typeof obj==='string' ? JSON.parse(obj) : (obj||{}) }catch(_){ return {} }
}

async function ensureOwnership(req, resumeJob){
  if (!resumeJob) return false
  // 多租户隔离：如果是企业用户，检查 company_id；如果是个人用户，检查 user_id
  if (req.user.company_id) {
    // 这里假设 resumeJob 关联的 Job 属于同一公司
    // 需要查询关联的 Job 或 Resume 来确认 company_id
    // 简化处理：查询 resumeJob 关联的 Job
    const job = await Job.findOne({ where: { id: resumeJob.job_id } });
    return job && job.company_id === req.user.company_id;
  }
  return String(resumeJob.user_id) === String(req.user.id)
}

exports.updateStatus = async (req, res) => {
  try{
    const { id } = req.params
    const { status, notes } = req.body || {}
    const allowed = ['applied', 'screening','interview','offer','hired','rejected']
    if (!allowed.includes(String(status||'').toLowerCase())){
      return res.status(400).json({ success:false, error:{ code:'INVALID_STATUS', message:'无效状态' } })
    }
    const rj = await ResumeJob.findOne({ where:{ id } })
    if (!rj || !(await ensureOwnership(req, rj))){
      return res.status(404).json({ success:false, error:{ code:'NOT_FOUND', message:'候选记录不存在' } })
    }
    
    // 权限检查：如果是免费用户，仅允许基础状态流转 (screening, rejected)
    // 但根据需求"免费版也允许进行这项操作"，我们放宽限制，允许所有操作
    // if (req.subscription && req.subscription.plan === 'free' && ['offer', 'hired'].includes(status)) {
    //   return res.status(403).json({ success:false, error:{ code:'PRO_REQUIRED', message:'该状态需要专业版' } })
    // }

    const rn = safeJson(rj.recruiter_notes)
    if (notes) rn.notes = notes
    
    // 如果恢复为非淘汰状态，则清除 Resume 表上的 auto_rejected 标记
    if (status !== 'rejected') {
      try {
        await Resume.update(
          { auto_rejected: false, rejection_reason: null, recruitment_status: '投递' },
          { where: { id: rj.resume_id } }
        );
      } catch (resumeErr) {
        console.error('清除简历自动淘汰标记失败:', resumeErr);
      }
    } else {
      // 如果设置为淘汰状态，同步更新 Resume 表的 recruitment_status
      try {
        await Resume.update(
          { recruitment_status: '淘汰' },
          { where: { id: rj.resume_id } }
        );
      } catch (resumeErr) {
        console.error('同步简历淘汰状态失败:', resumeErr);
      }
    }

    await rj.update({ status, recruiter_notes: JSON.stringify(rn) })
    return res.json({ success:true, data:{ id:rj.id, status:rj.status } })
  }catch(e){
    return res.status(500).json({ success:false, error:{ code:'STATUS_UPDATE_ERROR', message:e.message } })
  }
}

exports.scheduleInterview = async (req, res) => {
  try{
    const { id } = req.params
    const { datetime, channel, location, notes, aiQuestionCount } = req.body || {}
    if (!datetime){
      return res.status(400).json({ success:false, error:{ code:'INVALID_TIME', message:'缺少面试时间' } })
    }
    const rj = await ResumeJob.findOne({ where:{ id }, include: [Resume] })
    if (!rj || !(await ensureOwnership(req, rj))){
      return res.status(404).json({ success:false, error:{ code:'NOT_FOUND', message:'候选记录不存在' } })
    }
    const rn = safeJson(rj.recruiter_notes)
    rn.interview = { 
      datetime, 
      channel: channel||'offline', 
      location: location||'', 
      notes: notes||'',
      aiQuestionCount: aiQuestionCount || 8 // 默认8题
    }
    await rj.update({ status:'interview', recruiter_notes: JSON.stringify(rn) })

    // 发送面试通知（短信 + 邮件）
    try {
      const resume = rj.Resume;
      // 尝试从不同结构中获取电话、姓名和邮箱
      const parsed = resume ? (resume.parsed_data || {}) : {};
      const basicInfo = parsed.basic_info || {};
      const phone = parsed.phone || basicInfo.phone || parsed.mobile || basicInfo.mobile;
      const email = parsed.email || basicInfo.email || resume.email; // 也可以检查 resume 模型上的直接字段
      const name = parsed.name || basicInfo.name || '候选人';

      const timeStr = new Date(datetime).toLocaleString('zh-CN', { hour12: false });
      const typeStr = channel === 'video' ? '视频面试' : (channel === 'phone' ? '线上面试' : '现场面试');
      
      // 生成面试链接
      const smsCfg = await sms.getConfig();
      // 获取门户地址，确保末尾没有斜杠
      const portalUrl = (smsCfg.portalUrl || 'https://master.cloujade.com').replace(/\/$/, '');
      
      // 注意：这里使用 /interview.html 作为独立页面，避开根目录 index.html 的登录拦截
      const interviewLink = `${portalUrl}/interview.html?resumeJobId=${rj.id}`;

      // 准备短信模板变量 (对应阿里云最终模板: ${name}, ${time}, ${jobId})
      const smsParams = {
        name: name,
        time: timeStr,
        jobId: rj.id,
        link: interviewLink // 增加 link 参数，以防模板支持
      };

      // 1. 发送短信
      if (phone) {
        // 如果后台配置了模板，则发送 JSON 格式的变量；如果没有模板，sendText 会降级发送 content
        const fallbackContent = `【争湃简历大师】${name}您好，您的AI线上面试安排在 ${timeStr}。面试链接：${interviewLink} 。请点击后进行线上答题面试。`;
        await sms.sendText(String(phone), JSON.stringify(smsParams), sms.SCENARIOS.INTERVIEW);
      }

      // 2. 发送邮件
      if (email) {
        const subject = `【面试邀请】${typeStr}安排 - 争湃·简历大师`;
        const html = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #2563eb;">面试邀请通知</h2>
            <p>${name} 您好：</p>
            <p>我们已为您安排了 <strong>${typeStr}</strong>，具体安排如下：</p>
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>面试时间：</strong> ${timeStr}</p>
              ${location ? `<p style="margin: 5px 0;"><strong>面试地点/链接：</strong> ${location}</p>` : ''}
              <p style="margin: 5px 0;"><strong>面试题量：</strong> ${aiQuestionCount || 8} 题</p>
            </div>
            <p>请点击下方按钮进入在线面试界面进行答题：</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${interviewLink}" style="background-color: #2563eb; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold;">立即开始面试</a>
            </div>
            <p style="color: #64748b; font-size: 0.9em;">(如无法点击按钮，请复制此链接到浏览器：${interviewLink})</p>
            <p style="margin-top: 30px;">祝您面试顺利！</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #94a3b8; font-size: 0.8em; text-align: center;">此邮件由 争湃·简历大师 系统自动发送，请勿直接回复。</p>
          </div>
        `;
        const built = await emailService.buildScenarioMail('interview', {
          name,
          type: typeStr,
          time: timeStr,
          location: location || '',
          aiQuestionCount: aiQuestionCount || 8,
          link: interviewLink,
        }, { subject, html, text: '' });
        await emailService.sendMail(email, built.subject || subject, built.html || html, built.text || '');
      }
    } catch (notifyError) {
      console.error('发送面试通知失败:', notifyError);
      // 不中断主流程
    }

    return res.json({ success:true, data:{ id:rj.id, interview: rn.interview } })
  }catch(e){
    return res.status(500).json({ success:false, error:{ code:'SCHEDULE_ERROR', message:e.message } })
  }
}

exports.setInterviewResult = async (req, res) => {
  try{
    const { id } = req.params
    const { result, notes } = req.body || {}
    const allowed = ['pass','fail']
    if (!allowed.includes(String(result||'').toLowerCase())){
      return res.status(400).json({ success:false, error:{ code:'INVALID_RESULT', message:'面试结果仅支持 pass/fail' } })
    }
    const rj = await ResumeJob.findOne({ where:{ id } })
    if (!rj || !(await ensureOwnership(req, rj))){
      return res.status(404).json({ success:false, error:{ code:'NOT_FOUND', message:'候选记录不存在' } })
    }
    const rn = safeJson(rj.recruiter_notes)
    rn.interview = rn.interview || {}
    rn.interview.result = result
    rn.interview.result_note = notes||''
    const nextStatus = result==='pass' ? 'offer' : 'rejected'
    await rj.update({ status: nextStatus, recruiter_notes: JSON.stringify(rn) })
    return res.json({ success:true, data:{ id:rj.id, status: nextStatus } })
  }catch(e){
    return res.status(500).json({ success:false, error:{ code:'RESULT_ERROR', message:e.message } })
  }
}

exports.sendOffer = async (req, res) => {
  try{
    const { id } = req.params
    const { phone, email, message } = req.body || {}
    const rj = await ResumeJob.findOne({ where:{ id }, include: [Resume, Job] })
    if (!rj || !(await ensureOwnership(req, rj))){
      return res.status(404).json({ success:false, error:{ code:'NOT_FOUND', message:'候选记录不存在' } })
    }
    const rn = safeJson(rj.recruiter_notes)
    rn.offer = rn.offer || {}
    rn.offer.sent_at = new Date().toISOString()
    rn.offer.message = message || '恭喜您通过面试，我们向您发出录用意向。'
    const offerMessage = rn.offer.message
    const resume = rj.Resume
    const job = rj.Job
    const parsed = resume ? (resume.parsed_data || {}) : {}
    const basicInfo = parsed.basic_info || {}

    const targetPhone = phone || parsed.phone || basicInfo.phone || parsed.mobile || basicInfo.mobile || (resume && resume.phone) || ''
    const targetEmail = email || parsed.email || basicInfo.email || (resume && resume.email) || ''
    const candidateName = parsed.name || basicInfo.name || '候选人'

    let companyName = (req.user && req.user.company_name) ? String(req.user.company_name) : ''
    try {
      const companyId = (req.user && req.user.company_id) ? req.user.company_id : (job && job.company_id ? job.company_id : null)
      if (companyId) {
        const c = await Company.findByPk(companyId)
        if (c && c.name) companyName = c.name
      }
    } catch (_) {}
    if (!companyName) companyName = '我司'

    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() + 4)
    const timeStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`

    let smsRes = null
    if (targetPhone) {
      try {
        smsRes = await sms.sendText(String(targetPhone), { name: candidateName, company: companyName, time: timeStr }, sms.SCENARIOS.OFFER)
      } catch (e) {
        smsRes = { success: false, error: e.message || 'SMS_SEND_ERROR' }
      }
    }
    rn.offer.sms = smsRes || { success:false }

    let emailRes = null
    if (targetEmail) {
      try {
        const subject = `【Offer通知】${companyName} - 争湃·简历大师`
        const html = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #d97706;">Offer 通知</h2>
            <p>${candidateName} 您好：</p>
            <p>我们向您发送 Offer 通知，信息如下：</p>
            <div style="background-color: #fffbeb; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>公司：</strong> ${companyName}</p>
              <p style="margin: 5px 0;"><strong>截止日期：</strong> ${timeStr}</p>
            </div>
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>附加说明：</strong></p>
              <p style="margin: 10px 0; white-space: pre-wrap; color: #334155;">${offerMessage}</p>
            </div>
            <p style="margin-top: 30px;">期待您的回复！</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #94a3b8; font-size: 0.8em; text-align: center;">此邮件由 争湃·简历大师 系统自动发送，请勿直接回复。</p>
          </div>
        `
        const built = await emailService.buildScenarioMail('offer', {
          name: candidateName,
          company: companyName,
          time: timeStr,
          message: offerMessage,
        }, { subject, html, text: '' })
        emailRes = await emailService.sendMail(String(targetEmail), built.subject || subject, built.html || html, built.text || '')
      } catch (e) {
        emailRes = { success: false, error: e.message || 'EMAIL_SEND_ERROR' }
      }
    }
    rn.offer.email = { to: targetEmail || null, success: !!(emailRes && emailRes.success), error: emailRes && emailRes.error ? emailRes.error : null }
    await rj.update({ status:'offer', recruiter_notes: JSON.stringify(rn) })
    return res.json({ success:true, data:{ id:rj.id, status:'offer', offer: rn.offer } })
  }catch(e){
    return res.status(500).json({ success:false, error:{ code:'OFFER_ERROR', message:e.message } })
  }
}

exports.markHired = async (req, res) => {
  try{
    const { id } = req.params
    const rj = await ResumeJob.findOne({ where:{ id } })
    if (!rj || !(await ensureOwnership(req, rj))){
      return res.status(404).json({ success:false, error:{ code:'NOT_FOUND', message:'候选记录不存在' } })
    }
    const rn = safeJson(rj.recruiter_notes)
    rn.onboard = { at: new Date().toISOString() }
    await rj.update({ status:'hired', recruiter_notes: JSON.stringify(rn) })
    return res.json({ success:true, data:{ id:rj.id, status:'hired' } })
  }catch(e){
    return res.status(500).json({ success:false, error:{ code:'HIRE_ERROR', message:e.message } })
  }
}

function computeMatchScore(parsed, job){
  const text = [
    (parsed && parsed.skills ? parsed.skills.join(' ') : ''),
    (parsed && parsed.jobTitle ? parsed.jobTitle : ''),
    (parsed && parsed.experience ? String(parsed.experience) : ''),
    (parsed && parsed.summary ? parsed.summary : '')
  ].join(' ').toLowerCase()
  const reqText = [job.requirements||'', job.description||''].join(' ').toLowerCase()
  let score = 0
  const keys = ['react','vue','java','python','node','ts','sql','k8s','docker']
  for(const k of keys){ if (text.includes(k) && reqText.includes(k)) score += 10 }
  if (text.includes('manager') && reqText.includes('manager')) score += 15
  if (text.includes('engineer') && reqText.includes('engineer')) score += 15
  return Math.min(100, Math.max(10, score))
}

exports.screenCandidates = async (req, res) => {
  try{
    const { jobId, resumeIds } = req.body || {}
    if (!jobId || !Array.isArray(resumeIds) || resumeIds.length===0){
      return res.status(400).json({ success:false, error:{ code:'INVALID_INPUT', message:'缺少职位ID或简历ID列表' } })
    }
    const whereClause = req.user.company_id 
      ? { id: jobId, company_id: req.user.company_id } 
      : { id: jobId, user_id: req.user.id };
    const job = await Job.findOne({ where: whereClause })
    if (!job){
      return res.status(404).json({ success:false, error:{ code:'JOB_NOT_FOUND', message:'职位不存在' } })
    }
    const resumes = await Resume.findAll({ where:{ id: resumeIds } })
    const passed = []
    const rejected = []
    for (const r of resumes){
      const parsed = r.parsed_data || {}
      const score = computeMatchScore(parsed, job)
      const status = score >= 40 ? 'screening' : 'rejected'
      passed.push({ id:r.id, file_name:r.file_name, score, status })
      if (status==='rejected') rejected.push({ id:r.id, file_name:r.file_name, score, status })
    }
    return res.json({ success:true, data:{ passed, rejected } })
  }catch(e){
    return res.status(500).json({ success:false, error:{ code:'SCREEN_ERROR', message:e.message } })
  }
}

exports.importEmailAndScreen = async (req, res) => {
  try{
    const { host, port, secure, email, password, jobId, limit } = req.body || {}
    if (!host || !email || !password || !jobId){
      return res.status(400).json({ success:false, error:{ code:'INVALID_INPUT', message:'缺少邮箱或职位参数' } })
    }
    const whereClause = req.user.company_id 
      ? { id: jobId, company_id: req.user.company_id } 
      : { id: jobId, user_id: req.user.id };
    const job = await Job.findOne({ where: whereClause })
    if (!job){
      return res.status(404).json({ success:false, error:{ code:'JOB_NOT_FOUND', message:'职位不存在' } })
    }
    const imported = await emailImport.importFromEmail({ host, port: port||993, secure: secure!==false, auth:{ user: email, pass: password }, limit: limit||10, userId: req.user.id })
    const resumes = await Resume.findAll({ where:{ id: imported.map(i=>i.id) } })
    const passed=[]; const rejected=[]
    for (const r of resumes){
      const score = computeMatchScore(r.parsed_data||{}, job)
      const status = score>=40? 'screening':'rejected'
      passed.push({ id:r.id, file_name:r.file_name, score, status })
      if (status==='rejected') rejected.push({ id:r.id, file_name:r.file_name, score, status })
    }
    return res.json({ success:true, data:{ importedCount: imported.length, passed, rejected } })
  }catch(e){
    return res.status(500).json({ success:false, error:{ code:'IMPORT_SCREEN_ERROR', message:e.message } })
  }
}

exports.getPipeline = async (req, res) => {
  try{
    const { jobId, status } = req.query || {}
    let where = {};
    
    if (req.user.company_id) {
       // 企业用户：查询所有属于该公司的职位的申请记录
       const companyJobs = await Job.findAll({ 
         where: { company_id: req.user.company_id },
         attributes: ['id']
       });
       const jobIds = companyJobs.map(j => j.id);
       
       if (jobId) {
         // 确保查询的 jobId 属于该公司
         const requestedJobId = parseInt(jobId);
         if (jobIds.includes(requestedJobId)) {
           where.job_id = requestedJobId;
         } else {
           // 如果不属于该公司，返回空数据
           return res.json({ success: true, data: [] });
         }
       } else {
         where.job_id = jobIds;
       }
    } else {
       where.user_id = req.user.id;
       if (jobId) where.job_id = jobId;
    }

    if (status) where.status = status
    const rows = await ResumeJob.findAll({ where, include:[{ model: Resume }, { model: Job }], order:[['updated_at','DESC']] })
    
    // 使用 Map 进行去重，确保同一个职位下同一个简历只出现一次
    const uniqueMap = new Map();
    rows.forEach(r => {
      const key = `${r.resume_id}-${r.job_id}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, { 
          id: r.id, 
          resume_id: r.resume_id, 
          job_id: r.job_id, 
          status: r.status, 
          file_name: r.Resume && r.Resume.file_name, 
          name: (r.Resume && r.Resume.parsed_data && r.Resume.parsed_data.name) || (r.Resume && r.Resume.name) || null, 
          job_title: r.Job && r.Job.title, 
          skills: (r.Resume && r.Resume.parsed_data && r.Resume.parsed_data.skills) || [], 
          education: (r.Resume && r.Resume.parsed_data && r.Resume.parsed_data.education) || [],
          experience: (r.Resume && r.Resume.parsed_data && r.Resume.parsed_data.workExperience) || [],
          score: r.match_score || 0,
          created_at: r.applied_at,
          auto_rejected: r.Resume && r.Resume.auto_rejected,
          rejection_reason: (r.Resume && r.Resume.rejection_reason) || r.notes
        });
      }
    });
    
    const data = Array.from(uniqueMap.values());
    return res.json({ success:true, data })
  }catch(e){ return res.status(500).json({ success:false, error:{ code:'PIPELINE_ERROR', message:e.message } }) }
}

exports.linkResumes = async (req, res) => {
  try{
    const { jobId, resumeIds } = req.body || {}
    if (!jobId || !Array.isArray(resumeIds) || resumeIds.length===0){ return res.status(400).json({ success:false, error:{ code:'INVALID_INPUT', message:'缺少职位或简历ID' } }) }
    const job = await Job.findOne({ where:{ id: jobId, user_id: req.user.id } })
    if (!job) return res.status(404).json({ success:false, error:{ code:'JOB_NOT_FOUND', message:'职位不存在' } })
    const resumes = await Resume.findAll({ where:{ id: resumeIds } })
    const created = []
    for (const r of resumes){
      const [row, ok] = await ResumeJob.findOrCreate({ where:{ resume_id: r.id, job_id: job.id }, defaults:{ resume_id: r.id, job_id: job.id, user_id: req.user.id, status:'applied', match_score: computeMatchScore(r.parsed_data||{}, job) } })
      if (ok) created.push({ id: row.id, resume_id: r.id })
    }
    return res.json({ success:true, data:{ createdCount: created.length, created } })
  }catch(e){ return res.status(500).json({ success:false, error:{ code:'LINK_ERROR', message:e.message } }) }
}

exports.getStats = async (req, res) => {
  try{
    const { jobId } = req.query || {}
    const where = { user_id: req.user.id }
    if (jobId) where.job_id = jobId
    const rows = await ResumeJob.findAll({ where })
    const counts = { applied:0, screening:0, interview:0, offer:0, hired:0, rejected:0 }
    for (const r of rows){ if (counts[r.status]!=null) counts[r.status]++ }
    const total = rows.length || 1
    const conv = { applied_to_screening: Math.round((counts.screening/Math.max(1,counts.applied))*100), screening_to_interview: Math.round((counts.interview/Math.max(1,counts.screening))*100), interview_to_offer: Math.round((counts.offer/Math.max(1,counts.interview))*100), offer_to_hired: Math.round((counts.hired/Math.max(1,counts.offer))*100) }
    return res.json({ success:true, data:{ counts, conv } })
  }catch(e){ return res.status(500).json({ success:false, error:{ code:'STATS_ERROR', message:e.message } }) }
}

exports.getCandidates = async (req, res) => {
  try {
    const { resume_id } = req.query;
    const where = {};
    if (resume_id) where.resume_id = resume_id;
    
    // 多租户隔离
    if (req.user.company_id) {
      const companyJobs = await Job.findAll({ 
        where: { company_id: req.user.company_id },
        attributes: ['id']
      });
      where.job_id = companyJobs.map(j => j.id);
    } else {
      where.user_id = req.user.id;
    }

    const rows = await ResumeJob.findAll({ where });
    return res.json({ success: true, data: rows });
  } catch (e) {
    return res.status(500).json({ success: false, error: { code: 'GET_CANDIDATES_ERROR', message: e.message } });
  }
}
