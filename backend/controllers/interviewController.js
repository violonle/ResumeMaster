const { InterviewSession, Resume, ResumeJob, Job, Company, User, sequelize } = require('../models');
const DomesticAIService = require('../services/domesticAIService');
const aiService = new DomesticAIService();
const logger = require('../utils/logger');
const sms = require('../services/smsService');
const emailService = require('../services/emailService');

/**
 * 面试控制器
 */
class InterviewController {
  /**
   * 从简历对象中重建或提取文本内容
   */
  _extractResumeText(resume) {
    if (!resume) return '';
    
    // 1. 优先使用原始文本
    if (resume.raw_text && resume.raw_text.trim() !== '') {
      return resume.raw_text;
    }

    // 2. 尝试从解析数据中提取预设的文本字段
    const data = resume.parsed_data || {};
    if (data.resume_text && data.resume_text.trim() !== '') return data.resume_text;
    if (data.text && data.text.trim() !== '') return data.text;

    // 3. 如果都没有，则根据结构化字段重建文本
    const textParts = [];
    
    // 基本信息
    const name = resume.name || data.name;
    const title = resume.job_title || data.job_title;
    if (name) textParts.push(`姓名: ${name}`);
    if (title) textParts.push(`意向职位: ${title}`);
    if (resume.experience_years || data.experience_years) {
      textParts.push(`工作经验: ${resume.experience_years || data.experience_years}年`);
    }

    // 核心技能
    const skills = resume.skills || data.skills;
    if (skills) {
      const skillsStr = Array.isArray(skills) ? skills.join(', ') : skills;
      textParts.push(`核心技能: ${skillsStr}`);
    }

    // 工作经历
    const workExp = resume.work_experience || data.work_experience || data.experience;
    if (workExp && Array.isArray(workExp) && workExp.length > 0) {
      textParts.push('\n【工作经历】');
      workExp.forEach(exp => {
        textParts.push(`- ${exp.company || '未知公司'} | ${exp.position || '职位未标注'} | ${exp.duration || ''}`);
        if (exp.description) textParts.push(`  职责描述: ${exp.description}`);
      });
    }

    // 项目经验
    const projects = resume.projects || data.projects;
    if (projects && Array.isArray(projects) && projects.length > 0) {
      textParts.push('\n【项目经验】');
      projects.forEach(p => {
        textParts.push(`- ${p.name || '项目名称'} | ${p.role || ''} | ${p.duration || ''}`);
        if (p.description) textParts.push(`  项目描述: ${p.description}`);
      });
    }

    // 教育背景
    const edu = resume.education || data.education;
    if (edu && Array.isArray(edu) && edu.length > 0) {
      textParts.push('\n【教育背景】');
      edu.forEach(e => {
        textParts.push(`- ${e.school || '院校'} | ${e.degree || ''} | ${e.major || ''} | ${e.duration || ''}`);
      });
    }

    return textParts.join('\n').trim();
  }

  /**
   * 快速安排面试
   */
  async quickSchedule(req, res) {
    const requestId = Math.random().toString(36).substring(7);
    try {
      const { 
        jobId, 
        resumeId, 
        interviewType: reqType, 
        type, 
        interviewDate: reqDate, 
        datetime, 
        address: reqAddress, 
        location, 
        remarks: reqRemarks, 
        notes, 
        aiQuestionCount, 
        phone: providedPhone, 
        email: providedEmail 
      } = req.body;

      const interviewType = type || reqType || 'online';
      const interviewDate = datetime || reqDate;
      const address = location || reqAddress;
      const remarks = notes || reqRemarks;
      const finalAiQuestionCount = parseInt(aiQuestionCount || '8', 10);

      logger.info(`[QuickSchedule][${requestId}] Start: jobId=${jobId}, resumeId=${resumeId}, type=${interviewType}`);
      
      // 1. 验证必填项
      if (!jobId || !resumeId || !interviewDate) {
        logger.error(`[QuickSchedule][${requestId}] Missing required fields:`, { 
            resumeId: !!resumeId, 
            jobId: !!jobId, 
            interviewDate: !!interviewDate 
        });
        return res.status(400).json({ success: false, error: 'MISSING_FIELDS', message: '缺少必要参数 (resumeId, jobId, interviewDate)' });
      }

      // 2. 获取职位和简历信息
      // 构建多租户隔离的查询条件
      const { Op } = require('sequelize');
      const whereClause = {
          id: resumeId,
          [Op.or]: [
              { user_id: req.user.id },
              req.user.company_id ? { company_id: req.user.company_id } : null
          ].filter(Boolean)
      };

      const job = await Job.findByPk(jobId);
      const resume = await Resume.findOne({
          where: whereClause
      });

      if (!job || !resume) {
        logger.warn(`[QuickSchedule][${requestId}] Job or Resume not found or unauthorized: job=${!!job}, resume=${!!resume}`);
        return res.status(404).json({ success: false, error: { message: '职位或简历不存在或无权访问' } });
      }

      // 自动获取联系方式 (如果前端未提供)
      // 优先顺序: 前端提供 > 简历解析字段 > 简历根字段
      let candidatePhone = providedPhone || '';
      let candidateEmail = providedEmail || '';
      
      const parsedData = resume.parsed_data && typeof resume.parsed_data === 'string' 
          ? JSON.parse(resume.parsed_data) 
          : (resume.parsed_data || {});
          
      if (!candidatePhone) {
          candidatePhone = resume.phone || parsedData.phone || parsedData.mobile || (parsedData.basic_info && parsedData.basic_info.phone) || '';
      }
      
      if (!candidateEmail) {
          candidateEmail = resume.email || parsedData.email || (parsedData.basic_info && parsedData.basic_info.email) || '';
      }
      
      logger.info(`[QuickSchedule][${requestId}] Contact info resolved: phone=${candidatePhone}, email=${candidateEmail}`);
      
      // 更新 providedPhone/Email 变量以便后续逻辑使用
      const finalPhone = candidatePhone;
      const finalEmail = candidateEmail;

      // 3. 关联简历和职位 (如果尚未关联)
      let resumeJob = await ResumeJob.findOne({
        where: { resume_id: resumeId, job_id: jobId }
      });

      if (!resumeJob) {
        logger.info(`[QuickSchedule][${requestId}] Creating ResumeJob association`);
        resumeJob = await ResumeJob.create({
          resume_id: resumeId,
          job_id: jobId,
          status: 'interview', // 更新状态为面试
          company_id: req.user.company_id,
          user_id: req.user.id
        });
      } else {
        logger.info(`[QuickSchedule][${requestId}] Updating ResumeJob status to interview`);
        // 更新状态
        await resumeJob.update({ status: 'interview' });
      }

      // 4. 创建面试会话 (如果是线上AI面试)
      let session = null;
      let interviewLink = address; // 默认为输入的地址

      if (interviewType === 'online') {
        logger.info(`[QuickSchedule][${requestId}] Processing online interview AI generation`);
        // 准备生成题目所需的文本
        const resumeText = this._extractResumeText(resume);
        
        // 获取初始公司名称
         let initialCompanyName = '某公司';
         try {
           if (req.user && req.user.company_id) {
             const comp = await Company.findByPk(req.user.company_id);
             if (comp) initialCompanyName = comp.name;
           } else if (req.user && req.user.company_name) {
             initialCompanyName = req.user.company_name;
           }
         } catch (e) {
           logger.warn(`[QuickSchedule][${requestId}] Failed to get initial company name`, e);
         }

        // 预先创建会话状态为 PREPARING，立即返回以提升体验
        session = await InterviewSession.create({
            resume_id: resumeId,
            resume_job_id: resumeJob.id,
            resume_text: resumeText,
            status: 'PREPARING',
            expires_at: new Date(interviewDate), // 截止日期
            total_questions: finalAiQuestionCount,
            current_question_index: 0,
            questions: [], // 初始为空，由后台生成
            company_name: initialCompanyName
        });
        logger.info(`[QuickSchedule][${requestId}] InterviewSession created (PREPARING): ${session.id}`);

        // 异步调用 AI 生成面试题
        this.generateQuestionsBackground(session.id, resumeText, job.description, finalAiQuestionCount)
          .catch(err => logger.error(`[QuickSchedule][${requestId}][Background] AI generation failed`, err));

        // 生成链接
        // 尝试从环境变量获取 PORTAL_URL，否则根据请求头推断，或使用默认
        let portalUrl = process.env.PORTAL_URL;
        if (!portalUrl) {
            // 简单的回退逻辑
            portalUrl = `${req.protocol}://${req.get('host').replace('3000', '5173')}`;
        }
        interviewLink = `${portalUrl}/i/${resumeJob.id}`;
      }

      // 5. 发送通知 (异步发送以提升前端响应速度)
      logger.info(`[QuickSchedule][${requestId}] Notification task starting in background...`);
      
      const sendNotificationsAsync = async () => {
        try {
          // 统一获取 portalUrl 和短信配置
          let finalPortalUrl = 'https://master.cloujade.com';
          let smsCfg = {};
          try {
            smsCfg = await sms.getConfig();
            if (smsCfg.portalUrl) finalPortalUrl = smsCfg.portalUrl.replace(/\/$/, '');
          } catch (e) {
            logger.warn(`[QuickSchedule][${requestId}] Failed to get SMS config, using default`, e);
          }

          // 提取手机号 (复用 recruitmentController 的逻辑)
          let phone = providedPhone || '';
          
          if (phone) {
            const np = sms.normalizePhone(phone);
            if (np.ok) phone = np.phone;
            else phone = '';
          }
          
          if (!phone) {
            let parsed = resume.parsed_data || {};
            if (typeof parsed === 'string') { try { parsed = JSON.parse(parsed); } catch (_) { parsed = {}; } }
            const basicInfo = parsed.basic_info || parsed.personalInfo || parsed || {};
            const candidatePhone = resume.phone || parsed.phone || basicInfo.phone || parsed.mobile || basicInfo.mobile || '';
            const np = sms.normalizePhone(candidatePhone);
            if (np.ok) phone = np.phone;
          }
          
          if (!phone && resume.raw_text) {
            const m = String(resume.raw_text).match(/1[3-9]\d{9}/);
            if (m) phone = m[0];
          }

          const email = providedEmail || resume.email || '';
          const name = resume.name || '候选人';

          const timeDate = new Date(interviewDate);
          const timeStr = `${timeDate.getMonth() + 1}月${timeDate.getDate()}日 ${String(timeDate.getHours()).padStart(2, '0')}:${String(timeDate.getMinutes()).padStart(2, '0')}`;
          const typeStr = interviewType === 'online' ? '线上面试' : (interviewType === 'video' ? '视频面试' : '现场面试');

          // 生成面试链接 (复用 recruitmentController 逻辑)
          // 这里的链接统一指向 /i/:id (短链接)，由 server 处理重定向
          const finalInterviewLink = `${finalPortalUrl}/i/${resumeJob.id}`;

          // 1. 发送短信
          if (phone) {
            let company = (req.user && req.user.company_name) || smsCfg.siteName || '某公司';
            if (req.user && req.user.company_id && !req.user.company_name) {
              const comp = await Company.findByPk(req.user.company_id);
              if (comp) company = comp.name;
            }

            const smsParams = {
              name: name,
              company: company,
              time: timeStr,
              link: finalInterviewLink,
              job: job.title,
              jobTitle: job.title,
              jobId: String(resumeJob.id)
            };
            
            logger.info(`[QuickSchedule][${requestId}][Background] Sending SMS to ${phone} with params: ${JSON.stringify(smsParams)}`);
            const smsResult = await sms.sendText(String(phone), smsParams, sms.SCENARIOS.INTERVIEW);
            logger.info(`[QuickSchedule][${requestId}][Background] SMS Sent Result: ${JSON.stringify(smsResult)}`);
          } else {
            logger.warn(`[QuickSchedule][${requestId}][Background] No valid phone number found for candidate`);
          }

          // 2. 发送邮件
          if (email) {
            try {
              const subject = `【面试邀请】${typeStr}安排 - ${job.title}`;
              const html = `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                  <h2 style="color: #2563eb;">面试邀请通知</h2>
                  <p>${name} 您好：</p>
                  <p>我们已为您安排了 <strong>${typeStr}</strong>，具体安排如下：</p>
                  <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>申请职位：</strong> ${job.title}</p>
                    <p style="margin: 5px 0;"><strong>面试时间：</strong> ${timeStr}</p>
                    ${address ? `<p style="margin: 5px 0;"><strong>面试地点/链接：</strong> ${address}</p>` : ''}
                    ${interviewType === 'online' ? `<p style="margin: 5px 0;"><strong>面试题量：</strong> ${finalAiQuestionCount} 题</p>` : ''}
                  </div>
                  <p>请点击下方按钮进入面试界面：</p>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${finalInterviewLink}" style="background-color: #2563eb; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold;">立即开始面试</a>
                  </div>
                  <p style="color: #64748b; font-size: 0.9em;">(如无法点击按钮，请复制此链接到浏览器：${finalInterviewLink})</p>
                  ${remarks ? `<p style="margin-top: 20px;"><strong>备注说明：</strong><br>${remarks}</p>` : ''}
                  <p style="margin-top: 30px;">祝您面试顺利！</p>
                  <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                  <p style="color: #94a3b8; font-size: 0.8em; text-align: center;">此邮件由系统自动发送，请勿直接回复。</p>
                </div>
              `;
              
              await emailService.sendMail(email, subject, html);
              logger.info(`[QuickSchedule][${requestId}][Background] Email sent to ${email}`);
            } catch (emailErr) {
              logger.error(`[QuickSchedule][${requestId}][Background] Failed to send email`, emailErr);
            }
          }
        } catch (err) {
          logger.error(`[QuickSchedule][${requestId}][Background] Notification process error`, err);
        }
      };

      // 启动异步发送
      sendNotificationsAsync();

      return res.json({
        success: true,
        data: {
          session: session ? {
            id: session.id,
            status: session.status
          } : null,
          resumeJobId: resumeJob.id,
          interviewLink
        }
      });

    } catch (error) {
      logger.error('快速安排面试失败', error);
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  /**
   * 创建面试会话
   */
  async createSession(req, res) {
    try {
      const { resumeText, questionCount, resumeId, resumeJobId, forceCreate = false } = req.body;
      logger.info(`开始创建面试会话: resumeId=${resumeId}, resumeJobId=${resumeJobId}, hasResumeText=${!!resumeText}`);

      let finalResumeText = resumeText;
      let rjId = resumeJobId;
      let finalResumeId = resumeId;
      let finalQuestionCount = questionCount || 8;
      let finalJobDescription = '';

      // 如果提供了 resumeJobId，优先使用它来获取简历和题目数量
      if (rjId) {
        // 构建多租户隔离的查询条件
        const { Op } = require('sequelize');
        const whereClause = { id: rjId };
        
        // 如果用户已登录，增加租户隔离检查
        if (req.user) {
          whereClause[Op.or] = [
            { user_id: req.user.id },
            req.user.company_id ? { company_id: req.user.company_id } : null
          ].filter(Boolean);
        }

        const rj = await ResumeJob.findOne({
          where: whereClause,
          include: [
            { model: Resume },
            { model: Job }
          ]
        });
        if (rj) {
          logger.info(`找到关联的 ResumeJob: ${rj.id}`);
          
          // 获取职位描述
          if (rj.Job) {
            finalJobDescription = rj.Job.description || rj.Job.requirements || '';
            logger.info(`从关联职位获取到描述，长度: ${finalJobDescription.length}`);
          }

          // 尝试从 recruiter_notes 中获取预设的题目数量
          if (rj.recruiter_notes) {
            try {
              const notes = typeof rj.recruiter_notes === 'string' ? JSON.parse(rj.recruiter_notes) : rj.recruiter_notes;
              if (notes.interview && notes.interview.aiQuestionCount) {
                finalQuestionCount = parseInt(notes.interview.aiQuestionCount);
                logger.info(`使用预设的 AI 面试题目数量: ${finalQuestionCount}`);
              }
            } catch (e) {
              logger.warn('解析 recruiter_notes 失败:', e);
            }
          }

          if (rj.Resume) {
            finalResumeId = rj.resume_id;
            finalResumeText = this._extractResumeText(rj.Resume);
            logger.info(`从 ResumeJob 关联的 Resume 获取到文本，长度: ${finalResumeText?.length || 0}`);
          } else {
            logger.warn(`ResumeJob ${rjId} 关联的 Resume 不存在`);
          }
        } else {
          // 容错处理：如果没找到 ResumeJob，可能是因为租户隔离太严格
          // 候选人访问时是不带 user 的，如果此时 rj 存在但因为隔离被过滤掉，会报错
          const rjPlain = await ResumeJob.findByPk(rjId);
          if (rjPlain) {
             logger.warn(`ResumeJob ${rjId} 存在但当前请求无权访问 (隔离校验未通过)`);
             return res.status(403).json({ success: false, error: '无权访问该面试申请记录' });
          }
          logger.warn(`未找到 ResumeJob: ${rjId}`);
          return res.status(404).json({ success: false, error: '面试申请记录不存在' });
        }
      } else if (finalResumeId) {
        // 如果只提供了 resumeId，尝试获取简历文本和关联的申请记录
        // 构建多租户隔离的查询条件
        const { Op } = require('sequelize');
        const whereClause = { id: finalResumeId };
        
        // 如果用户已登录，增加租户隔离检查
        if (req.user) {
          whereClause[Op.or] = [
            { user_id: req.user.id },
            req.user.company_id ? { company_id: req.user.company_id } : null
          ].filter(Boolean);
        }

        const resume = await Resume.findOne({
          where: whereClause
        });
        if (resume) {
          logger.info(`找到 Resume: ${resume.id}`);
          finalResumeText = this._extractResumeText(resume);
          logger.info(`获取到 Resume 文本，长度: ${finalResumeText?.length || 0}`);

          // 尝试从简历数据中获取预设的面试配置
          const pd = resume.parsed_data || {};
          if (pd.interview && pd.interview.aiQuestionCount) {
            finalQuestionCount = parseInt(pd.interview.aiQuestionCount);
            logger.info(`从简历解析数据中获取到面试题目数量: ${finalQuestionCount}`);
          }
          
          const rj = await ResumeJob.findOne({
            where: { resume_id: finalResumeId },
            include: [{ model: Job }],
            order: [['applied_at', 'DESC']]
          });
          if (rj) {
            rjId = rj.id;
            logger.info(`找到该简历关联的最新申请记录: ${rjId}`);
            if (rj.Job) {
              finalJobDescription = rj.Job.description || rj.Job.requirements || '';
              logger.info(`从关联职位获取到描述，长度: ${finalJobDescription.length}`);
            }
          }
        } else {
          logger.warn(`未找到 Resume: ${finalResumeId}`);
        }
      }

      // 检查简历内容
      if (!finalResumeText || finalResumeText.trim() === '') {
        logger.warn(`创建面试失败: 简历内容为空. resumeId=${finalResumeId}, resumeJobId=${rjId}`);
        return res.status(400).json({ success: false, error: '简历内容不能为空，请先在简历库中完善简历文本' });
      }

      // 查找该简历是否已有活跃会话
      if (!forceCreate) {
        const { Op } = require('sequelize');
        const existingSession = await InterviewSession.findOne({
          where: {
            resume_id: finalResumeId,
            status: { [Op.ne]: 'COMPLETED' }
          },
          order: [['created_at', 'DESC']]
        });

        if (existingSession) {
          logger.info(`找到已有活跃会话: ${existingSession.id}`);
          
          // 获取简历和公司详情用于返回
          let candidateName = '';
          let candidatePhone = '';
          let companyName = '';
          try {
            const resume = await Resume.findByPk(existingSession.resume_id, {
              include: [{
                model: Company,
                as: 'Company'
              }]
            });
            if (resume) {
              const data = resume.parsed_data || {};
              candidateName = resume.name || data.name || '';
              candidatePhone = resume.phone || data.phone || '';
              
              if (resume.Company) {
                companyName = resume.Company.name;
              } else if (resume.user_id) {
                const user = await User.findByPk(resume.user_id, {
                  include: [{
                    model: Company,
                    as: 'Company'
                  }]
                });
                if (user && user.Company) {
                  companyName = user.Company.name;
                } else if (user && user.company_name) {
                  companyName = user.company_name;
                } else {
                  companyName = '某公司';
                }
              }
            }
          } catch (e) {
            logger.warn('获取候选人或公司信息失败:', e);
          }

          return res.json({
            success: true,
            data: {
              sessionId: existingSession.id,
              id: existingSession.id,
              resumeText: existingSession.resume_text,
              resumeId: existingSession.resume_id,
              resumeJobId: existingSession.resume_job_id,
              totalQuestions: existingSession.total_questions,
              currentQuestionIndex: existingSession.current_question_index,
              questions: existingSession.questions,
              status: existingSession.status,
              report: existingSession.report,
              createdAt: existingSession.created_at,
              updatedAt: existingSession.updated_at,
              candidateName,
              candidatePhone,
              companyName
            }
          });
        }
      }

      // 预先创建会话状态为 PREPARING，立即返回以提升体验
      // 先确定公司名称
      let initialCompanyName = '某公司';
      try {
        if (req.user && req.user.company_id) {
          const company = await Company.findByPk(req.user.company_id);
          if (company) initialCompanyName = company.name;
        } else if (req.user && req.user.company_name) {
          initialCompanyName = req.user.company_name;
        }
      } catch (e) {
        logger.warn('获取初始公司名称失败:', e);
      }

      const session = await InterviewSession.create({
        resume_job_id: rjId,
        resume_id: finalResumeId,
        resume_text: finalResumeText,
        total_questions: finalQuestionCount,
        current_question_index: 0,
        questions: [], // 此时为空
        status: 'PREPARING',
        company_name: initialCompanyName
      });

      // 异步调用 AI 生成面试题
      // 不要 await，让其在后台运行
      this.generateQuestionsBackground(session.id, finalResumeText, finalJobDescription, finalQuestionCount)
        .catch(err => logger.error(`[Background] 生成面试题失败 (Session: ${session.id})`, err));

      // 成功返回
      const sessionData = session.toJSON();
      
      // 获取简历和公司详情用于返回
      let candidateName = '';
      let candidatePhone = '';
      let companyName = session.company_name || '某公司';
      try {
        const resume = await Resume.findByPk(finalResumeId);
        if (resume) {
          const data = resume.parsed_data || {};
          candidateName = resume.name || data.name || '';
          candidatePhone = resume.phone || data.phone || '';
        }
      } catch (e) {
        logger.warn('获取候选人信息失败:', e);
      }

      return res.json({
        success: true,
        data: {
          sessionId: session.id,
          id: session.id,
          resumeText: session.resume_text,
          resumeId: session.resume_id,
          resumeJobId: session.resume_job_id,
          totalQuestions: session.total_questions,
          currentQuestionIndex: session.current_question_index,
          questions: session.questions,
          status: session.status,
          report: session.report,
          createdAt: session.created_at,
          updatedAt: session.updated_at,
          candidateName,
          candidatePhone,
          companyName
        }
      });

    } catch (error) {
      logger.error('创建面试会话失败:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * 提交面试回答
   */
  async submitAnswer(req, res) {
    try {
      const { sessionId, questionIndex, answer } = req.body;
      const id = req.params.sessionId || sessionId;

      const session = await InterviewSession.findByPk(id);
      if (!session) {
        return res.status(404).json({ success: false, error: `面试会话不存在 (ID: ${id})` });
      }

      if (session.status === 'COMPLETED' || session.status === 'EVALUATED') {
        return res.status(400).json({ success: false, error: '面试已结束' });
      }

      // 更新当前题目答案
      const questions = JSON.parse(JSON.stringify(session.questions));
      
      // 鲁棒性校验：确保索引在有效范围内
      if (questionIndex < 0 || questionIndex >= questions.length) {
        logger.error(`无效的问题索引提交: sessionId=${id}, index=${questionIndex}, total=${questions.length}`);
        return res.status(400).json({ 
          success: false, 
          error: `无效的问题索引: ${questionIndex}。当前面试共有 ${questions.length} 道题。` 
        });
      }

      questions[questionIndex].userAnswer = answer;
      
      const isLastQuestion = questionIndex === questions.length - 1;
      const nextIndex = isLastQuestion ? questionIndex : questionIndex + 1;
      const nextStatus = isLastQuestion ? 'COMPLETED' : 'IN_PROGRESS';

      await session.update({
        questions,
        current_question_index: nextIndex,
        status: nextStatus
      });

      // 如果面试结束，异步生成评估报告
      if (isLastQuestion) {
        this.generateReportBackground(session.id).catch(err => {
          logger.error('异步生成面试报告失败:', err);
        });
      }

      return res.json({
        success: true,
        data: {
          sessionId: session.id,
          id: session.id,
          hasNextQuestion: !isLastQuestion,
          nextQuestion: isLastQuestion ? null : questions[nextIndex],
          currentIndex: nextIndex,
          currentQuestionIndex: nextIndex,
          totalQuestions: session.total_questions,
          status: session.status
        }
      });

    } catch (error) {
      logger.error('提交面试回答失败:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * 获取面试会话详情
   */
  async getSession(req, res) {
    try {
      const { sessionId } = req.params;
      const session = await InterviewSession.findByPk(sessionId);

      if (!session) {
        logger.error(`获取面试会话失败: 未找到 ID 为 ${sessionId} 的会话`);
        return res.status(404).json({ success: false, error: `面试会话不存在 (ID: ${sessionId})` });
      }

      // 获取简历和公司详情用于返回
      let candidateName = '';
      let candidatePhone = '';
      let companyName = session.company_name || '某公司';
      try {
        const resume = await Resume.findByPk(session.resume_id);
        if (resume) {
          const data = resume.parsed_data || {};
          candidateName = resume.name || data.name || '';
          candidatePhone = resume.phone || data.phone || '';
        }
      } catch (e) {
        logger.warn('获取候选人信息失败:', e);
      }

      return res.json({
        success: true,
        data: {
          sessionId: session.id,
          id: session.id,
          resumeText: session.resume_text,
          resumeId: session.resume_id,
          resumeJobId: session.resume_job_id,
          totalQuestions: session.total_questions,
          currentQuestionIndex: session.current_question_index,
          questions: session.questions,
          status: session.status,
          report: session.report,
          createdAt: session.created_at,
          updatedAt: session.updated_at,
          candidateName,
          candidatePhone,
          companyName
        }
      });
    } catch (error) {
      logger.error('获取面试会话失败:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * 获取当前题目
   */
  async getCurrentQuestion(req, res) {
    try {
      const { sessionId } = req.params;
      const session = await InterviewSession.findByPk(sessionId);
      if (!session) {
        return res.status(404).json({ success: false, error: '面试会话不存在' });
      }

      if (session.status === 'COMPLETED' || session.status === 'EVALUATED') {
        return res.json({
          success: true,
          data: { completed: true, message: '面试已结束' }
        });
      }

      const currentQuestion = session.questions[session.current_question_index];
      return res.json({
        success: true,
        data: {
          completed: false,
          sessionId: session.id,
          id: session.id,
          resumeText: session.resume_text,
          resumeId: session.resume_id,
          resumeJobId: session.resume_job_id,
          totalQuestions: session.total_questions,
          currentQuestionIndex: session.current_question_index,
          questions: session.questions,
          status: session.status,
          question: currentQuestion
        }
      });

    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * 获取面试报告
   */
  async getReport(req, res) {
    try {
      const { sessionId } = req.params;
      const session = await InterviewSession.findByPk(sessionId);
      if (!session) {
        return res.status(404).json({ success: false, error: '面试会话不存在' });
      }

      if (session.status !== 'EVALUATED' && session.status !== 'COMPLETED') {
        return res.status(400).json({ success: false, error: '面试尚未完成' });
      }

      // 如果还没有报告，尝试生成
      if (!session.report) {
        await this.generateReportBackground(session.id);
        const updatedSession = await InterviewSession.findByPk(sessionId);
        return res.json({ success: true, data: updatedSession.report });
      }

      return res.json({ success: true, data: session.report });

    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * 查找未完成的面试会话
   */
  async findUnfinishedSession(req, res) {
    try {
      const { resumeId } = req.params;
      const session = await InterviewSession.findOne({
        where: {
          resume_id: resumeId,
          status: ['CREATED', 'IN_PROGRESS']
        },
        order: [['created_at', 'DESC']]
      });

      if (!session) {
        return res.json({ success: true, data: null });
      }

      // 获取简历和公司详情用于返回
      let candidateName = '';
      let candidatePhone = '';
      let companyName = '';
      try {
        const resume = await Resume.findByPk(session.resume_id, {
          include: [{
            model: Company,
            as: 'Company'
          }]
        });
        if (resume) {
          const data = resume.parsed_data || {};
          candidateName = resume.name || data.name || '';
          candidatePhone = resume.phone || data.phone || '';
          
          if (resume.Company) {
            companyName = resume.Company.name;
          } else if (resume.user_id) {
            const user = await User.findByPk(resume.user_id, {
              include: [{
                model: Company,
                as: 'Company'
              }]
            });
            if (user && user.Company) {
              companyName = user.Company.name;
            } else if (user && user.company_name) {
              companyName = user.company_name;
            } else {
              companyName = '有公司';
            }
          }
        }
      } catch (e) {
        logger.warn('获取候选人或公司信息失败:', e);
      }

      return res.json({
        success: true,
        data: {
          sessionId: session.id,
          id: session.id,
          resumeText: session.resume_text,
          resumeId: session.resume_id,
          resumeJobId: session.resume_job_id,
          totalQuestions: session.total_questions,
          currentQuestionIndex: session.current_question_index,
          questions: session.questions,
          status: session.status,
          report: session.report,
          createdAt: session.created_at,
          updatedAt: session.updated_at,
          candidateName,
          candidatePhone,
          companyName
        }
      });
    } catch (error) {
      logger.error('查找未完成面试会话失败:', error);
      res.status(500).json({ success: false, error: '查找未完成面试会话失败' });
    }
  }

  /**
   * 暂存回答（不进入下一题）
   */
  async saveAnswer(req, res) {
    try {
      const id = req.params.sessionId;
      const { questionIndex, answer } = req.body;

      const session = await InterviewSession.findByPk(id);
      if (!session) {
        return res.status(404).json({ success: false, error: `面试会话不存在 (ID: ${id})` });
      }

      const questions = [...session.questions];
      if (questionIndex < 0 || questionIndex >= questions.length) {
        return res.status(400).json({ success: false, error: '无效的题目索引' });
      }

      questions[questionIndex].userAnswer = answer;
      
      await session.update({
        questions,
        status: 'IN_PROGRESS'
      });

      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * 提前交卷
   */
  async completeInterview(req, res) {
    try {
      const id = req.params.sessionId;
      const session = await InterviewSession.findByPk(id);
      if (!session) {
        return res.status(404).json({ success: false, error: `面试会话不存在 (ID: ${id})` });
      }

      await session.update({ status: 'COMPLETED' });
      
      // 异步生成报告
      this.generateReportBackground(session.id).catch(err => {
        logger.error('异步生成面试报告失败:', err);
      });

      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * 后台生成面试题目
   */
  async generateQuestionsBackground(sessionId, resumeText, jobDescription, questionCount) {
    logger.info(`[Background] 开始为 Session ${sessionId} 生成面试题...`);
    try {
      // 1. 调用 AI 服务
      const aiResult = await aiService.analyzeResume(
        resumeText,
        jobDescription,
        null,
        'interview_question_generation',
        questionCount
      );

      if (!aiResult.success) {
        throw new Error(aiResult.error || 'AI 服务调用失败');
      }

      // 鲁棒性：处理 AI 返回的数据结构
      let questionsData = [];
      if (aiResult.data && Array.isArray(aiResult.data.questions)) {
        questionsData = aiResult.data.questions;
      } else if (Array.isArray(aiResult.data)) {
        questionsData = aiResult.data;
      }

      if (questionsData.length === 0) {
        throw new Error('AI 返回题目为空');
      }

      logger.info(`[Background] Session ${sessionId} 成功生成 ${questionsData.length} 道题目`);

      // 2. 格式化题目
      const formattedQuestions = questionsData.map((q, idx) => ({
        questionIndex: q.questionIndex || idx,
        question: q.question || q.content || '未提供题目内容',
        type: q.type || 'OPEN',
        category: q.category || '综合素质',
        userAnswer: null,
        score: null,
        feedback: null
      }));

      // 3. 更新会话状态
      const session = await InterviewSession.findByPk(sessionId);
      if (session) {
        // 重要：强制设置 status 为 CREATED，确保轮询能检测到变化
        await session.update({
          questions: formattedQuestions,
          total_questions: formattedQuestions.length,
          status: 'CREATED'
        });
        // 再次确认数据库已更新
        await session.reload();
        logger.info(`[Background] Session ${sessionId} 状态已确认更新为: ${session.status}`);
      }

    } catch (error) {
      logger.error(`[Background] Session ${sessionId} 生成题目异常:`, error);
      // 可选：更新状态为 FAILED 以便前端感知
      const session = await InterviewSession.findByPk(sessionId);
      if (session) {
          // 这里为了容错，如果 AI 失败，可以使用兜底题目
          const fallbackQuestions = [
             { questionIndex: 0, question: "请做一个简单的自我介绍。", type: "SOFT_SKILLS", category: "综合素质", userAnswer: null },
             { questionIndex: 1, question: "你为什么应聘这个职位？", type: "SOFT_SKILLS", category: "综合素质", userAnswer: null },
             { questionIndex: 2, question: "你认为自己最大的优势是什么？", type: "SOFT_SKILLS", category: "综合素质", userAnswer: null }
          ];
          await session.update({
              questions: fallbackQuestions,
              total_questions: fallbackQuestions.length,
              status: 'CREATED'
          });
          logger.warn(`[Background] Session ${sessionId} 使用兜底题目已恢复`);
      }
    }
  }

  /**
   * 后台生成评估报告
   */
  async generateReportBackground(sessionId) {
    try {
      const session = await InterviewSession.findByPk(sessionId);
      if (!session || session.questions.some(q => q.userAnswer === null)) return;

      const questions = [...session.questions];
      const evaluations = [];
      
      // 逐个评估题目
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const result = await aiService.analyzeResume(
          `题目: ${q.question}\n回答: ${q.userAnswer}`,
          '',
          null,
          'interview_answer_evaluation'
        );

        if (result.success && result.data) {
          questions[i].score = result.data.score;
          questions[i].feedback = result.data.feedback;
          evaluations.push({
            questionIndex: q.questionIndex,
            question: q.question,
            category: q.category,
            userAnswer: q.userAnswer,
            score: result.data.score,
            feedback: result.data.feedback,
            referenceAnswer: result.data.referenceAnswer,
            keyPoints: result.data.keyPoints
          });
        }
      }

      // 计算总分和各类别分数
      const overallScore = Math.round(evaluations.reduce((sum, e) => sum + e.score, 0) / evaluations.length);
      const categoryMap = {};
      evaluations.forEach(e => {
        if (!categoryMap[e.category]) {
          categoryMap[e.category] = { scoreSum: 0, count: 0 };
        }
        categoryMap[e.category].scoreSum += e.score;
        categoryMap[e.category].count += 1;
      });

      const categoryScores = Object.keys(categoryMap).map(cat => ({
        category: cat,
        score: Math.round(categoryMap[cat].scoreSum / categoryMap[cat].count),
        questionCount: categoryMap[cat].count
      }));

      // 生成总体反馈（再调用一次 AI 汇总）
      const summaryResult = await aiService.analyzeResume(
        JSON.stringify(evaluations),
        '请基于以上面试表现生成总结报告',
        null,
        'chat' // 暂时使用 chat 场景
      );

      const report = {
        sessionId: session.id,
        totalQuestions: session.total_questions,
        overallScore,
        categoryScores,
        questionDetails: evaluations,
        overallFeedback: summaryResult.success ? summaryResult.data : '面试评估完成。',
        strengths: [], // 可以从汇总 AI 结果中提取
        improvements: [],
        referenceAnswers: evaluations.map(e => ({
          questionIndex: e.questionIndex,
          question: e.question,
          referenceAnswer: e.referenceAnswer,
          keyPoints: e.keyPoints
        }))
      };

      await session.update({
        questions,
        report,
        status: 'EVALUATED'
      });

      logger.info(`面试报告生成成功: ${sessionId}`);

    } catch (error) {
      logger.error('生成面试报告后台任务失败:', error);
    }
  }
}

module.exports = new InterviewController();
