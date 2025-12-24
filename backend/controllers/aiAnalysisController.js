/**
 * AI分析控制器
 * 处理真实的AI简历分析请求
 */
const AIAnalysisService = require('../services/aiAnalysisService');
const { Resume } = require('../models');
const multer = require('multer');
const path = require('path');

// 配置multer用于文件上传
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
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
        const allowedTypes = ['.pdf', '.docx', '.txt', '.html'];
        const ext = path.extname(file.originalname).toLowerCase();
        
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('不支持的文件格式。请上传PDF、DOCX、TXT或HTML文件。'));
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
            resumeContent = await aiAnalysisService.extractDocumentContent(filePath);
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

        // 保存简历到数据库
        const resume = await Resume.create({
            user_id: req.user.id,
            file_name: fileName,
            file_size: fileSize,
            file_type: path.extname(fileName),
            upload_date: new Date(),
            parsed_data: { content: resumeContent },
            status: 'uploaded'
        });

        // 清理临时文件
        require('fs').unlink(filePath, () => {});

        res.json({
            success: true,
            data: {
                resumeId: resume.id,
                fileName: fileName,
                fileSize: fileSize,
                contentLength: resumeContent.length,
                content: resumeContent.substring(0, 500) + '...', // 返回部分内容预览
                targetJob: targetJobObj
            },
            message: '文档上传和解析成功'
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
            const resume = await Resume.findOne({
                where: { 
                    id: resumeId, 
                    user_id: req.user.id 
                }
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
            targetJobObj
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

            // 更新简历状态
            await Resume.update(
                { status: 'analyzed' },
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
        for (const resumeId of resumeIds) {
            const resume = await Resume.findOne({
                where: { 
                    id: resumeId, 
                    user_id: req.user.id 
                }
            });

            if (resume) {
                resumes.push({
                    id: resume.id,
                    content: resume.parsed_data?.content || '',
                    targetJob: null // 可以从请求中获取目标职位
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
        const { content, targetJob } = req.body;
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
            targetJobObj
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