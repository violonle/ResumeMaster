const express = require('express');
const { 
    getAllResumes, 
    getResumeById, 
    createResume, 
    updateResume, 
    deleteResume, 
    batchDeleteResumes,
    updateResumeStatus 
} = require('../controllers/resumeController');
const { authenticate } = require('../middleware/auth');
const Permission = require('../middleware/permission');
const { Resume, ResumeJob } = require('../models');
const { Op } = require('sequelize');
const sms = require('../services/smsService');
const emailService = require('../services/emailService');

const router = express.Router();

// 所有简历相关路由都需要认证
router.get('/', authenticate, Permission.rateLimit(500, 60*60*1000), getAllResumes);
router.get('/:id', authenticate, Permission.rateLimit(500, 60*60*1000), getResumeById);
router.post('/', authenticate, Permission.requireSubscription, Permission.checkApiLimit('resumeUpload'), Permission.rateLimit(300, 60*60*1000), createResume);
router.put('/:id', authenticate, Permission.requireSubscription, Permission.rateLimit(300, 60*60*1000), updateResume);
router.put('/:id/status', authenticate, Permission.requireSubscription, Permission.rateLimit(300, 60*60*1000), updateResumeStatus);
router.delete('/:id', authenticate, Permission.requireSubscription, Permission.rateLimit(200, 60*60*1000), deleteResume);

// 批量删除简历
router.post('/batch-delete', authenticate, Permission.requireSubscription, Permission.rateLimit(200, 60*60*1000), batchDeleteResumes);

// 批量导入简历
router.post('/batch-import', authenticate, Permission.requireSubscription, Permission.checkApiLimit('resumeUpload'), Permission.rateLimit(100, 60*60*1000), async (req, res) => {
    try {
        const { resumes } = req.body;
        
        if (!Array.isArray(resumes) || resumes.length === 0) {
            return res.status(400).json({
                success: false,
                error: { message: '无效的导入数据' }
            });
        }

        const userId = req.user.id;
        const companyId = req.user.company_id;
        const createdResumes = [];

        for (const resumeData of resumes) {
                // 为批量导入的简历分配随机头像 (1.svg - 12.svg)
                const avatarIndex = Math.floor(Math.random() * 12) + 1;
                const avatar = `/avatars/${avatarIndex}.svg`;

                const resume = await Resume.create({
                    user_id: userId,
                    company_id: companyId,
                    name: resumeData.name || resumeData.fileName || '未命名简历',
                    file_name: resumeData.fileName || resumeData.name || 'unknown.pdf',
                    file_size: resumeData.fileSize || 0,
                    file_type: resumeData.fileType || 'pdf',
                    file_path: resumeData.filePath || '',
                    status: 'uploaded',
                    parsed_data: resumeData.parsedData || {},
                    tags: resumeData.tags || [],
                    source: resumeData.source || 'import',
                    avatar: avatar, // 分配固化的随机头像
                    recruitment_status: '投递'
                });
                createdResumes.push(resume);
            }

        res.json({
            success: true,
            data: createdResumes.map(r => ({
                id: r.id,
                name: r.name,
                file_name: r.file_name
            }))
        });
    } catch (error) {
        console.error('批量导入失败:', error);
        res.status(500).json({
            success: false,
            error: { message: '批量导入失败: ' + error.message }
        });
    }
});

// 搜索简历
router.post('/search', authenticate, Permission.rateLimit(500, 60*60*1000), async (req, res) => {
    try {
        const { query, filters } = req.body || {};
        const userId = req.user.id;
        const companyId = req.user.company_id;

        const whereClause = {
            user_id: userId
        };

        if (companyId) {
            whereClause.company_id = companyId;
        }

        if (query) {
            whereClause[Op.or] = [
                { name: { [Op.like]: `%${query}%` } },
                { file_name: { [Op.like]: `%${query}%` } },
                { 'parsed_data->name': { [Op.like]: `%${query}%` } },
                { 'parsed_data->jobTitle': { [Op.like]: `%${query}%` } }
            ];
        }

        if (filters) {
            if (filters.position || filters.jobTitle) {
                whereClause[Op.or] = whereClause[Op.or] || [];
                whereClause[Op.or].push({
                    'parsed_data->jobTitle': { [Op.like]: `%${filters.position || filters.jobTitle}%` }
                });
            }
            
            if (filters.tags && Array.isArray(filters.tags)) {
                whereClause.tags = { [Op.overlap]: filters.tags };
            }
            
            if (filters.status) {
                whereClause.status = filters.status;
            }
        }

        const resumes = await Resume.findAll({
            where: whereClause,
            order: [['created_at', 'DESC']],
            limit: 100
        });

        const results = resumes.map(r => ({
            id: r.id,
            name: r.name,
            file_name: r.file_name,
            jobTitle: r.parsed_data?.jobTitle || '',
            position: r.parsed_data?.position || '',
            status: r.status,
            tags: r.tags || [],
            created_at: r.created_at,
            updated_at: r.updated_at
        }));

        res.json({
            success: true,
            data: results
        });
    } catch (error) {
        console.error('搜索简历失败:', error);
        res.status(500).json({
            success: false,
            error: { message: '搜索失败: ' + error.message }
        });
    }
});

// 安排面试
router.post('/:id/interview', authenticate, Permission.requireSubscription, Permission.rateLimit(300, 60*60*1000), async (req, res) => {
    console.log(`[面试通知] 收到请求: ID=${req.params.id}, Body=`, JSON.stringify(req.body));
    try {
        const { id } = req.params;
        const { datetime, channel, location, note, aiQuestionCount } = req.body || {};
        
        if (!datetime) {
            return res.status(400).json({
                success: false,
                error: { message: '缺少面试时间' }
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
                error: { message: '简历不存在' }
            });
        }

        const parsedData = resume.parsed_data || {};
        parsedData.interview = {
            datetime,
            channel: channel || 'offline',
            location: location || '',
            note: note || '',
            aiQuestionCount: aiQuestionCount || 8
        };

        await resume.update({
            parsed_data: parsedData
        });

        const notifications = { sms: { attempted: false, sent: false, skipped: false }, email: { attempted: false, sent: false, skipped: false } }

        // 发送面试通知（短信 + 邮件）
        try {
            // 更鲁棒的电话号码提取
            let phone = resume.phone || parsedData.phone || (parsedData.basic_info && parsedData.basic_info.phone);
            const phoneRegex = /1[3-9]\d{9}/;
            
            // 如果上述方式都没找到合法的 11 位手机号，尝试从原始文本中匹配
            if (!phone || !phoneRegex.test(String(phone))) {
                const rawText = resume.raw_text || '';
                const phoneMatch = rawText.match(phoneRegex);
                if (phoneMatch) {
                    phone = phoneMatch[0];
                    console.log(`[面试通知] 从原始文本中提取到手机号: ${phone}`);
                }
            }

            const email = resume.email || parsedData.email || (parsedData.basic_info && parsedData.basic_info.email);
            const name = resume.name || parsedData.name || (parsedData.basic_info && parsedData.basic_info.name) || '候选人';

            console.log(`[面试通知] 准备发送通知: 姓名=${name}, 电话=${phone}, 邮箱=${email}, 简历ID=${resume.id}`);

            const dt = new Date(datetime);
            const timeStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
            
            const smsCfg = await sms.getConfig();
            const portalUrl = (smsCfg.portalUrl || 'https://master.cloujade.com').replace(/\/$/, '');
            const latestResumeJob = await ResumeJob.findOne({ where: { resume_id: resume.id }, order: [['id', 'DESC']] });
            const resumeJobId = latestResumeJob ? latestResumeJob.id : null;
            const interviewLink = resumeJobId ? `${portalUrl}/interview.html?resumeJobId=${resumeJobId}` : `${portalUrl}/interview.html?resumeId=${resume.id}`;
            const position = resume.job_title || parsedData.jobTitle || parsedData.position || '该职位';

            // 1. 发送短信
            if (phone && phoneRegex.test(String(phone)) && resumeJobId) {
                const company = (req.user && req.user.company_name) || smsCfg.siteName || '某公司';
                const smsParams = {
                    name: name,
                    company: company,
                    time: timeStr,
                    jobId: String(resumeJobId)
                };
                
                notifications.sms.attempted = true
                console.log(`[面试通知] 正在发送短信给 ${phone}, 场景: INTERVIEW, 参数:`, JSON.stringify(smsParams));
                const smsResult = await sms.sendText(String(phone), smsParams, sms.SCENARIOS.INTERVIEW);
                
                notifications.sms.sent = smsResult && smsResult.sent === true
                if (!notifications.sms.sent) {
                    console.error(`[面试通知] 短信发送失败: ${smsResult.error} - ${smsResult.message || ''}`);
                } else {
                    console.log(`[面试通知] 短信发送成功:`, JSON.stringify(smsResult));
                }
            } else {
                notifications.sms.skipped = true
                console.log(`[面试通知] 未找到合法的11位电话号码或候选记录，跳过短信发送. 电话: ${phone}`);
            }

            // 2. 发送邮件
            if (email) {
                notifications.email.attempted = true
                console.log(`[面试通知] 正在发送邮件给 ${email}`);
                const typeStr = (channel === 'video' || channel === 'online') ? '线上面试' : (channel === 'phone' ? '电话面试' : '现场面试');
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
                const emailResult = await emailService.sendMail(String(email), built.subject || subject, built.html || html, built.text || '');
                notifications.email.sent = emailResult && emailResult.success === true
                if (notifications.email.sent) console.log(`[面试通知] 邮件发送成功`);
            } else {
                notifications.email.skipped = true
                console.log(`[面试通知] 未找到邮箱地址，跳过邮件发送`);
            }
        } catch (notifyError) {
            console.error('[面试通知] 发送面试通知过程中出现错误:', notifyError);
        }

        res.json({
            success: true,
            data: {
                id: resume.id,
                interview: parsedData.interview,
                notifications
            }
        });
    } catch (error) {
        console.error('安排面试失败:', error);
        res.status(500).json({
            success: false,
            error: { message: '安排面试失败: ' + error.message }
        });
    }
});

// 发送Offer
router.post('/:id/offer', authenticate, Permission.requireSubscription, Permission.rateLimit(300, 60*60*1000), async (req, res) => {
    try {
        const { id } = req.params;
        const { phone, email, message } = req.body || {};
        const { Company } = require('../models');
        const sms = require('../services/smsService');

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
                error: { message: '简历不存在' }
            });
        }

        const parsedData = resume.parsed_data || {};
        parsedData.offer = {
            sent_at: new Date().toISOString(),
            message: message || '恭喜您通过面试，我们向您发出录用意向。',
            phone: phone || '',
            email: email || ''
        };

        await resume.update({
            recruitment_status: 'Offer',
            parsed_data: parsedData
        });
        
        const notifications = { sms: { attempted: false, sent: false, skipped: false }, email: { attempted: false, sent: false, skipped: false } }

        let targetPhone = phone || resume.phone || parsedData.phone || (parsedData.basic_info && parsedData.basic_info.phone)
        if (!targetPhone) {
            const rawText = resume.raw_text || ''
            const phoneMatch = rawText.match(/1\d{10}/)
            if (phoneMatch) targetPhone = phoneMatch[0]
        }

        const targetEmail = email || resume.email || parsedData.email || (parsedData.basic_info && parsedData.basic_info.email)
        const candidateName = resume.name || parsedData.name || (parsedData.basic_info && parsedData.basic_info.name) || '候选人'

        let companyName = req.user.company_name || '我司'
        if (!req.user.company_name && req.user.company_id) {
            const company = await Company.findByPk(req.user.company_id)
            if (company && company.name) companyName = company.name
        }

        const targetDate = new Date()
        targetDate.setDate(targetDate.getDate() + 4)
        const timeStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`

        const offerMessage = message || '恭喜您通过面试，我们向您发出录用意向。'

        if (targetPhone) {
            notifications.sms.attempted = true
            try {
                const smsParams = {
                    name: candidateName,
                    company: companyName,
                    time: timeStr
                }
                console.log(`[Offer通知] 正在发送短信给 ${targetPhone}, 场景: OFFER, 参数:`, JSON.stringify(smsParams))
                const smsResult = await sms.sendText(String(targetPhone), smsParams, sms.SCENARIOS.OFFER)
                notifications.sms.sent = smsResult && smsResult.sent === true
                if (!notifications.sms.sent) console.error(`[Offer通知] 短信发送失败: ${smsResult && smsResult.error ? smsResult.error : 'UNKNOWN'}`)
            } catch (smsError) {
                console.error('[Offer通知] 发送短信过程中出现错误:', smsError)
            }
        } else {
            notifications.sms.skipped = true
            console.log('[Offer通知] 未找到电话号码，跳过短信发送')
        }

        if (targetEmail) {
            notifications.email.attempted = true
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
                const emailResult = await emailService.sendMail(String(targetEmail), built.subject || subject, built.html || html, built.text || '')
                notifications.email.sent = emailResult && emailResult.success === true
            } catch (emailError) {
                console.error('[Offer通知] 发送邮件过程中出现错误:', emailError)
            }
        } else {
            notifications.email.skipped = true
            console.log('[Offer通知] 未找到邮箱地址，跳过邮件发送')
        }

        res.json({
            success: true,
            data: {
                id: resume.id,
                offer: parsedData.offer,
                notifications
            }
        });
    } catch (error) {
        console.error('发送Offer失败:', error);
        res.status(500).json({
            success: false,
            error: { message: '发送Offer失败: ' + error.message }
        });
    }
});

// 更新简历状态
router.put('/:id/status', authenticate, Permission.requireSubscription, Permission.rateLimit(300, 60*60*1000), async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes, reason } = req.body;
        const finalNotes = notes || reason || '';

        if (!status) {
            return res.status(400).json({
                success: false,
                error: { message: '请提供新的状态' }
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
                error: { message: '简历不存在' }
            });
        }

        const updateData = { recruitment_status: status };
        
        // 如果有备注，存入 parsed_data
        if (finalNotes) {
            const parsedData = resume.parsed_data || {};
            parsedData.status_notes = parsedData.status_notes || {};
            parsedData.status_notes[status] = finalNotes;
            updateData.parsed_data = parsedData;
        }

        await resume.update(updateData);

        // 如果该简历有关联的招聘流程，同步更新最新的 ResumeJob 记录
        try {
            const statusMap = {
                '投递': 'applied',
                '快评': 'screening',
                '面试': 'interview',
                'Offer': 'offer',
                '入职': 'hired',
                '淘汰': 'rejected',
                '放弃': 'rejected'
            };
            const engStatus = statusMap[status];
            if (engStatus) {
                const { ResumeJob } = require('../models');
                const latestJob = await ResumeJob.findOne({
                    where: { resume_id: id },
                    order: [['updated_at', 'DESC']]
                });
                if (latestJob) {
                    await latestJob.update({ status: engStatus });
                }
            }
        } catch (syncErr) {
            console.error('Sync to ResumeJob failed:', syncErr);
        }

        res.json({
            success: true,
            data: {
                id: resume.id,
                recruitment_status: status,
                notes: finalNotes
            },
            message: '状态更新成功'
        });
    } catch (error) {
        console.error('更新简历状态失败:', error);
        res.status(500).json({
            success: false,
            error: { message: '更新状态失败: ' + error.message }
        });
    }
});

module.exports = router;
