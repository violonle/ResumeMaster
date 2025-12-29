const express = require('express');
const { getAllResumes, getResumeById, createResume, updateResume, deleteResume, batchDeleteResumes } = require('../controllers/resumeController');
const { authenticate } = require('../middleware/auth');
const Permission = require('../middleware/permission');
const { Resume } = require('../models');
const { Op } = require('sequelize');

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
    try {
        const { id } = req.params;
        const { datetime, channel, location, note } = req.body || {};
        
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
            note: note || ''
        };

        await resume.update({
            recruitment_status: '面试',
            parsed_data: parsedData
        });

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
