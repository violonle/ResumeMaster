/**
 * AI简历分析器模拟模块
 * 模拟AI分析过程，生成简历分析结果
 */

class AIResumeAnalyzer {
    constructor() {
        this.analysisSteps = [
            '正在解析文档结构...',
            '正在提取个人信息...',
            '正在分析工作经验...',
            '正在评估技能匹配度...',
            '正在计算综合评分...',
            '正在生成优化建议...',
            '分析完成，正在生成报告...'
        ];
        
        this.skillKeywords = {
            frontend: ['JavaScript', 'React', 'Vue', 'Angular', 'HTML', 'CSS', 'TypeScript', 'Webpack'],
            backend: ['Java', 'Python', 'Node.js', 'Spring', 'Django', 'MySQL', 'Redis', 'MongoDB'],
            mobile: ['Android', 'iOS', 'React Native', 'Flutter', 'Swift', 'Kotlin'],
            devops: ['Docker', 'Kubernetes', 'Jenkins', 'Git', 'Linux', 'AWS', 'Azure'],
            design: ['Photoshop', 'Sketch', 'Figma', 'UI/UX', 'Illustrator', 'Principle']
        };
        
        this.jobTitles = {
            frontend: ['前端开发工程师', 'Web开发工程师', 'JavaScript工程师', 'React开发工程师'],
            backend: ['后端开发工程师', 'Java工程师', 'Python工程师', 'Node.js工程师'],
            mobile: ['移动端开发工程师', 'Android工程师', 'iOS工程师', '跨平台开发工程师'],
            fullstack: ['全栈工程师', '软件工程师', '技术工程师'],
            design: ['UI设计师', 'UX设计师', '产品设计师', '视觉设计师']
        };
    }

    /**
     * 分析简历
     * @param {Object} resumeData - 简历数据
     * @param {Object} targetJob - 目标职位信息
     * @param {Function} progressCallback - 进度回调函数
     * @returns {Promise<Object>} - 分析结果
     */
    async analyzeResume(resumeData, targetJob = null, progressCallback = null) {
        try {
            if (resumeData && resumeData.content) {
                return await this.analyzeTextContent(resumeData.content, targetJob, progressCallback);
            } else if (resumeData && resumeData.file) {
                return await this.analyzeFile(resumeData.file, targetJob, progressCallback);
            } else if (resumeData && resumeData.resumeId) {
                return await this.analyzeExistingResume(resumeData.resumeId, targetJob, progressCallback);
            }
            throw new Error('缺少有效的简历数据，无法执行分析');
        } catch (error) {
            console.error('AI分析失败:', error);
            throw error;
        }
    }

    /**
     * 分析文本内容
     */
    async analyzeTextContent(content, targetJob = null, progressCallback = null) {
        // 显示进度
        if (progressCallback) {
            progressCallback({
                step: 1,
                total: 3,
                message: '正在调用AI分析服务...',
                progress: 33
            });
        }

        try {
            const response = await resumeDataManager.apiRequest('/ai/analyze', 'POST', {
                resumeText: content,
                jobDescription: targetJob ? JSON.stringify(targetJob) : null
            });

            if (response.success) {
                if (progressCallback) {
                    progressCallback({
                        step: 3,
                        total: 3,
                        message: 'AI分析完成',
                        progress: 100
                    });
                }
                return response.data;
            } else {
                throw new Error(response.error?.message || 'AI分析失败');
            }
        } catch (error) {
            console.error('文本AI分析失败:', error);
            throw error;
        }
    }

    /**
     * 分析文件
     */
    async analyzeFile(file, targetJob = null, progressCallback = null) {
        if (progressCallback) {
            progressCallback({
                step: 1,
                total: 3,
                message: '正在上传文件...',
                progress: 25
            });
        }

        try {
            // 创建FormData
            const formData = new FormData();
            formData.append('file', file);
            if (targetJob) {
                formData.append('targetJob', JSON.stringify(targetJob));
            }

            // 上传文件
            const response = await fetch(`${resumeDataManager.apiBaseUrl}/ai/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${resumeDataManager.token}`
                },
                body: formData
            });

            const uploadResult = await response.json();

            if (!uploadResult.success) {
                throw new Error(uploadResult.error?.message || '文件上传失败');
            }

            if (progressCallback) {
                progressCallback({
                    step: 2,
                    total: 3,
                    message: '正在分析简历...',
                    progress: 50
                });
            }

            // 调用AI分析
            const analysisResponse = await resumeDataManager.apiRequest('/ai/analyze', 'POST', {
                resumeId: uploadResult.data.resumeId,
                jobDescription: targetJob ? JSON.stringify(targetJob) : null
            });

            if (analysisResponse.success) {
                if (analysisResponse.status === 'processing') {
                    const data = await this.pollAnalysisResult(uploadResult.data.resumeId);
                    if (progressCallback) {
                        progressCallback({ step: 3, total: 3, message: 'AI分析完成', progress: 100 });
                    }
                    try { localStorage.setItem('last_analysis_result', JSON.stringify(data?.analysis || data)); } catch(_){}
                    return data;
                } else {
                    if (progressCallback) {
                        progressCallback({ step: 3, total: 3, message: 'AI分析完成', progress: 100 });
                    }
                    try { localStorage.setItem('last_analysis_result', JSON.stringify(analysisResponse.data?.analysis || analysisResponse.data)); } catch(_){}
                    return analysisResponse.data;
                }
            } else {
                throw new Error(analysisResponse.error?.message || 'AI分析失败');
            }

        } catch (error) {
            console.error('文件AI分析失败:', error);
            throw error;
        }
    }

    /**
     * 分析已有简历
     */
    async analyzeExistingResume(resumeId, targetJob = null, progressCallback = null) {
        if (progressCallback) {
            progressCallback({
                step: 1,
                total: 3,
                message: '正在获取简历内容...',
                progress: 33
            });
        }

        try {
            const response = await resumeDataManager.apiRequest('/ai/analyze', 'POST', {
                resumeId: resumeId,
                jobDescription: targetJob ? JSON.stringify(targetJob) : null
            });

            if (response.success) {
                if (response.status === 'processing') {
                    const data = await this.pollAnalysisResult(resumeId);
                    if (progressCallback) {
                        progressCallback({ step: 3, total: 3, message: 'AI分析完成', progress: 100 });
                    }
                    try { localStorage.setItem('last_analysis_result', JSON.stringify(data?.analysis || data)); } catch(_){}
                    return data;
                } else {
                    if (progressCallback) {
                        progressCallback({ step: 3, total: 3, message: 'AI分析完成', progress: 100 });
                    }
                    try { localStorage.setItem('last_analysis_result', JSON.stringify(response.data?.analysis || response.data)); } catch(_){}
                    return response.data;
                }
            } else {
                throw new Error(response.error?.message || 'AI分析失败');
            }
        } catch (error) {
            console.error('已有简历AI分析失败:', error);
            throw error;
        }
    }

    async pollAnalysisResult(resumeId) {
        let attempts = 0;
        const MAX_ATTEMPTS = 120;
        let delayMs = 2000;
        const MAX_DELAY_MS = 10000;
        while (attempts < MAX_ATTEMPTS) {
            attempts++;
            try {
                const statusRes = await resumeDataManager.apiRequest(`/ai/status/${resumeId}`, 'GET', null, false);
                if (statusRes && statusRes.success) {
                    const status = statusRes.data.status;
                    if (status === 'analyzed') {
                        const resultRes = await resumeDataManager.apiRequest(`/ai/result/${resumeId}`, 'GET', null, false);
                        if (resultRes && resultRes.success) {
                            return resultRes.data;
                        }
                    } else if (status === 'failed') {
                        throw new Error('分析失败');
                    } else {
                        if (attempts % 3 === 0) {
                            try {
                                const rr = await resumeDataManager.apiRequest(`/ai/result/${resumeId}`, 'GET', null, false);
                                if (rr && rr.success && rr.data) {
                                    return rr.data;
                                }
                            } catch (_) {}
                        }
                    }
                }
            } catch (e) {
                if (e.message && e.message.includes('分析失败')) throw e;
            }
            await new Promise(resolve => setTimeout(resolve, delayMs));
            delayMs = Math.min(MAX_DELAY_MS, Math.round(delayMs * 1.3));
        }
        throw new Error('分析超时，请稍后在历史记录中查看');
    }
    /**
     * 降级模拟分析
     */
    async analyzeWithMockData(resumeData, targetJob = null, progressCallback = null) {
        // 模拟分析过程
        for (let i = 0; i < this.analysisSteps.length; i++) {
            if (progressCallback) {
                progressCallback({
                    step: i + 1,
                    total: this.analysisSteps.length,
                    message: this.analysisSteps[i],
                    progress: Math.round(((i + 1) / this.analysisSteps.length) * 100)
                });
            }
            
            // 模拟处理时间
            await this.delay(800 + Math.random() * 1200);
        }
        
        // 解析简历内容
        const parsedData = this.parseResumeContent(resumeData);
        
        // 生成分析结果
        const analysisResult = this.generateAnalysisResult(parsedData, targetJob);
        try { localStorage.setItem('last_analysis_result', JSON.stringify(analysisResult)); } catch(_){}
        
        return analysisResult;
    }

    /**
     * 解析简历内容
     * @param {Object} resumeData - 简历数据
     * @returns {Object} - 解析后的数据
     */
    parseResumeContent(resumeData) {
        // 模拟从文件内容中提取信息
        const mockData = this.generateMockResumeData(resumeData.fileName);
        
        return {
            personalInfo: mockData.personalInfo,
            education: mockData.education,
            workExperience: mockData.workExperience,
            skills: mockData.skills,
            projects: mockData.projects,
            certifications: mockData.certifications,
            languages: mockData.languages
        };
    }

    /**
     * 生成分析结果
     * @param {Object} parsedData - 解析后的数据
     * @param {Object} targetJob - 目标职位
     * @returns {Object} - 分析结果
     */
    generateAnalysisResult(parsedData, targetJob) {
        const dimensions = this.calculateDimensions(parsedData, targetJob);
        const overallScore = this.calculateOverallScore(dimensions);
        const suggestions = this.generateSuggestions(parsedData, dimensions, targetJob);
        const strengths = this.identifyStrengths(parsedData, dimensions);
        const weaknesses = this.identifyWeaknesses(parsedData, dimensions);
        
        return {
            overallScore,
            dimensions,
            suggestions,
            strengths,
            weaknesses,
            targetJob,
            detailedAnalysis: {
                skillAnalysis: this.analyzeSkills(parsedData.skills, targetJob),
                experienceAnalysis: this.analyzeExperience(parsedData.workExperience, targetJob),
                educationAnalysis: this.analyzeEducation(parsedData.education, targetJob),
                projectAnalysis: this.analyzeProjects(parsedData.projects, targetJob)
            },
            parsedData
        };
    }

    /**
     * 计算各维度评分
     * @param {Object} parsedData - 解析后的数据
     * @param {Object} targetJob - 目标职位
     * @returns {Object} - 各维度评分
     */
    calculateDimensions(parsedData, targetJob) {
        const baseScore = 70 + Math.random() * 20; // 基础分数70-90
        
        return {
            basicMatch: Math.round(baseScore + Math.random() * 10 - 5), // 基础匹配度
            experienceRelevance: Math.round(baseScore + Math.random() * 15 - 7), // 经验相关度
            skillMatch: Math.round(baseScore + Math.random() * 12 - 6), // 技能匹配度
            learningAbility: Math.round(baseScore + Math.random() * 8 - 4), // 学习能力
            developmentPotential: Math.round(baseScore + Math.random() * 10 - 5), // 发展潜力
            teamwork: Math.round(baseScore + Math.random() * 6 - 3) // 团队合作
        };
    }

    /**
     * 计算综合评分
     * @param {Object} dimensions - 各维度评分
     * @returns {number} - 综合评分
     */
    calculateOverallScore(dimensions) {
        const weights = {
            basicMatch: 0.25,
            experienceRelevance: 0.20,
            skillMatch: 0.20,
            learningAbility: 0.15,
            developmentPotential: 0.12,
            teamwork: 0.08
        };
        
        let weightedSum = 0;
        for (const [dimension, score] of Object.entries(dimensions)) {
            weightedSum += score * (weights[dimension] || 0);
        }
        
        return Math.round(weightedSum);
    }

    /**
     * 生成优化建议
     * @param {Object} parsedData - 解析后的数据
     * @param {Object} dimensions - 各维度评分
     * @param {Object} targetJob - 目标职位
     * @returns {Array} - 建议列表
     */
    generateSuggestions(parsedData, dimensions, targetJob) {
        const suggestions = [];
        
        // 基于评分生成建议
        if (dimensions.skillMatch < 80) {
            suggestions.push({
                type: 'skill',
                priority: 'high',
                title: '技能提升建议',
                description: '建议加强与目标职位相关的核心技能，可以通过在线课程或实际项目来提升。',
                actionItems: [
                    '学习行业热门技术栈',
                    '参与开源项目贡献代码',
                    '获得相关技术认证'
                ]
            });
        }
        
        if (dimensions.experienceRelevance < 75) {
            suggestions.push({
                type: 'experience',
                priority: 'high',
                title: '经验优化建议',
                description: '建议在简历中更突出与目标职位相关的工作经验和项目成果。',
                actionItems: [
                    '量化工作成果和项目影响',
                    '突出相关技术栈使用经验',
                    '补充行业背景说明'
                ]
            });
        }
        
        if (dimensions.learningAbility < 78) {
            suggestions.push({
                type: 'learning',
                priority: 'medium',
                title: '学习能力展示',
                description: '建议在简历中展示持续学习和自我提升的能力。',
                actionItems: [
                    '添加最新学习的技术或课程',
                    '展示技术博客或分享经历',
                    '参与技术社区活动'
                ]
            });
        }
        
        // 通用建议
        suggestions.push({
            type: 'format',
            priority: 'low',
            title: '简历格式优化',
            description: '优化简历的整体结构和视觉呈现，提高可读性。',
            actionItems: [
                '使用清晰的章节结构',
                '保持一致的格式风格',
                '控制简历长度在2页以内'
            ]
        });
        
        return suggestions;
    }

    /**
     * 识别优势
     * @param {Object} parsedData - 解析后的数据
     * @param {Object} dimensions - 各维度评分
     * @returns {Array} - 优势列表
     */
    identifyStrengths(parsedData, dimensions) {
        const strengths = [];
        
        // 基于评分识别优势
        Object.entries(dimensions).forEach(([dimension, score]) => {
            if (score >= 85) {
                const strengthMap = {
                    basicMatch: '基础条件匹配度高，符合职位基本要求',
                    experienceRelevance: '工作经验与目标职位高度相关',
                    skillMatch: '技能栈与职位需求匹配度优秀',
                    learningAbility: '展现出强烈的学习意愿和能力',
                    developmentPotential: '具备良好的职业发展潜力',
                    teamwork: '团队协作能力突出'
                };
                
                if (strengthMap[dimension]) {
                    strengths.push(strengthMap[dimension]);
                }
            }
        });
        
        // 基于技能数量
        if (parsedData.skills && parsedData.skills.length > 8) {
            strengths.push('技能覆盖面广，具备多元化技术能力');
        }
        
        // 基于工作经验
        if (parsedData.workExperience && parsedData.workExperience.length > 2) {
            strengths.push('工作经验丰富，具备多样化项目背景');
        }
        
        return strengths.slice(0, 5); // 最多返回5个优势
    }

    /**
     * 识别不足
     * @param {Object} parsedData - 解析后的数据
     * @param {Object} dimensions - 各维度评分
     * @returns {Array} - 不足列表
     */
    identifyWeaknesses(parsedData, dimensions) {
        const weaknesses = [];
        
        // 基于评分识别不足
        Object.entries(dimensions).forEach(([dimension, score]) => {
            if (score < 75) {
                const weaknessMap = {
                    basicMatch: '基础条件与职位要求存在一定差距',
                    experienceRelevance: '相关工作经验有待加强',
                    skillMatch: '核心技能需要进一步提升',
                    learningAbility: '学习能力展示不够充分',
                    developmentPotential: '发展潜力需要更好地体现',
                    teamwork: '团队协作经验可以更丰富'
                };
                
                if (weaknessMap[dimension]) {
                    weaknesses.push(weaknessMap[dimension]);
                }
            }
        });
        
        return weaknesses.slice(0, 3); // 最多返回3个不足
    }

    /**
     * 分析技能
     * @param {Array} skills - 技能列表
     * @param {Object} targetJob - 目标职位
     * @returns {Object} - 技能分析结果
     */
    analyzeSkills(skills, targetJob) {
        const analysis = {
            totalSkills: skills ? skills.length : 0,
            relevantSkills: [],
            missingSkills: [],
            skillCategories: {}
        };
        
        if (skills) {
            // 分类技能
            Object.entries(this.skillKeywords).forEach(([category, keywords]) => {
                const categorySkills = skills.filter(skill => 
                    keywords.some(keyword => 
                        skill.toLowerCase().includes(keyword.toLowerCase())
                    )
                );
                
                if (categorySkills.length > 0) {
                    analysis.skillCategories[category] = categorySkills;
                }
            });
            
            // 模拟相关技能识别
            analysis.relevantSkills = skills.slice(0, Math.min(5, skills.length));
        }
        
        // 模拟缺失技能
        analysis.missingSkills = ['Docker', 'Kubernetes', 'TypeScript', 'GraphQL'].slice(0, 2);
        
        return analysis;
    }

    /**
     * 分析工作经验
     * @param {Array} workExperience - 工作经验
     * @param {Object} targetJob - 目标职位
     * @returns {Object} - 经验分析结果
     */
    analyzeExperience(workExperience, targetJob) {
        const analysis = {
            totalYears: 0,
            relevantYears: 0,
            companyTypes: [],
            industryMatch: false,
            careerProgression: 'stable'
        };
        
        if (workExperience && workExperience.length > 0) {
            analysis.totalYears = workExperience.length * 1.5; // 模拟计算
            analysis.relevantYears = analysis.totalYears * 0.8;
            analysis.companyTypes = ['互联网公司', '科技企业'];
            analysis.industryMatch = Math.random() > 0.3;
            analysis.careerProgression = ['ascending', 'stable', 'diverse'][Math.floor(Math.random() * 3)];
        }
        
        return analysis;
    }

    /**
     * 分析教育背景
     * @param {Array} education - 教育背景
     * @param {Object} targetJob - 目标职位
     * @returns {Object} - 教育分析结果
     */
    analyzeEducation(education, targetJob) {
        const analysis = {
            highestDegree: '本科',
            relevantMajor: true,
            prestigiousSchool: Math.random() > 0.6,
            additionalCertifications: Math.floor(Math.random() * 3)
        };
        
        return analysis;
    }

    /**
     * 分析项目经验
     * @param {Array} projects - 项目列表
     * @param {Object} targetJob - 目标职位
     * @returns {Object} - 项目分析结果
     */
    analyzeProjects(projects, targetJob) {
        const analysis = {
            totalProjects: projects ? projects.length : Math.floor(Math.random() * 5) + 2,
            relevantProjects: 0,
            projectComplexity: 'medium',
            technicalDepth: 'good'
        };
        
        if (projects) {
            analysis.relevantProjects = Math.floor(projects.length * 0.7);
        } else {
            analysis.relevantProjects = Math.floor(analysis.totalProjects * 0.7);
        }
        
        return analysis;
    }

    /**
     * 生成模拟简历数据
     * @param {string} fileName - 文件名
     * @returns {Object} - 模拟数据
     */
    generateMockResumeData(fileName) {
        const names = ['张三', '李四', '王五', '赵六', '钱七'];
        const name = names[Math.floor(Math.random() * names.length)];
        
        return {
            personalInfo: {
                name: name,
                email: `${name.toLowerCase()}@example.com`,
                phone: '138****8888',
                location: '北京市'
            },
            education: [
                {
                    school: '北京理工大学',
                    degree: '本科',
                    major: '计算机科学与技术',
                    graduationYear: '2020'
                }
            ],
            workExperience: [
                {
                    company: '阿里巴巴',
                    position: '前端开发工程师',
                    duration: '2020.07 - 2023.03',
                    description: '负责电商平台前端开发，使用React技术栈'
                },
                {
                    company: '腾讯',
                    position: '高级前端工程师',
                    duration: '2023.04 - 至今',
                    description: '负责微信小程序开发和维护'
                }
            ],
            skills: [
                'JavaScript', 'React', 'Vue.js', 'Node.js', 'TypeScript',
                'HTML5', 'CSS3', 'Webpack', 'Git', 'MySQL'
            ],
            projects: [
                {
                    name: '电商管理系统',
                    description: '基于React的电商后台管理系统',
                    technologies: ['React', 'Ant Design', 'Redux']
                },
                {
                    name: '移动端H5应用',
                    description: '响应式移动端商城应用',
                    technologies: ['Vue.js', 'Vant', 'Axios']
                }
            ],
            certifications: ['PMP项目管理认证'],
            languages: ['中文(母语)', '英语(CET-6)']
        };
    }

    /**
     * 延迟函数
     * @param {number} ms - 延迟毫秒数
     * @returns {Promise} - Promise对象
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 获取AI服务状态
     */
    async getAIStatus() {
        try {
            const response = await resumeDataManager.apiRequest('/ai/status', 'GET');
            return response.success ? response.data : null;
        } catch (error) {
            console.error('获取AI服务状态失败:', error);
            return null;
        }
    }

    /**
     * 批量分析简历
     */
    async batchAnalyze(resumeIds, progressCallback = null) {
        try {
            if (progressCallback) {
                progressCallback({
                    step: 1,
                    total: 3,
                    message: '正在启动批量分析...',
                    progress: 33
                });
            }

            const response = await resumeDataManager.apiRequest('/ai/batch-analyze', 'POST', {
                resumeIds: resumeIds
            });

            if (response.success) {
                if (progressCallback) {
                    progressCallback({
                        step: 3,
                        total: 3,
                        message: '批量分析完成',
                        progress: 100
                    });
                }
                try {
                    const results = response.data?.results || response.data;
                    const people = Array.isArray(results) ? results.map(r => ({
                        name: (r.basic_info?.name) || (r.parsedData?.personalInfo?.name) || '候选人',
                        scores_star: r.scores_star || {},
                        scores_percent: r.scores_percent || {}
                    })) : (results.people || []);
                    localStorage.setItem('compare_analysis_results', JSON.stringify({ people }));
                } catch(_){}
                return response.data;
            } else {
                throw new Error(response.error?.message || '批量分析失败');
            }
        } catch (error) {
            console.error('批量分析失败:', error);
            throw error;
        }
    }
}

// 创建全局实例
window.aiAnalyzer = new AIResumeAnalyzer();
