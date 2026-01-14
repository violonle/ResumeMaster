const express = require('express');
const { getAllResumes, getResumeById, createResume, updateResume, deleteResume, batchDeleteResumes } = require('../controllers/resumeController');
const { authenticate } = require('../middleware/auth');
const Permission = require('../middleware/permission');
const { Resume } = require('../models');
const { Op } = require('sequelize');
const sms = require('../services/smsService');
const emailService = require('../services/emailService');

const router = express.Router();

// 所有简历相关路由都需要认证
router.get('/', authenticate, Permission.rateLimit(500, 60*60*1000), getAllResumes);
router.get('/recruitment/status-grouped', authenticate, Permission.rateLimit(500, 60*60*1000), async (req, res) => {
    try {
        const userId = req.user.id;
        const companyId = req.user.company_id;

        const whereClause = {
            user_id: userId
        };

        if (companyId) {
            whereClause.company_id = companyId;
        }

        const resumes = await Resume.findAll({
            where: whereClause,
            order: [['upload_date', 'DESC']],
            attributes: [
                'id', 'name', 'file_name', 'email', 'phone', 'job_title', 
                'recruitment_status', 'upload_date', 'parsed_data'
            ]
        });

        const statusGroups = {
            '投递': [],
            '初筛': [],
            '面试': [],
            'Offer': [],
            '入职': []
        };

        resumes.forEach(resume => {
            const status = resume.recruitment_status || '投递';
            if (statusGroups[status]) {
                const parsedData = resume.parsed_data || {};
                statusGroups[status].push({
                    id: resume.id,
                    name: resume.name || parsedData.name || resume.file_name || '未命名',
                    file_name: resume.file_name,
                    email: resume.email || parsedData.email || '',
                    phone: resume.phone || parsedData.phone || '',
                    job_title: resume.job_title || parsedData.jobTitle || parsedData.position || '职位未知',
                    position: resume.job_title || parsedData.jobTitle || parsedData.position || '职位未知',
                    recruitment_status: resume.recruitment_status,
                    upload_date: resume.upload_date,
                    parsed_data: parsedData
                });
            }
        });

        res.json({
            success: true,
            data: statusGroups
        });
    } catch (error) {
        console.error('获取招聘流程数据失败:', error);
        res.status(500).json({
            success: false,
            error: { message: '获取招聘流程数据失败: ' + error.message }
        });
    }
});
router.get('/:id', authenticate, Permission.rateLimit(500, 60*60*1000), getResumeById);
router.post('/', authenticate, Permission.requireSubscription, Permission.checkApiLimit('resumeUpload'), Permission.rateLimit(300, 60*60*1000), createResume);
router.put('/:id', authenticate, Permission.requireSubscription, Permission.rateLimit(300, 60*60*1000), updateResume);
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
            recruitment_status: '面试',
            parsed_data: parsedData
        });

        // 发送面试通知（短信 + 邮件）
        try {
            // 更鲁棒的电话号码提取
            let phone = resume.phone || parsedData.phone || (parsedData.basic_info && parsedData.basic_info.phone);
            
            // 如果上述方式都没找到合法的 11 位手机号，尝试从原始文本中匹配
            if (!phone || !/1\d{10}/.test(String(phone))) {
                const rawText = resume.raw_text || '';
                const phoneMatch = rawText.match(/1\d{10}/);
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
            const interviewLink = `${portalUrl}?resumeId=${resume.id}`;

            // 准备短信模板变量
            const smsParams = {
                name: name,
                time: timeStr,
                jobId: String(resume.id), // 显式转为字符串
                link: interviewLink // 增加 link 参数，以防模板支持
            };

            // 1. 发送短信
            if (phone) {
                console.log(`[面试通知] 正在发送短信给 ${phone}, 参数:`, JSON.stringify(smsParams));
                const smsResult = await sms.sendText(String(phone), smsParams, sms.SCENARIOS.INTERVIEW);
                console.log(`[面试通知] 短信发送结果:`, JSON.stringify(smsResult));
            } else {
                console.log(`[面试通知] 未找到电话号码，跳过短信发送`);
            }

            // 2. 发送邮件
            if (email) {
                console.log(`[面试通知] 正在发送邮件给 ${email}`);
                const typeStr = channel === 'video' ? '视频面试' : (channel === 'phone' ? '线上面试' : '现场面试');
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
                await emailService.sendMail(email, subject, html);
                console.log(`[面试通知] 邮件发送成功`);
            } else {
                console.log(`[面试通知] 未找到邮箱地址，跳过邮件发送`);
            }
        } catch (notifyError) {
            console.error('[面试通知] 发送面试通知过程中出现错误:', notifyError);
        }

        res.json({
            success: true,
            data: {
                id: resume.id,
                interview: parsedData.interview
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

        res.json({
            success: true,
            data: {
                id: resume.id,
                offer: parsedData.offer
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

module.exports = router;
