/**
 * AI分析服务
 * 集成真实的AI大模型进行简历分析
 */
const fs = require('fs').promises;
const path = require('path');
const promptService = require('./promptService');
const DomesticAIService = require('./domesticAIService');

class AIAnalysisService {
    constructor() {
        this.domesticAIService = new DomesticAIService();
    }

    /**
     * 获取首选的AI提供商
     */
    getPreferredProvider() {
        return 'domestic';
    }

    /**
     * 获取首选的AI模型
     */
    getPreferredModel() {
        return 'default';
    }

    /**
     * 分析简历内容
     * @param {string} resumeText - 简历文本内容
     * @param {Object} targetJob - 目标职位信息
     * @param {Object} analysisOptions - 分析选项
     * @returns {Promise<Object>} - 分析结果
     */
    async analyzeResume(resumeText, targetJob = null, analysisOptions = {}) {
        try {
            // 数据验证
            if (!resumeText || resumeText.trim().length === 0) {
                throw new Error('简历内容不能为空');
            }

            // 获取职位描述
            const jobDescription = targetJob ? (targetJob.description || targetJob.requirements || targetJob.title || '') : '';

            // 调用国内AI服务（已集成平台-模型关联和动态提示词）
            const result = await this.domesticAIService.analyzeResume(
                resumeText,
                jobDescription,
                analysisOptions.userCtx || null,
                analysisOptions.scene || null
            );

            if (!result.success) {
                throw new Error(result.error || 'AI分析失败');
            }

            // 解析和分析AI返回的结果
            return this.parseAIResponse(result.data, targetJob);

        } catch (error) {
            console.error('AI分析服务错误:', error);

            // 错误降级：返回基础分析结果
            return this.generateFallbackAnalysis(resumeText, targetJob, error);
        }
    }

    /**
     * 解析AI返回的结果
     */
    parseAIResponse(aiResponse, targetJob) {
        try {
            // 尝试提取JSON部分 (兼容数组 [ ] 和对象 { })
            const jsonMatch = aiResponse.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
            if (!jsonMatch) {
                throw new Error('无法从AI响应中提取JSON数据');
            }

            let parsedResult = JSON.parse(jsonMatch[0]);

            // 如果是数组（来自职位匹配分析模板），取第一个并转换格式
            if (Array.isArray(parsedResult)) {
                if (parsedResult.length === 0) {
                    throw new Error('AI返回了空的职位匹配结果');
                }
                const firstResult = parsedResult[0];
                parsedResult = {
                    overall_score: firstResult.match_score,
                    match_level: firstResult.match_level,
                    dimensions: firstResult.score_detail || {
                        core_skills: 0,
                        experience: 0,
                        projects: 0,
                        education: 0,
                        stability: 0
                    },
                    strengths: firstResult.reason ? [firstResult.reason] : [],
                    summary: firstResult.detailed_analysis,
                    missing_skills: firstResult.missing_skills || [],
                    suggestions: firstResult.optimization_advice ? [{
                        type: 'optimization',
                        priority: 'high',
                        title: '匹配优化建议',
                        description: firstResult.optimization_advice
                    }] : []
                };
            }

            // 确保有分数字段
            if (!parsedResult.overall_score) {
                parsedResult.overall_score = parsedResult.match_score || parsedResult.score || 60;
            }

            // 映射雷达图字段 (统一前端需要的字段名)
            const dimensionMappings = {
                skills: ['技能匹配', 'skills', 'skill_match', 'professional', 'core_skills', 'job_fit', '专业技能', '技能评分', '技能匹配', '技术能力', '业务能力', '技能匹配度', '专业素质'],
                experience: ['经验匹配', 'experience', 'experience_match', 'experience_fit', 'background', '工作经验', '经验契合', '经验评分', '履历背景', '项目经验', '行业经验', '工作背景'],
                project: ['项目履历匹配', 'project', 'project_match', 'project_fit', 'stability', 'work_stability', 'tenure', '稳定性', '离职风险', '职业稳定性', '项目背景', '履历匹配', '项目经验匹配', '项目实战', '项目表现', '项目履历', '工作稳定性'],
                education: ['学历背景', 'education', 'education_background', 'academic', '教育背景', '学历评分', '学术背景', '学校背景', '学历契合', '教育匹配'],
                potential: ['发展潜力', 'potential', 'growth_potential', 'development', 'learning_ability', '潜力评分', '成长性', '爆发力', '进取心', '学习能力', '职业潜力'],
                teamwork: ['团队协作', 'teamwork', 'collaboration', 'social', '协作能力', '团队精神', '沟通能力', '领导力', '组织协同力', '团队意识', '人际沟通']
            };

            const getVal = (source, keys) => {
                if (!source || typeof source !== 'object') return 0;
                const searchKeys = keys.map(k => k.toLowerCase());

                // 1. 处理数组结构 (competency_matrix)
                const items = Array.isArray(source) ? source : (source.competency_matrix || []);
                if (Array.isArray(items)) {
                    for (const item of items) {
                        const dimName = (item.dimension || item.name || '').toLowerCase();
                        if (searchKeys.some(k => dimName.includes(k))) {
                            return parseInt(item.score || item.value || 0);
                        }
                    }
                }

                // 2. 处理对象结构
                for (const key of keys) {
                    let val = source[key];
                    if (val === undefined || val === null) {
                        // 尝试模糊匹配键名
                        const foundKey = Object.keys(source).find(k => k.toLowerCase() === key.toLowerCase());
                        if (foundKey) val = source[foundKey];
                    }

                    if (val !== undefined && val !== null) {
                        const raw = typeof val === 'object' ? (val.score ?? val.value ?? val.rating ?? 0) : val;
                        return parseInt(raw) || 0;
                    }
                }

                // 3. 递归检查嵌套 dimensions
                if (source.dimensions && source.dimensions !== source) {
                    return getVal(source.dimensions, keys);
                }
                if (source.score_detail && source.score_detail !== source) {
                    return getVal(source.score_detail, keys);
                }

                return 0;
            };

            const src = parsedResult.scores_percent || parsedResult.dimensions || parsedResult.score_detail || parsedResult;
            parsedResult.radar_scores = {
                skills: getVal(src, dimensionMappings.skills),
                experience: getVal(src, dimensionMappings.experience),
                project: getVal(src, dimensionMappings.project),
                education: getVal(src, dimensionMappings.education),
                potential: getVal(src, dimensionMappings.potential),
                teamwork: getVal(src, dimensionMappings.teamwork)
            };

            // 兼容旧版前端字段名
            parsedResult.radar_scores.job_fit = parsedResult.radar_scores.skills;
            parsedResult.radar_scores.experience_fit = parsedResult.radar_scores.experience;
            parsedResult.radar_scores.learning_ability = parsedResult.radar_scores.potential;
            parsedResult.radar_scores.stability = parsedResult.radar_scores.project;

            // 重要：同步更新 dimensions 字段，确保存入数据库的是标准化后的维度分
            parsedResult.dimensions = { ...parsedResult.radar_scores };

            // 如果没有 radar_scores，提供默认值
            if (!parsedResult.radar_scores) {
                parsedResult.radar_scores = {
                    job_fit: 0,
                    experience_fit: 0,
                    learning_ability: 0,
                    teamwork: 0
                };
            }

            // 添加元数据
            return {
                ...parsedResult,
                overall_score: Number(parsedResult.overall_score),
                targetJob,
                analysisDate: new Date().toISOString(),
                rawResponse: aiResponse
            };

        } catch (error) {
            console.error('解析AI响应错误:', error);
            throw new Error(`AI响应解析失败: ${error.message}`);
        }
    }

    /**
     * 生成降级分析结果
     */
    generateFallbackAnalysis(resumeText, targetJob, error) {
        console.error('AI分析失败且无备用服务:', error.message);
        throw new Error(`AI分析服务暂时不可用: ${error.message}`);
    }

    /**
     * 批量分析简历
     * @param {Array} resumes - 简历数据数组
     * @param {Object} options - 分析选项
     * @returns {Promise<Array>} - 分析结果数组
     */
    async batchAnalyzeResumes(resumes, options = {}) {
        const results = [];
        const batchSize = 10;

        for (let i = 0; i < resumes.length; i += batchSize) {
            const batch = resumes.slice(i, i + batchSize);
            const batchPromises = batch.map(async (resume) => {
                try {
                    const analysis = await this.analyzeResume(
                        resume.content,
                        resume.targetJob,
                        options
                    );
                    return {
                        resumeId: resume.id,
                        success: true,
                        data: analysis
                    };
                } catch (error) {
                    console.error(`简历 ${resume.id} 分析失败:`, error);
                    return {
                        resumeId: resume.id,
                        success: false,
                        error: error.message
                    };
                }
            });

            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);

            if (i + batchSize < resumes.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        return results;
    }
}

module.exports = AIAnalysisService;