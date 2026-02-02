const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { Resume, Job, ResumeJob, AnalysisResult, sequelize } = require('../models');
const { Op } = require('sequelize');
const DomesticAIService = require('../services/domesticAIService');
const aiService = new DomesticAIService();

// 获取仪表盘统计数据
router.get('/stats', authenticate, async (req, res) => {
    try {
        const buildAccessClause = (prefix = '') => {
            const field = (name) => prefix ? `${prefix}.${name}` : name;
            if (req.user.company_id) {
                return {
                    [Op.or]: [
                        { [field('company_id')]: req.user.company_id },
                        { [field('user_id')]: req.user.id }
                    ]
                };
            } else {
                return { [field('user_id')]: req.user.id };
            }
        };

        const whereUser = buildAccessClause();
        
        // 1. 候选人总数 (人才库中的简历)
        const totalCandidates = await Resume.count({ 
            where: {
                ...whereUser,
                is_talent_pool: true
            } 
        });

        // 2. 今日新增 (人才库中的简历)
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const newCandidatesToday = await Resume.count({
            where: {
                ...whereUser,
                upload_date: { [Op.gte]: todayStart },
                is_talent_pool: true
            }
        });

        // 3. 招聘进行中 (发布的职位)
        const activeJobs = await Job.count({
            where: {
                ...whereUser,
                status: 'active'
            }
        });

        // 4. 待面试 / 待入职
        // 需要关联 Job 和 Resume，或者直接查 Pipeline
        // 假设 Pipeline 有 creator_id 或者关联 Job 的 creator_id
        // 这里简化，假设 Pipeline 有 user_id (recruiter) 或者通过 job 关联
        // 既然 ResumeJob 通常关联 Job，而 Job 关联 User
        
        // 查找该用户发布的职位的所有流程记录
        const userJobs = await Job.findAll({
            where: whereUser,
            attributes: ['id']
        });
        const jobIds = userJobs.map(j => j.id);

        let interviewsScheduled = 0;
        let offersSent = 0;

        if (jobIds.length > 0) {
            interviewsScheduled = await ResumeJob.count({
                where: {
                    job_id: { [Op.in]: jobIds },
                    status: 'interview'
                }
            });
            offersSent = await ResumeJob.count({
                where: {
                    job_id: { [Op.in]: jobIds },
                    status: 'offer'
                }
            });
        }

        // 统计已快评的简历数量 (status = 'screening')
        const screenedResumes = await ResumeJob.count({
            where: {
                job_id: { [Op.in]: jobIds },
                status: 'screening'
            }
        });

        res.json({
            data: {
                total_candidates: totalCandidates,
                new_candidates_today: newCandidatesToday,
                active_jobs: activeJobs,
                interviews_scheduled: interviewsScheduled,
                offers_sent: offersSent,
                screened_resumes: screenedResumes
            }
        });
    } catch (error) {
        console.error('Get dashboard stats error:', error);
        res.status(500).json({ success: false, error: { message: '获取统计数据失败' } });
    }
});

// 获取待办事项
router.get('/tasks', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const companyId = req.user.company_id;
        
        // 查找该用户发布的职位的所有流程记录
        const userJobs = await Job.findAll({
            where: companyId ? { company_id: companyId } : { user_id: userId },
            attributes: ['id', 'title']
        });
        const jobIds = userJobs.map(j => j.id);
        const jobMap = {};
        userJobs.forEach(j => jobMap[j.id] = j.title);

        const tasks = [];

        if (jobIds.length > 0) {
            // 1. 待快评简历 (status = 'applied')
            const pendingReviews = await ResumeJob.findAll({
                where: {
                    job_id: { [Op.in]: jobIds },
                    status: 'applied'
                },
                limit: 5,
                order: [['applied_at', 'DESC']],
                include: [{ model: Resume, attributes: ['file_name', 'parsed_data'] }] 
            });

            if (pendingReviews.length > 0) {
                tasks.push({
                    type: 'review',
                    title: '待快评简历',
                    count: await ResumeJob.count({
                        where: {
                            job_id: { [Op.in]: jobIds },
                            status: 'applied'
                        }
                    }),
                    priority: 'high',
                    link: 'resume-management.html?status=pending',
                    items: pendingReviews.map(p => {
                        let name = '新候选人';
                        if (p.Resume) {
                             if (p.Resume.parsed_data && p.Resume.parsed_data.name) {
                                 name = p.Resume.parsed_data.name;
                             } else {
                                 name = p.Resume.file_name;
                             }
                        }
                        return {
                            id: p.id,
                            resumeId: p.resume_id,
                            score: p.match_score,
                            desc: `${name} - ${jobMap[p.job_id]}`,
                            time: p.created_at
                        };
                    })
                });
            }

            // 2. 已快评 (status = 'screening')
            const recentScreened = await ResumeJob.findAll({
                where: {
                    job_id: { [Op.in]: jobIds },
                    status: 'screening'
                },
                limit: 5,
                order: [['updated_at', 'DESC']],
                include: [{ model: Resume, attributes: ['file_name', 'parsed_data'] }]
            });

            if (recentScreened.length > 0) {
                tasks.push({
                    type: 'screened',
                    title: '已快评简历',
                    count: await ResumeJob.count({
                        where: {
                            job_id: { [Op.in]: jobIds },
                            status: 'screening'
                        }
                    }),
                    priority: 'medium',
                    link: 'resume-management.html?status=screening',
                    items: recentScreened.map(p => {
                        let name = '候选人';
                        if (p.Resume) {
                             if (p.Resume.parsed_data && p.Resume.parsed_data.name) {
                                 name = p.Resume.parsed_data.name;
                             } else {
                                 name = p.Resume.file_name;
                             }
                        }
                        return {
                            id: p.id,
                            resumeId: p.resume_id,
                            score: p.match_score,
                            desc: `${name} - ${jobMap[p.job_id]}`,
                            time: p.updated_at
                        };
                    })
                });
            }

            // 3. 待面试
            const interviews = await ResumeJob.findAll({
                where: {
                    job_id: { [Op.in]: jobIds },
                    status: 'interview'
                },
                limit: 5,
                order: [['updated_at', 'ASC']],
                include: [{ model: Resume, attributes: ['file_name', 'parsed_data'] }]
            });

            if (interviews.length > 0) {
                tasks.push({
                    type: 'interview',
                    title: '待面试',
                    count: interviews.length,
                    priority: 'high',
                    link: 'recruitment-flow.html?status=interview',
                    items: interviews.map(p => {
                        let name = '候选人';
                        if (p.Resume) {
                             if (p.Resume.parsed_data && p.Resume.parsed_data.name) {
                                 name = p.Resume.parsed_data.name;
                             } else {
                                 name = p.Resume.file_name;
                             }
                        }
                        return {
                            id: p.id,
                            resumeId: p.resume_id,
                            score: p.match_score,
                            desc: `${name} - ${jobMap[p.job_id]}`,
                            time: p.updated_at
                        };
                    })
                });
            }

            // 3. 待审批Offer (status = 'offer')
            const offers = await ResumeJob.findAll({
                where: {
                    job_id: { [Op.in]: jobIds },
                    status: 'offer'
                },
                limit: 5,
                include: [{ model: Resume, attributes: ['file_name', 'parsed_data'] }]
            });

            if (offers.length > 0) {
                tasks.push({
                    type: 'offer',
                    title: 'Offer跟进',
                    count: offers.length,
                    priority: 'medium',
                    link: 'recruitment-flow.html?status=offer',
                    items: offers.map(p => {
                        let name = '候选人';
                        if (p.Resume) {
                             if (p.Resume.parsed_data && p.Resume.parsed_data.name) {
                                 name = p.Resume.parsed_data.name;
                             } else {
                                 name = p.Resume.file_name;
                             }
                        }
                        return {
                            id: p.id,
                            resumeId: p.resume_id,
                            score: p.match_score,
                            desc: `${name} - ${jobMap[p.job_id]}`,
                            time: p.updated_at
                        };
                    })
                });
            }
        }

        res.json({ success: true, data: tasks });
    } catch (error) {
        console.error('Get pending tasks error:', error);
        res.status(500).json({ success: false, error: { message: '获取待办事项失败' } });
    }
});

// 获取AI预测数据
router.get('/ai-prediction', authenticate, async (req, res) => {
    try {
        const { period } = req.query;
        const userId = req.user.id;
        const companyId = req.user.company_id;

        // 获取用于AI分析的上下文数据
        // 1. 获取用户的活跃职位
        const userJobs = await Job.findAll({
            where: companyId ? { company_id: companyId } : { user_id: userId },
            attributes: ['id', 'title', 'department', 'status', 'created_at']
        });
        const jobIds = userJobs.map(j => j.id);

        let pipelineStats = {
            total_candidates: 0,
            status_distribution: {},
            recent_activities: [] // 最近的招聘活动
        };

        if (jobIds.length > 0) {
            // 2. 获取招聘漏斗数据
            const pipeline = await ResumeJob.findAll({
                where: { job_id: { [Op.in]: jobIds } },
                attributes: ['status', 'applied_at', 'updated_at'],
                order: [['updated_at', 'DESC']]
            });

            pipelineStats.total_candidates = pipeline.length;
            
            // 统计各状态数量
            pipeline.forEach(p => {
                pipelineStats.status_distribution[p.status] = (pipelineStats.status_distribution[p.status] || 0) + 1;
            });

            // 获取最近10条活动作为动态参考
            pipelineStats.recent_activities = pipeline.slice(0, 10).map(p => ({
                status: p.status,
                time: p.updated_at
            }));
        }

        // 3. 构建AI分析上下文
        const contextData = {
            period: period || '7d', // 默认7天
            active_jobs_count: userJobs.filter(j => j.status === 'active').length,
            jobs_sample: userJobs.slice(0, 5).map(j => j.title), // 仅取前5个职位名作为样本
            pipeline_stats: pipelineStats
        };

        // 4. 调用AI服务生成非量化趋势预测
        // 传递用户上下文以便选择合适的模型（如企业版模型）
        const userCtx = { 
            id: req.user.id, 
            company_id: req.user.company_id,
            role: req.user.role 
        };

        const timeoutMs = 30000; // 增加到 30 秒，给 AI 足够的时间生成内容
        const timeoutFallback = {
            success: false,
            data: {
                trend_analysis: "预测生成超时，已返回降级结果。请点击“重新分析”重试。",
                pipeline_health: "处理中",
                potential_bottlenecks: ["AI 生成时间过长"],
                suggestions: ["稍后重试", "检查网络连接", "检查 AI 服务配置"]
            },
            service: 'TIMEOUT',
            model: 'timeout'
        };

        const aiResult = await Promise.race([
            aiService.generateRecruitmentForecast(contextData, userCtx),
            new Promise(resolve => setTimeout(() => resolve(timeoutFallback), timeoutMs))
        ]);

        res.json({
            success: true,
            data: {
                period: period || '7d',
                ai_analysis: aiResult && aiResult.data ? aiResult.data : timeoutFallback.data,
                stats: {
                    active_jobs: contextData.active_jobs_count,
                    total_candidates: pipelineStats.total_candidates
                }
            }
        });

    } catch (error) {
        console.error('Get AI prediction error:', error);
        // 出错时返回友好的降级数据
        res.json({
            success: true,
            data: {
                ai_analysis: {
                    trend_analysis: "暂时无法生成趋势分析，请稍后再试。",
                    pipeline_health: "数据获取异常",
                    potential_bottlenecks: [],
                    suggestions: ["检查网络连接", "刷新页面重试"]
                }
            }
        });
    }
});

module.exports = router;
