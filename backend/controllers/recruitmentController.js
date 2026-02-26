const { ResumeJob, Resume, Job, User, Company, AnalysisResult } = require('../models')
const { createAnalysisJson } = require('../utils/dimensionNormalizer')
const sms = require('../services/smsService')
const emailService = require('../services/emailService')
const emailImport = require('../services/emailImportService')
const autoScreeningService = require('../services/autoScreeningService')

function safeJson(obj) {
  try { return typeof obj === 'string' ? JSON.parse(obj) : (obj || {}) } catch (_) { return {} }
}

function normalizeRecruitmentStatus(input) {
  let rawValue = input
  if (rawValue && typeof rawValue === 'object') {
    if (rawValue.status) rawValue = rawValue.status
    else if (rawValue.value) rawValue = rawValue.value
  }
  const raw = String(rawValue || '').trim()
  const lower = raw.toLowerCase()
  const cnToEn = {
    '待快评': 'applied',
    '新投递': 'applied',
    '投递': 'applied',
    '已快评': 'screening',
    '快评': 'screening',
    '面试': 'interview',
    '面试中': 'interview',
    'offer': 'offer',
    '已发offer': 'offer',
    '入职': 'hired',
    '已入职': 'hired',
    '已录用': 'hired',
    '淘汰': 'rejected',
    '放弃': 'rejected'
  }
  if (cnToEn[raw]) return cnToEn[raw]
  if (cnToEn[lower]) return cnToEn[lower]
  if (lower.includes('淘汰') || raw.includes('淘汰') || lower.includes('放弃') || raw.includes('放弃')) return 'rejected'
  if (lower.includes('快评') || raw.includes('快评')) return 'screening'
  if (lower.includes('面试') || raw.includes('面试')) return 'interview'
  if (lower.includes('offer') || raw.includes('offer')) return 'offer'
  if (lower.includes('入职') || raw.includes('入职') || lower.includes('录用') || raw.includes('录用')) return 'hired'
  if (lower.includes('投递') || raw.includes('投递') || lower.includes('applied')) return 'applied'
  return lower
}

async function findResumeJobByCandidateId(req, id) {
  if (!id) return null
  const rjById = await ResumeJob.findOne({ where: { id }, include: [Resume, Job] })
  if (rjById) return rjById
  const rjByResume = await ResumeJob.findOne({
    where: { resume_id: id },
    include: [Resume, Job],
    order: [['updated_at', 'DESC'], ['applied_at', 'DESC']]
  })
  if (!rjByResume) return null
  if (await ensureOwnership(req, rjByResume)) return rjByResume
  return null
}

async function cleanupOrphanResumeJob(req, resumeJob) {
  if (!resumeJob) return false
  let owned = false
  if (req.user.company_id) {
    if (resumeJob.job_id) {
      const job = await Job.findOne({ where: { id: resumeJob.job_id } })
      if (job && String(job.company_id) === String(req.user.company_id)) owned = true
    }
    if (!owned && String(resumeJob.user_id) === String(req.user.id)) owned = true
  } else {
    if (String(resumeJob.user_id) === String(req.user.id)) owned = true
  }
  if (!owned) return false
  await ResumeJob.destroy({ where: { id: resumeJob.id } })
  return true
}

async function resolveResumeForJob(req, resumeJob) {
  if (!resumeJob) return { resume: null }
  let resume = resumeJob.Resume || null
  if (!resume && resumeJob.resume_id) {
    resume = await Resume.findByPk(resumeJob.resume_id)
  }
  if (!resume) {
    await cleanupOrphanResumeJob(req, resumeJob)
    return { resume: null }
  }
  return { resume }
}

async function ensureOwnership(req, resumeJob) {
  if (!resumeJob) return false
  // 多租户隔离：如果是企业用户，检查 company_id；如果是个人用户，检查 user_id
  if (req.user.company_id) {
    // 优先检查 Job 表
    if (resumeJob.job_id) {
      const job = await Job.findOne({ where: { id: resumeJob.job_id } });
      if (job && job.company_id === req.user.company_id) return true;
    }
    // 兜底检查 Resume 表
    if (resumeJob.resume_id) {
      const resume = await Resume.findOne({ where: { id: resumeJob.resume_id } });
      if (resume && resume.company_id === req.user.company_id) return true;
    }
    return false;
  }
  return String(resumeJob.user_id) === String(req.user.id)
}

exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params
    const { status, notes } = req.body || {}
    const normalizedStatus = normalizeRecruitmentStatus(status)
    const allowed = ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected']
    if (!allowed.includes(String(normalizedStatus || '').toLowerCase())) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_STATUS', message: '无效状态' } })
    }
    const rj = await findResumeJobByCandidateId(req, id)
    if (!rj) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '候选记录不存在' } })
    }
    const { resume } = await resolveResumeForJob(req, rj)
    if (!resume || !(await ensureOwnership(req, rj))) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '候选记录不存在' } })
    }

    // 权限检查：如果是免费用户，仅允许基础状态流转 (screening, rejected)
    // 但根据需求"免费版也允许进行这项操作"，我们放宽限制，允许所有操作
    // if (req.subscription && req.subscription.plan === 'free' && ['offer', 'hired'].includes(status)) {
    //   return res.status(403).json({ success:false, error:{ code:'PRO_REQUIRED', message:'该状态需要专业版' } })
    // }

    const rn = safeJson(rj.recruiter_notes)
    if (notes) rn.notes = notes

    // 同步更新 Resume 表的 recruitment_status
    try {
      const resumeStatusMap = {
        'applied': '待快评',
        'screening': '已快评',
        'interview': '面试',
        'offer': 'Offer',
        'hired': '入职',
        'rejected': '淘汰'
      };

      const resumeUpdateData = {
        recruitment_status: resumeStatusMap[normalizedStatus] || normalizedStatus
      };

      // 如果恢复为非淘汰状态，则清除 Resume 表上的 auto_rejected 标记
      if (normalizedStatus !== 'rejected') {
        resumeUpdateData.auto_rejected = false;
        resumeUpdateData.rejection_reason = null;
      }

      await require('../models').Resume.update(
        resumeUpdateData,
        { where: { id: rj.resume_id } }
      );
    } catch (resumeErr) {
      console.error('同步状态到简历失败:', resumeErr);
    }

    const prev = rj.status
    await rj.update({ status: normalizedStatus, recruiter_notes: JSON.stringify(rn) })
    try {
      await require('../models').UserActivity.create({
        user_id: req.user.id,
        company_id: req.user.company_id || null,
        action: 'candidate_status_update',
        resource_type: 'ResumeJob',
        resource_id: rj.id,
        details: { from: prev, to: status }
      })
    } catch (_) { }
    return res.json({ success: true, data: { id: rj.id, status: rj.status } })
  } catch (e) {
    return res.status(500).json({ success: false, error: { code: 'STATUS_UPDATE_ERROR', message: e.message } })
  }
}

exports.scheduleInterview = async (req, res) => {
  try {
    const { id } = req.params
    const { datetime, channel, location, notes, aiQuestionCount, phone: providedPhone, email: providedEmail } = req.body || {}
    if (!datetime) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_TIME', message: '缺少面试时间' } })
    }
    const rj = await findResumeJobByCandidateId(req, id)
    if (!rj) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '候选记录不存在' } })
    }
    const { resume } = await resolveResumeForJob(req, rj)
    if (!resume || !(await ensureOwnership(req, rj))) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '候选记录不存在' } })
    }

    // 自动获取联系方式
    const parsedData = resume.parsed_data && typeof resume.parsed_data === 'string'
      ? JSON.parse(resume.parsed_data)
      : (resume.parsed_data || {});

    let finalPhone = providedPhone || resume.phone || parsedData.phone || parsedData.mobile || (parsedData.basic_info && parsedData.basic_info.phone) || '';
    let finalEmail = providedEmail || resume.email || parsedData.email || (parsedData.basic_info && parsedData.basic_info.email) || '';

    console.log(`[RecruitmentController] Contact info resolved for Resume ${resume.id}: phone=${finalPhone}, email=${finalEmail}`);

    const rn = safeJson(rj.recruiter_notes)
    rn.interview = {
      datetime,
      channel: channel || 'offline',
      location: location || '',
      notes: notes || '',
      aiQuestionCount: aiQuestionCount || 8 // 默认8题
    }
    await rj.update({ status: 'interview', recruiter_notes: JSON.stringify(rn) })

    // 同步更新 Resume 表的 recruitment_status 为 '面试'
    try {
      await require('../models').Resume.update(
        { recruitment_status: '面试' },
        { where: { id: rj.resume_id } }
      );
      console.log(`[RecruitmentController] Updated Resume ${rj.resume_id} recruitment_status to '面试'`);
    } catch (resumeErr) {
      console.error('同步面试状态到简历失败:', resumeErr);
    }

    // 发送面试通知（短信 + 邮件）
    try {
      // 如果是快速安排面试且已经发送过通知，则不再发送
      if (req.body._skipNotification) {
        console.log(`[RecruitmentController] Skipping notification as requested`);
        return res.json({ success: true, data: rj });
      }

      let parsed = resume ? (resume.parsed_data || {}) : {};
      if (typeof parsed === 'string') { try { parsed = JSON.parse(parsed); } catch (_) { parsed = {}; } }
      const basicInfo = parsed.basic_info || parsed.personalInfo || parsed || {};

      // 提取手机号
      let phone = providedPhone || '';

      if (phone) {
        const np = sms.normalizePhone(phone);
        if (np.ok) phone = np.phone;
        else phone = ''; // 如果不合法则清空
      }

      if (!phone) {
        const candidatePhone = resume.phone || parsed.phone || basicInfo.phone || parsed.mobile || basicInfo.mobile || '';
        const np = sms.normalizePhone(candidatePhone);
        if (np.ok) phone = np.phone;
      }

      if (!phone && resume.raw_text) {
        const m = String(resume.raw_text).match(/1[3-9]\d{9}/);
        if (m) phone = m[0];
      }

      const email = finalEmail || resume.email || parsed.email || basicInfo.email || '';
      const name = resume.name || parsed.name || basicInfo.name || '候选人';

      const timeDate = new Date(datetime);
      const timeStr = `${timeDate.getMonth() + 1}月${timeDate.getDate()}日 ${String(timeDate.getHours()).padStart(2, '0')}:${String(timeDate.getMinutes()).padStart(2, '0')}`;
      const typeStr = channel === 'video' ? '视频面试' : (channel === 'phone' ? '线上面试' : '现场面试');

      // 生成面试链接
      const smsCfg = await sms.getConfig();
      const portalUrl = (smsCfg.portalUrl || 'https://master.cloujade.com').replace(/\/$/, '');
      const interviewLink = `${portalUrl}/i/${rj.id}`;

      // 1. 发送短信
      if (phone) {
        const company = (req.user && req.user.company_name) || smsCfg.siteName || '某公司';
        const smsParams = {
          name: name,
          company: company,
          time: timeStr,
          link: interviewLink,
          jobId: String(rj.id)
        };
        const smsResult = await sms.sendText(String(phone), smsParams, sms.SCENARIOS.INTERVIEW);
        rn.interview = rn.interview || {};
        rn.interview.sms = smsResult;
        await rj.update({ recruiter_notes: JSON.stringify(rn) });
      } else {
        console.warn(`[RecruitmentController] No valid 11-digit phone number found for candidate ${id}. Found: ${phone}`);
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

    return res.json({ success: true, data: { id: rj.id, interview: rn.interview } })
  } catch (e) {
    return res.status(500).json({ success: false, error: { code: 'SCHEDULE_ERROR', message: e.message } })
  }
}

exports.setInterviewResult = async (req, res) => {
  try {
    const { id } = req.params
    const { result, notes } = req.body || {}
    const allowed = ['pass', 'fail']
    if (!allowed.includes(String(result || '').toLowerCase())) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_RESULT', message: '面试结果仅支持 pass/fail' } })
    }
    const rj = await findResumeJobByCandidateId(req, id)
    if (!rj) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '候选记录不存在' } })
    }
    const { resume } = await resolveResumeForJob(req, rj)
    if (!resume || !(await ensureOwnership(req, rj))) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '候选记录不存在' } })
    }
    const rn = safeJson(rj.recruiter_notes)
    rn.interview = rn.interview || {}
    rn.interview.result = result
    rn.interview.result_note = notes || ''
    const nextStatus = result === 'pass' ? 'offer' : 'rejected'
    await rj.update({ status: nextStatus, recruiter_notes: JSON.stringify(rn) })

    // 同步更新 Resume 表的 recruitment_status
    try {
      const resumeStatusMap = {
        'offer': 'Offer',
        'rejected': '淘汰'
      };
      await require('../models').Resume.update(
        { recruitment_status: resumeStatusMap[nextStatus] || nextStatus },
        { where: { id: rj.resume_id } }
      );
    } catch (resumeErr) {
      console.error('同步面试结果状态到简历失败:', resumeErr);
    }

    return res.json({ success: true, data: { id: rj.id, status: nextStatus } })
  } catch (e) {
    return res.status(500).json({ success: false, error: { code: 'RESULT_ERROR', message: e.message } })
  }
}

exports.sendOffer = async (req, res) => {
  try {
    const { id } = req.params
    const { phone, email, message } = req.body || {}
    const rj = await findResumeJobByCandidateId(req, id)
    if (!rj) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '候选记录不存在' } })
    }
    const { resume } = await resolveResumeForJob(req, rj)
    if (!resume || !(await ensureOwnership(req, rj))) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '候选记录不存在' } })
    }
    const rn = safeJson(rj.recruiter_notes)
    rn.offer = rn.offer || {}
    rn.offer.sent_at = new Date().toISOString()
    rn.offer.message = message || '恭喜您通过面试，我们向您发出录用意向。'
    const offerMessage = rn.offer.message
    const job = rj.Job
    let parsed = resume ? (resume.parsed_data || {}) : {}
    if (typeof parsed === 'string') { try { parsed = JSON.parse(parsed); } catch (_) { parsed = {} } }
    const basicInfo = parsed.basic_info || parsed.personalInfo || parsed || {}

    let targetPhone = phone || resume.phone || parsed.phone || basicInfo.phone || parsed.mobile || basicInfo.mobile || ''
    if (targetPhone) {
      const np = sms.normalizePhone(targetPhone);
      if (np.ok) targetPhone = np.phone;
      else targetPhone = '';
    }
    const targetEmail = email || parsed.email || basicInfo.email || (resume && resume.email) || ''
    const candidateName = resume.name || parsed.name || basicInfo.name || '候选人'

    let companyName = (req.user && req.user.company_name) ? String(req.user.company_name) : ''
    try {
      const companyId = (req.user && req.user.company_id) ? req.user.company_id : (job && job.company_id ? job.company_id : null)
      if (companyId) {
        const c = await Company.findByPk(companyId)
        if (c && c.name) companyName = c.name
      }
    } catch (_) { }
    if (!companyName) companyName = '我司'

    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() + 4)
    const timeStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`

    let smsRes = null
    if (targetPhone) {
      try {
        const smsParams = {
          name: candidateName,
          company: companyName,
          time: timeStr,
          job: rj.Job?.title || '应聘职位'
        };
        smsRes = await sms.sendText(targetPhone, smsParams, sms.SCENARIOS.OFFER)
      } catch (e) {
        smsRes = { success: false, attempted: true, sent: false, skipped: false, error: 'SMS_SEND_ERROR', message: e.message || 'SMS_SEND_ERROR' }
      }
    } else {
      smsRes = { success: false, attempted: false, sent: false, skipped: true, error: 'NO_PHONE', message: '未找到电话号码' }
    }
    rn.offer.sms = smsRes

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
    await rj.update({ status: 'offer', recruiter_notes: JSON.stringify(rn) })
    return res.json({ success: true, data: { id: rj.id, status: 'offer', offer: rn.offer } })
  } catch (e) {
    return res.status(500).json({ success: false, error: { code: 'OFFER_ERROR', message: e.message } })
  }
}

exports.markHired = async (req, res) => {
  try {
    const { id } = req.params
    const rj = await findResumeJobByCandidateId(req, id)
    if (!rj) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '候选记录不存在' } })
    }
    const { resume } = await resolveResumeForJob(req, rj)
    if (!resume || !(await ensureOwnership(req, rj))) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '候选记录不存在' } })
    }
    const rn = safeJson(rj.recruiter_notes)
    rn.onboard = { at: new Date().toISOString() }
    await rj.update({ status: 'hired', recruiter_notes: JSON.stringify(rn) })

    // 同步更新 Resume 表的 recruitment_status 为 '入职'
    try {
      await require('../models').Resume.update(
        { recruitment_status: '入职' },
        { where: { id: rj.resume_id } }
      );
    } catch (resumeErr) {
      console.error('同步入职状态到简历失败:', resumeErr);
    }

    return res.json({ success: true, data: { id: rj.id, status: 'hired' } })
  } catch (e) {
    return res.status(500).json({ success: false, error: { code: 'HIRE_ERROR', message: e.message } })
  }
}

function computeMatchScore(parsed, job) {
  const text = [
    (parsed && parsed.skills ? parsed.skills.join(' ') : ''),
    (parsed && parsed.jobTitle ? parsed.jobTitle : ''),
    (parsed && parsed.experience ? String(parsed.experience) : ''),
    (parsed && parsed.summary ? parsed.summary : '')
  ].join(' ').toLowerCase()
  const reqText = [job.requirements || '', job.description || ''].join(' ').toLowerCase()
  let score = 0
  const keys = ['react', 'vue', 'java', 'python', 'node', 'ts', 'sql', 'k8s', 'docker']
  for (const k of keys) { if (text.includes(k) && reqText.includes(k)) score += 10 }
  if (text.includes('manager') && reqText.includes('manager')) score += 15
  if (text.includes('engineer') && reqText.includes('engineer')) score += 15
  return Math.min(100, Math.max(10, score))
}

exports.screenCandidates = async (req, res) => {
  try {
    const { jobId, resumeIds } = req.body || {}
    if (!jobId || !Array.isArray(resumeIds) || resumeIds.length === 0) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: '缺少职位ID或简历ID列表' } })
    }
    const whereClause = req.user.company_id
      ? { id: jobId, company_id: req.user.company_id }
      : { id: jobId, user_id: req.user.id };
    const job = await Job.findOne({ where: whereClause })
    if (!job) {
      return res.status(404).json({ success: false, error: { code: 'JOB_NOT_FOUND', message: '职位不存在' } })
    }
    const resumes = await Resume.findAll({ where: { id: resumeIds } })
    const passed = []
    const rejected = []
    for (const r of resumes) {
      const parsed = r.parsed_data || {}
      const score = computeMatchScore(parsed, job)
      const status = score >= 40 ? 'screening' : 'rejected'
      passed.push({ id: r.id, file_name: r.file_name, score, status })
      if (status === 'rejected') rejected.push({ id: r.id, file_name: r.file_name, score, status })
    }
    return res.json({ success: true, data: { passed, rejected } })
  } catch (e) {
    return res.status(500).json({ success: false, error: { code: 'SCREEN_ERROR', message: e.message } })
  }
}

exports.importEmailAndScreen = async (req, res) => {
  try {
    const { host, port, secure, email, password, jobId, limit } = req.body || {}
    if (!host || !email || !password || !jobId) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: '缺少邮箱或职位参数' } })
    }
    const whereClause = req.user.company_id
      ? { id: jobId, company_id: req.user.company_id }
      : { id: jobId, user_id: req.user.id };
    const job = await Job.findOne({ where: whereClause })
    if (!job) {
      return res.status(404).json({ success: false, error: { code: 'JOB_NOT_FOUND', message: '职位不存在' } })
    }
    const imported = await emailImport.importFromEmail({ host, port: port || 993, secure: secure !== false, auth: { user: email, pass: password }, limit: limit || 10, userId: req.user.id })
    const resumes = await Resume.findAll({ where: { id: imported.map(i => i.id) } })
    const passed = []; const rejected = []
    for (const r of resumes) {
      const score = computeMatchScore(r.parsed_data || {}, job)
      const status = score >= 40 ? 'screening' : 'rejected'
      passed.push({ id: r.id, file_name: r.file_name, score, status })
      if (status === 'rejected') rejected.push({ id: r.id, file_name: r.file_name, score, status })
    }
    return res.json({ success: true, data: { importedCount: imported.length, passed, rejected } })
  } catch (e) {
    return res.status(500).json({ success: false, error: { code: 'IMPORT_SCREEN_ERROR', message: e.message } })
  }
}

function normalizeStatus(s) {
  const k = String(s || '').trim().toLowerCase()
  if (k === '投递' || k === '待快评' || k === '待初筛' || k === 'new' || k === '') return 'applied'
  if (k === '快评' || k === '已快评' || k === '初筛' || k === '已初筛' || k === '通过初筛' || k === 'passed' || k === 'screening') return 'screening'
  if (k === '面试' || k === 'interview') return 'interview'
  if (k === '已发offer' || k === 'offer') return 'offer'
  if (k === '入职' || k === '已入职' || k === '已录用' || k === 'hired') return 'hired'
  if (k === '淘汰' || k === '已淘汰' || k === 'rejected') return 'rejected'
  return k || 'applied'
}

exports.getPipeline = async (req, res) => {
  try {
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

    if (status) where.status = normalizeStatus(status)
    const rows = await ResumeJob.findAll({
      where, include: [
        {
          model: Resume, include: [
            { model: AnalysisResult, as: 'AnalysisResults', limit: 5, order: [['analysis_date', 'DESC']] }
          ]
        },
        { model: Job }
      ], order: [['updated_at', 'DESC']]
    })

    // 使用 Map 进行去重，确保同一个职位下同一个简历只出现一次
    const uniqueMap = new Map();
    rows.forEach(r => {
      const key = `${r.resume_id}-${r.job_id}`;
      if (!uniqueMap.has(key)) {
        // 优先选择有dimensions数据的分析记录
        let analysisJson = null;
        if (r.Resume && Array.isArray(r.Resume.AnalysisResults) && r.Resume.AnalysisResults.length > 0) {
          for (const analysis of r.Resume.AnalysisResults) {
            const result = createAnalysisJson(analysis);
            if (result && Object.values(result.dimensions).reduce((a, b) => a + (Number(b) || 0), 0) > 0) {
              analysisJson = result;
              break;
            }
            if (!analysisJson) analysisJson = result;
          }
        }

        const unifiedScore = (r.match_score != null && r.match_score > 0) ? r.match_score : (analysisJson && analysisJson.overall_score ? analysisJson.overall_score : 0);
        // analysisJson 已在上方计算

        uniqueMap.set(key, {
          id: r.id,
          resume_id: r.resume_id,
          job_id: r.job_id,
          status: normalizeStatus(r.status),
          file_name: r.Resume ? r.Resume.file_name : null,
          name: (r.Resume && r.Resume.parsed_data && r.Resume.parsed_data.name) || (r.Resume && r.Resume.name) || null,
          job_title: r.Job ? r.Job.title : null,
          skills: (r.Resume && r.Resume.parsed_data && r.Resume.parsed_data.skills) || [],
          education: (r.Resume && r.Resume.parsed_data && r.Resume.parsed_data.education) || [],
          experience: (r.Resume && r.Resume.parsed_data && r.Resume.parsed_data.workExperience) || [],
          score: unifiedScore,
          analysis: analysisJson,
          deep_analysis_status: r.deep_analysis_status,
          deep_analysis_trigger: r.deep_analysis_trigger,
          deep_analysis_error: r.deep_analysis_error,
          created_at: r.applied_at,
          has_deep_analysis: !!latestAnalysis,
          auto_rejected: !!(r.Resume && r.Resume.auto_rejected),
          rejection_reason: (r.Resume && r.Resume.rejection_reason) || r.notes
        })
      }
    });

    const data = Array.from(uniqueMap.values());
    return res.json({ success: true, data })
  } catch (e) { return res.status(500).json({ success: false, error: { code: 'PIPELINE_ERROR', message: e.message } }) }
}

exports.getPipelineView = async (req, res) => {
  return exports.getPipeline(req, res);
}

exports.linkResumes = async (req, res) => {
  try {
    const { jobId, resumeIds } = req.body || {}
    if (!jobId || !Array.isArray(resumeIds) || resumeIds.length === 0) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: '缺少参数' } })
    }

    const whereClause = req.user.company_id
      ? { id: jobId, company_id: req.user.company_id }
      : { id: jobId, user_id: req.user.id };
    const job = await Job.findOne({ where: whereClause })
    if (!job) {
      return res.status(404).json({ success: false, error: { code: 'JOB_NOT_FOUND', message: '职位不存在' } })
    }

    const results = []
    for (const rid of resumeIds) {
      const [rj, created] = await ResumeJob.findOrCreate({
        where: { job_id: jobId, resume_id: rid },
        defaults: {
          user_id: req.user.id,
          company_id: req.user.company_id || null,
          status: 'applied'
        }
      })

      // 立即触发自动快评 (Requirement 1)
      if (created && jobId) {
        autoScreeningService.triggerImmediateScreening(rid, jobId).catch(err => {
          console.error('[RecruitmentController] 批量关联时触发即时快评失败:', err);
        });
      }

      results.push({ id: rid, resume_job_id: rj.id, created })
    }

    return res.json({ success: true, data: results })
  } catch (e) {
    return res.status(500).json({ success: false, error: { code: 'LINK_ERROR', message: e.message } })
  }
}

exports.applyToJob = async (req, res) => {
  try {
    const { id } = req.params; // resumeId
    const { jobId } = req.body;

    if (!jobId) {
      return res.status(400).json({ success: false, error: { message: '缺少 jobId' } });
    }

    // 检查职位所有权
    const jobWhere = req.user.company_id
      ? { id: jobId, company_id: req.user.company_id }
      : { id: jobId, user_id: req.user.id };
    const job = await Job.findOne({ where: jobWhere });
    if (!job) {
      return res.status(404).json({ success: false, error: { message: '职位不存在' } });
    }

    // 检查简历所有权
    const resumeWhere = req.user.company_id
      ? { id: id, company_id: req.user.company_id }
      : { id: id, user_id: req.user.id };
    const resume = await Resume.findOne({ where: resumeWhere });
    if (!resume) {
      return res.status(404).json({ success: false, error: { message: '简历不存在' } });
    }

    // 创建或更新关联
    const [rj, created] = await ResumeJob.findOrCreate({
      where: { job_id: jobId, resume_id: id },
      defaults: {
        user_id: req.user.id,
        company_id: req.user.company_id || null,
        status: 'applied'
      }
    });

    // 立即触发自动快评 (Requirement 1)
    if (created && jobId) {
      autoScreeningService.triggerImmediateScreening(id, jobId).catch(err => {
        console.error('[RecruitmentController] 触发即时快评失败:', err);
      });
    }

    return res.json({ success: true, data: { resume_job_id: rj.id, created } });
  } catch (e) {
    console.error('applyToJob error:', e);
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
};

exports.getStats = async (req, res) => {
  try {
    const { jobId } = req.query || {}
    const where = { user_id: req.user.id }
    if (jobId) where.job_id = jobId
    const rows = await ResumeJob.findAll({ where })
    const counts = { applied: 0, screening: 0, interview: 0, offer: 0, hired: 0, rejected: 0 }
    for (const r of rows) { if (counts[r.status] != null) counts[r.status]++ }
    const total = rows.length || 1
    const conv = { applied_to_screening: Math.round((counts.screening / Math.max(1, counts.applied)) * 100), screening_to_interview: Math.round((counts.interview / Math.max(1, counts.screening)) * 100), interview_to_offer: Math.round((counts.offer / Math.max(1, counts.interview)) * 100), offer_to_hired: Math.round((counts.hired / Math.max(1, counts.offer)) * 100) }
    return res.json({ success: true, data: { counts, conv } })
  } catch (e) { return res.status(500).json({ success: false, error: { code: 'STATS_ERROR', message: e.message } }) }
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
