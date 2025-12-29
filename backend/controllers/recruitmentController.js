const { ResumeJob, Resume, Job, User } = require('../models')
const sms = require('../services/smsService')
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
    const allowed = ['screening','interview','offer','hired','rejected']
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
    await rj.update({ status, recruiter_notes: JSON.stringify(rn) })
    return res.json({ success:true, data:{ id:rj.id, status:rj.status } })
  }catch(e){
    return res.status(500).json({ success:false, error:{ code:'STATUS_UPDATE_ERROR', message:e.message } })
  }
}

exports.scheduleInterview = async (req, res) => {
  try{
    const { id } = req.params
    const { datetime, channel, location, note } = req.body || {}
    if (!datetime){
      return res.status(400).json({ success:false, error:{ code:'INVALID_TIME', message:'缺少面试时间' } })
    }
    const rj = await ResumeJob.findOne({ where:{ id } })
    if (!rj || !(await ensureOwnership(req, rj))){
      return res.status(404).json({ success:false, error:{ code:'NOT_FOUND', message:'候选记录不存在' } })
    }
    const rn = safeJson(rj.recruiter_notes)
    rn.interview = { datetime, channel: channel||'offline', location: location||'', note: note||'' }
    await rj.update({ status:'interview', recruiter_notes: JSON.stringify(rn) })
    return res.json({ success:true, data:{ id:rj.id, interview: rn.interview } })
  }catch(e){
    return res.status(500).json({ success:false, error:{ code:'SCHEDULE_ERROR', message:e.message } })
  }
}

exports.setInterviewResult = async (req, res) => {
  try{
    const { id } = req.params
    const { result, note } = req.body || {}
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
    rn.interview.result_note = note||''
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
    const rj = await ResumeJob.findOne({ where:{ id } })
    if (!rj || !(await ensureOwnership(req, rj))){
      return res.status(404).json({ success:false, error:{ code:'NOT_FOUND', message:'候选记录不存在' } })
    }
    const rn = safeJson(rj.recruiter_notes)
    rn.offer = rn.offer || {}
    rn.offer.sent_at = new Date().toISOString()
    rn.offer.message = message || '恭喜您通过面试，我们向您发出录用意向。'
    // 先尝试短信
    let smsRes = null
    if (phone) {
      smsRes = await sms.sendText(String(phone), rn.offer.message)
    }
    rn.offer.sms = smsRes || { success:false }
    // 邮件发送占位：可后续接入 nodemailer
    rn.offer.email = { to: email||null, success: !!email }
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
       // 需要通过关联查询，或者先查出该公司的所有jobId
       // 这里使用 Sequelize 的 include 过滤更方便，但 ResumeJob 本身没有 company_id
       // 方案：先查询该公司所有 Job ID
       const companyJobs = await Job.findAll({ 
         where: { company_id: req.user.company_id },
         attributes: ['id']
       });
       const jobIds = companyJobs.map(j => j.id);
       where.job_id = jobIds;
    } else {
       where.user_id = req.user.id;
    }

    if (jobId) where.job_id = jobId
    if (status) where.status = status
    const rows = await ResumeJob.findAll({ where, include:[{ model: Resume }, { model: Job }], order:[['updated_at','DESC']] })
    const data = rows.map(r=>({ 
      id: r.id, 
      resume_id: r.resume_id, 
      job_id: r.job_id, 
      status: r.status, 
      file_name: r.Resume && r.Resume.file_name, 
      name: (r.Resume && r.Resume.parsed_data && r.Resume.parsed_data.name) || null, 
      job_title: r.Job && r.Job.title, 
      skills: (r.Resume && r.Resume.parsed_data && r.Resume.parsed_data.skills) || [], 
      education: (r.Resume && r.Resume.parsed_data && r.Resume.parsed_data.education) || [],
      experience: (r.Resume && r.Resume.parsed_data && r.Resume.parsed_data.workExperience) || [],
      score: r.match_score || 0 
    }))
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
