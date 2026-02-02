/**
 * AI分析控制器
 * 处理真实的AI简历分析请求
 */
const AIAnalysisService = require('../services/aiAnalysisService');
const OptimizedResumeParseService = require('../services/optimizedResumeParseService');
const DomesticAIService = require('../services/domesticAIService');
const { Resume } = require('../models');
const multer = require('multer');
const path = require('path');
const { extractTextFromFile } = require('../services/textExtractor');
const aiController = require('./aiController');

const domesticAIService = new DomesticAIService();

// 配置multer用于文件上传
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/resumes');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB限制
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.pdf', '.docx', '.doc', '.txt', '.html'];
        const ext = path.extname(file.originalname).toLowerCase();
        
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('不支持的文件格式。请上传PDF、DOC、DOCX、TXT或HTML文件。'));
        }
    }
});

const aiAnalysisService = new AIAnalysisService();

/**
 * 文档上传和解析
 */
const uploadAndParseDocument = async (req, res) => {
    try {
        const { targetJob } = req.body;
        const targetJobObj = targetJob ? JSON.parse(targetJob) : null;

        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'NO_FILE',
                    message: '请选择要上传的简历文件'
                }
            });
        }

        const filePath = req.file.path;
        const fileName = req.file.originalname;
        const fileSize = req.file.size;

        // 提取文档内容
        let resumeContent;
        try {
            resumeContent = await extractTextFromFile(filePath);
        } catch (error) {
            // 清理上传的文件
            require('fs').unlink(filePath, () => {});
            return res.status(400).json({
                success: false,
                error: {
                    code: 'PARSE_ERROR',
                    message: `文档解析失败: ${error.message}`
                }
            });
        }

        // 使用优化的解析服务解析简历
        let parsedData = {};
        try {
            const parseService = new OptimizedResumeParseService();
            const fileType = path.extname(fileName).replace('.', '').toLowerCase() || 'txt';
            parsedData = await parseService.parseResumeContent(resumeContent, fileType);
            
            // 核心优化：如果关键信息缺失，触发 AI 结构化提取
            const isCoreMissing = !parsedData.name || parsedData.name === '姓名' || parsedData.name === '未知' || 
                                 !parsedData.phone || !parsedData.email;
            
            if (isCoreMissing) {
                console.log(`[AIAnalysisController] Core info missing for ${fileName}, triggering AI structured extraction...`);
                const aiResult = await domesticAIService.extractStructuredData(resumeContent, req.user);
                if (aiResult.success && aiResult.data) {
                    console.log(`[AIAnalysisController] AI structured extraction success for ${fileName}:`, {
                        name: aiResult.data.name,
                        phone: aiResult.data.phone,
                        email: aiResult.data.email
                    });
                    // 合并 AI 结果
                    parsedData = {
                        ...parsedData,
                        ...aiResult.data,
                        name: aiResult.data.name || parsedData.name,
                        phone: aiResult.data.phone || parsedData.phone,
                        email: aiResult.data.email || parsedData.email
                    };
                }
            }

            console.log('简历最终解析结果:', JSON.stringify({
                name: parsedData.name,
                email: parsedData.email,
                phone: parsedData.phone,
                skills_count: parsedData.skills?.length || 0,
                education_count: parsedData.education?.length || 0,
                work_experience_count: parsedData.work_experience?.length || 0,
                summary_length: parsedData.summary?.length || 0
            }, null, 2));
        } catch (parseError) {
            console.warn('简历解析失败，使用原始内容:', parseError.message);
            parsedData = { content: resumeContent };
        }

        // 保存简历到数据库
        const resumeName = (parsedData.name && parsedData.name !== '姓名' && parsedData.name !== '未知') ? parsedData.name : fileName;
        
        const resume = await Resume.create({
            user_id: req.user.id,
            file_name: fileName,
            file_size: fileSize,
            file_type: path.extname(fileName),
            file_path: filePath,
            upload_date: new Date(),
            parsed_data: parsedData,
            raw_text: resumeContent,
            status: 'uploaded',
            // 从解析数据中提取各个字段
            name: resumeName,
            phone: parsedData.phone || null,
            email: parsedData.email || null,
            location: parsedData.location || parsedData.city || parsedData.expectCity || null,
            job_title: parsedData.job_title || null,
            experience_years: parsedData.experience_years || null,
            highest_education: parsedData.highest_education || null,
            job_status: parsedData.job_status || null,
            expected_salary: parsedData.expected_salary || null,
            work_experience: parsedData.work_experience || null,
            education: parsedData.education || null,
            skills: parsedData.skills || null,
            summary: parsedData.summary || null,
            projects: parsedData.projects || null
        });

        // 清理临时文件
        require('fs').unlink(filePath, () => {});

        // 自动快评（仅综合匹配度，不触发深度解析）
        try {
            console.log(`[Auto-Screen] Automatically triggering quick screening for resume ${resume.id}`);
            aiController.processAnalysisBackground(resume.id, resumeContent, targetJobObj || null, req.user, { scene: 'resume_quick_score' })
                .catch(err => console.error('[Auto-Screen] Background quick screening failed:', err));
            resume.status = 'processing';
            await resume.update({ status: 'processing' });
        } catch (e) {
            console.error('[Auto-Screen] Trigger failed:', e);
        }

        res.json({
            success: true,
            data: {
                resumeId: resume.id,
                fileName: fileName,
                fileSize: fileSize,
                contentLength: resumeContent.length,
                content: resumeContent.substring(0, 500) + '...', // 返回部分内容预览
                targetJob: targetJobObj,
                isAnalyzing: true
            },
            message: '文档上传成功，正在自动进行AI快评...'
        });

    } catch (error) {
        console.error('文档上传和解析错误:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'UPLOAD_ERROR',
                message: error.message
            }
        });
    }
};

/**
 * AI简历分析
 */
const analyzeResumeWithAI = async (req, res) => {
    try {
        const { resumeId, content, targetJob } = req.body;
        const targetJobObj = targetJob ? JSON.parse(targetJob) : null;

        let resumeContent;
        
        // 如果提供了resumeId，从数据库获取
        if (resumeId) {
            // 构建多租户隔离的查询条件
            const whereClause = {
                id: resumeId,
                [Op.or]: [
                    { user_id: req.user.id },
                    req.user.company_id ? { company_id: req.user.company_id } : null
                ].filter(Boolean)
            };

            const resume = await Resume.findOne({
                where: whereClause
            });

            if (!resume) {
                return res.status(404).json({
                    success: false,
                    error: {
                        code: 'RESUME_NOT_FOUND',
                        message: '简历不存在或无访问权限'
                    }
                });
            }

            resumeContent = resume.parsed_data?.content || '';
        } 
        // 如果直接提供内容
        else if (content) {
            resumeContent = content;
        } 
        else {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'NO_CONTENT',
                    message: '请提供简历ID或内容'
                }
            });
        }

        // 调用AI分析服务
        const analysisResult = await aiAnalysisService.analyzeResume(
            resumeContent,
            targetJobObj,
            options ? JSON.parse(options) : {}
        );

        // 如果有resumeId，更新数据库
        if (resumeId) {
            // 检查是否已有分析结果
            const { AnalysisResult } = require('../models');
            const existingAnalysis = await AnalysisResult.findOne({
                where: { resume_id: resumeId },
                order: [['analysis_date', 'DESC']]
            });

            if (existingAnalysis) {
                // 更新现有分析
                await existingAnalysis.update({
                    overall_score: analysisResult.overall_score,
                    dimensions: analysisResult.dimensions,
                    suggestions: analysisResult.suggestions,
                    strengths: analysisResult.strengths,
                    weaknesses: analysisResult.weaknesses,
                    target_job: analysisResult.targetJob,
                    detailed_analysis: analysisResult.detailed_analysis
                });
            } else {
                // 创建新分析结果
                await AnalysisResult.create({
                    resume_id: resumeId,
                    analysis_date: new Date(),
                    overall_score: analysisResult.overall_score,
                    dimensions: analysisResult.dimensions,
                    suggestions: analysisResult.suggestions,
                    strengths: analysisResult.strengths,
                    weaknesses: analysisResult.weaknesses,
                    target_job: analysisResult.targetJob,
                    detailed_analysis: analysisResult.detailed_analysis
                });
            }

            // 更新简历状态和分数
            await Resume.update(
                { 
                    status: 'analyzed',
                    score: analysisResult.overall_score // 确保更新 Resume 表的分数字段
                },
                { where: { id: resumeId } }
            );
        }

        res.json({
            success: true,
            data: analysisResult,
            message: 'AI分析完成'
        });

    } catch (error) {
        console.error('AI分析错误:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'AI_ANALYSIS_ERROR',
                message: error.message
            }
        });
    }
};

/**
 * 批量AI分析
 */
const batchAnalyzeResumes = async (req, res) => {
    try {
        const { resumeIds, options } = req.body;

        if (!resumeIds || !Array.isArray(resumeIds) || resumeIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_RESUME_IDS',
                    message: '请提供有效的简历ID列表'
                }
            });
        }

        // 获取所有简历内容
        const resumes = [];
        const jobDescription = options?.jobDescription || '';
        
        for (const resumeId of resumeIds) {
            // 构建多租户隔离的查询条件
            const whereClause = {
                id: resumeId,
                [Op.or]: [
                    { user_id: req.user.id },
                    req.user.company_id ? { company_id: req.user.company_id } : null
                ].filter(Boolean)
            };

            const resume = await Resume.findOne({
                where: whereClause
            });

            if (resume) {
                resumes.push({
                    id: resume.id,
                    content: resume.parsed_data?.content || resume.raw_text || '',
                    targetJob: jobDescription ? { title: jobDescription, requirements: jobDescription } : null
                });
            }
        }

        if (resumes.length === 0) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'NO_RESUMES_FOUND',
                    message: '未找到有效的简历数据'
                }
            });
        }

        // 批量分析
        const results = await aiAnalysisService.batchAnalyzeResumes(resumes, options);

        // 获取职位设置（如果是在特定职位上下文）
        let targetJob = null;
        if (options && options.jobId) {
            try {
                targetJob = await Job.findByPk(options.jobId);
            } catch (e) {
                console.error('获取目标职位失败:', e);
            }
        }

        // 保存批量分析结果到数据库
        for (const result of results) {
            if (result.success && result.data) {
                const analysisResult = result.data;
                const resumeId = result.resumeId;

                // 检查是否已有分析结果
                const existingAnalysis = await AnalysisResult.findOne({
                    where: { 
                        resume_id: resumeId,
                        [Op.or]: [
                            { user_id: req.user.id },
                            req.user.company_id ? { company_id: req.user.company_id } : null
                        ].filter(Boolean)
                    },
                    order: [['analysis_date', 'DESC']]
                });

                if (existingAnalysis) {
                    await existingAnalysis.update({
                        overall_score: analysisResult.overall_score,
                        dimensions: analysisResult.dimensions,
                        suggestions: analysisResult.suggestions,
                        strengths: analysisResult.strengths,
                        weaknesses: analysisResult.weaknesses,
                        target_job: analysisResult.targetJob,
                        detailed_analysis: analysisResult.detailed_analysis
                    });
                } else {
                    await AnalysisResult.create({
                        resume_id: resumeId,
                        user_id: req.user.id,
                        company_id: req.user.company_id || null,
                        analysis_date: new Date(),
                        overall_score: analysisResult.overall_score,
                        dimensions: analysisResult.dimensions,
                        suggestions: analysisResult.suggestions,
                        strengths: analysisResult.strengths,
                        weaknesses: analysisResult.weaknesses,
                        target_job: analysisResult.targetJob,
                        detailed_analysis: analysisResult.detailed_analysis
                    });
                }

                // 准备更新简历的数据
                const resumeUpdateData = {
                    status: 'analyzed',
                    score: analysisResult.overall_score,
                    last_analysis_date: new Date()
                };

                // 应用自动快评逻辑 (仅当在职位上下文中且开启了自动快评)
                let recruitmentStatus = undefined;
                let autoRejected = false;
                let rejectionReason = null;

                if (targetJob && targetJob.enable_auto_screening) {
                    const score = analysisResult.overall_score || 0;
                    const rejectScore = targetJob.auto_reject_score || 60;
                    
                    // 默认状态设为快评（只要分析了）
                    recruitmentStatus = '快评';
                    
                    if (score < rejectScore) {
                        recruitmentStatus = '淘汰';
                        autoRejected = true;
                        rejectionReason = `自动淘汰：评分 ${score} (低于 ${rejectScore})`;
                        
                        resumeUpdateData.auto_rejected = true;
                        resumeUpdateData.rejection_reason = rejectionReason;
                    }
                    
                    resumeUpdateData.recruitment_status = recruitmentStatus;
                }

                // 更新简历表
                await Resume.update(
                    resumeUpdateData,
                    { 
                        where: { 
                            id: resumeId,
                            [Op.or]: [
                                { user_id: req.user.id },
                                req.user.company_id ? { company_id: req.user.company_id } : null
                            ].filter(Boolean)
                        } 
                    }
                );

                // 同步更新 ResumeJob 关联表 (如果是职位上下文)
                if (targetJob) {
                    try {
                        const resumeJobUpdateData = {
                            match_score: analysisResult.overall_score
                        };
                        
                        if (recruitmentStatus) {
                            // 映射状态到 ResumeJob status
                            // '淘汰' -> 'rejected'
                            // '快评' -> 'screening'
                            resumeJobUpdateData.status = (recruitmentStatus === '淘汰') ? 'rejected' : 'screening';
                            if (rejectionReason) {
                                resumeJobUpdateData.notes = rejectionReason;
                            }
                        }

                        await ResumeJob.update(
                            resumeJobUpdateData,
                            {
                                where: {
                                    resume_id: resumeId,
                                    job_id: targetJob.id
                                }
                            }
                        );
                    } catch (rjErr) {
                        console.error(`更新 ResumeJob 失败 (resumeId: ${resumeId}, jobId: ${targetJob.id}):`, rjErr);
                    }
                }
            }
        }

        res.json({
            success: true,
            data: {
                total: results.length,
                successful: results.filter(r => r.success).length,
                failed: results.filter(r => !r.success).length,
                results: results
            },
            message: '批量分析完成'
        });

    } catch (error) {
        console.error('批量分析错误:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'BATCH_ANALYSIS_ERROR',
                message: error.message
            }
        });
    }
};

/**
 * 获取AI服务状态
 */
const getAIServiceStatus = async (req, res) => {
    try {
        const status = aiAnalysisService.getServiceStatus();
        
        res.json({
            success: true,
            data: status,
            message: 'AI服务状态获取成功'
        });

    } catch (error) {
        console.error('获取AI服务状态错误:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'STATUS_ERROR',
                message: error.message
            }
        });
    }
};

/**
 * 文本直接分析（不需要文件上传）
 */
const analyzeTextContent = async (req, res) => {
    try {
        const { content, targetJob, options } = req.body;
        const targetJobObj = targetJob ? JSON.parse(targetJob) : null;

        if (!content || content.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'NO_CONTENT',
                    message: '请提供简历文本内容'
                }
            });
        }

        // 限制内容长度
        if (content.length > 10000) {
            content = content.substring(0, 10000);
        }

        const analysisResult = await aiAnalysisService.analyzeResume(
            content,
            targetJobObj,
            options ? JSON.parse(options) : {}
        );

        res.json({
            success: true,
            data: analysisResult,
            message: '文本分析完成'
        });

    } catch (error) {
        console.error('文本分析错误:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'TEXT_ANALYSIS_ERROR',
                message: error.message
            }
        });
    }
};

module.exports = {
    upload,
    uploadAndParseDocument,
    analyzeResumeWithAI,
    batchAnalyzeResumes,
    getAIServiceStatus,
    analyzeTextContent
};
