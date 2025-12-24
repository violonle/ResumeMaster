/**
 * 简历数据管理模块
 * 负责简历数据的存储、检索和管理（通过API调用）
 */

class ResumeDataManager {
    constructor() {
        const ua = (window.userAuthInstance && window.userAuthInstance.apiBaseUrl) ? window.userAuthInstance.apiBaseUrl : null;
        this.apiBaseUrl = ua || '/api';
        this.token = null;
        this.mockData = {
            resumes: [
                { id: 'mock-1', file_name: '示例简历_张三_Java高级工程师.pdf', upload_date: new Date().toISOString(), status: 'analyzed', tags: ['Java', 'Spring Boot', '微服务'] },
                { id: 'mock-2', file_name: '示例简历_李四_产品经理.pdf', upload_date: new Date(Date.now() - 86400000).toISOString(), status: 'pending', tags: ['产品设计', 'Axure', '需求分析'] },
                { id: 'mock-3', file_name: '示例简历_王五_前端开发.docx', upload_date: new Date(Date.now() - 172800000).toISOString(), status: 'analyzed', tags: ['Vue', 'React', 'JavaScript'] }
            ],
            analyses: [
                { resume_id: 'mock-1', overall_score: 88, dimensions: { experience: 90, education: 85, skills: 88, potential: 85, match: 90 }, suggestions: ['项目经验描述具体', '技能关键词突出'], strengths: ['技术栈全面', '经验丰富'], weaknesses: ['管理经验较少'] },
                { resume_id: 'mock-3', overall_score: 82, dimensions: { experience: 80, education: 85, skills: 85, potential: 80, match: 80 }, suggestions: ['补充开源项目经历'], strengths: ['基础扎实'], weaknesses: ['缺乏大型项目经验'] }
            ],
            jobs: [
                { id: 'job-1', title: '高级Java开发工程师', department: '研发部', location: '北京', type: '全职', status: 'published', created_at: new Date().toISOString() },
                { id: 'job-2', title: '资深产品经理', department: '产品部', location: '上海', type: '全职', status: 'published', created_at: new Date().toISOString() }
            ],
            pipeline: [
                { id: 'p-1', job_id: 'job-1', resume_id: 'mock-1', status: 'interview', candidate_name: '张三', job_title: '高级Java开发工程师', applied_at: new Date().toISOString() },
                { id: 'p-2', job_id: 'job-2', resume_id: 'mock-2', status: 'screening', candidate_name: '李四', job_title: '资深产品经理', applied_at: new Date().toISOString() }
            ]
        };
        this.init();
    }

    /**
     * 初始化数据管理器
     */
    init() {
        // 从localStorage获取认证令牌
        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        if (userInfo.token) {
            this.token = userInfo.token;
        }
        this.applyUserMockData();
    }

    /**
     * 设置认证令牌
     * @param {string} token - JWT令牌
     */
    setToken(token) {
        this.token = token;
    }

    /**
     * 发送API请求
     * @param {string} endpoint - API端点
     * @param {string} method - HTTP方法
     * @param {Object} data - 请求数据
     * @param {boolean} showLoading - 是否显示加载状态
     * @returns {Promise} - API响应
     */
    async apiRequest(endpoint, method = 'GET', data = null, showLoading = true) {
        if (showLoading && typeof ErrorHandler !== 'undefined') {
            ErrorHandler.showLoading(true);
        }

        const isForm = (data && typeof FormData !== 'undefined' && data instanceof FormData);
        const headers = isForm ? {} : { 'Content-Type': 'application/json' };
        const lsToken = (function () { try { return (JSON.parse(localStorage.getItem('userInfo') || '{}').token) || null } catch (_) { return null } })();
        const uaToken = (typeof userAuthInstance !== 'undefined' && typeof userAuthInstance.getToken === 'function') ? (userAuthInstance.getToken() || null) : null;
        const token = uaToken || this.token || lsToken;
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const options = { method, headers };
        if (data) options.body = isForm ? data : JSON.stringify(data);

        const tryRequest = async (base) => {
            const response = await fetch(`${base}${endpoint}`, options);
            const result = await response.json();
            if (response.status === 401) {
                try { window.dispatchEvent(new CustomEvent('apiUnauthorized', { detail: { source: 'resume-data', endpoint } })); } catch (_) { }
                const err = new Error('Unauthorized');
                err.status = 401;
                throw err;
            }
            if (!response.ok) {
                const msg = (result && result.error && result.error.message)
                    ? result.error.message
                    : (typeof (result && result.error) === 'string' ? result.error : '请求失败');
                const err = new Error(msg);
                err.status = response.status;
                throw err;
            }
            return result;
        };

        const bases = [];
        const primary = this.apiBaseUrl;
        bases.push(primary);
        if (!bases.includes('http://localhost:3000/api')) bases.push('http://localhost:3000/api');
        if (primary !== '/api') bases.push('/api');

        let lastError;
        for (const b of bases) {
            try {
                const res = await tryRequest(b);
                this.apiBaseUrl = b;
                if (showLoading && typeof ErrorHandler !== 'undefined') { ErrorHandler.showLoading(false); }
                return res;
            } catch (e) {
                lastError = e;
                if (e && e.status === 401) { break; }
                continue;
            }
        }
        if (showLoading && typeof ErrorHandler !== 'undefined') { ErrorHandler.showLoading(false); }
        console.error('API请求失败:', lastError);
        if (typeof ErrorHandler !== 'undefined') { ErrorHandler.showError(lastError && lastError.message ? lastError.message : '请求失败，请稍后重试'); }
        throw lastError;
    }

    /**
     * 保存简历数据
     * @param {Object} resumeData - 简历数据对象
     * @returns {Promise<string>} - 返回生成的简历ID
     */
    async saveResume(resumeData) {
        try {
            const result = await this.apiRequest('/resumes', 'POST', {
                file_name: resumeData.fileName,
                file_size: resumeData.fileSize,
                file_type: resumeData.fileType,
                parsed_data: resumeData.parsedData || {},
                tags: this.extractTags(resumeData.parsedData)
            });

            return result.data.id;
        } catch (error) {
            console.error('保存简历失败:', error);
            throw error;
        }
    }

    /**
     * 保存分析结果
     * @param {string} resumeId - 简历ID
     * @param {Object} analysisResult - 分析结果
     * @returns {Promise<Object>} - 保存的分析结果
     */
    async saveAnalysisResult(resumeId, analysisResult) {
        try {
            const result = await this.apiRequest('/analysis', 'POST', {
                resume_id: resumeId,
                overall_score: analysisResult.overallScore || 0,
                dimensions: analysisResult.dimensions || {},
                suggestions: analysisResult.suggestions || [],
                strengths: analysisResult.strengths || [],
                weaknesses: analysisResult.weaknesses || [],
                target_job: analysisResult.targetJob || null,
                detailed_analysis: analysisResult.detailedAnalysis || {}
            });

            // 更新简历状态
            await this.updateResumeStatus(resumeId, 'analyzed');

            return result.data;
        } catch (error) {
            console.error('保存分析结果失败:', error);
            throw error;
        }
    }

    /**
     * 获取所有简历
     * @returns {Promise<Array>} - 简历数组
     */
    async getAllResumes() {
        try {
            const result = await this.apiRequest('/resumes');
            return result.data;
        } catch (error) {
            console.warn('获取简历列表失败，使用模拟数据:', error);
            return this.mockData.resumes;
        }
    }

    async getTalentPoolResumes() {
        try {
            const result = await this.apiRequest('/library/resumes');
            return result.data;
        } catch (error) {
            console.warn('获取人才库简历失败，使用模拟数据:', error);
            return this.mockData.resumes;
        }
    }

    /**
     * 获取所有分析结果
     * @returns {Promise<Array>} - 分析结果数组
     */
    async getAllAnalyses() {
        try {
            const result = await this.apiRequest('/analysis');
            return result.data;
        } catch (error) {
            console.warn('获取分析结果失败，使用模拟数据:', error);
            return this.mockData.analyses;
        }
    }

    /**
     * 获取招聘流程数据
     * @param {string} jobId - 职位ID (可选)
     * @param {string} status - 状态 (可选)
     * @returns {Promise<Array>} - 流程数据
     */
    async getRecruitmentPipeline(jobId = null, status = null) {
        try {
            const params = new URLSearchParams();
            if (jobId) params.append('jobId', jobId);
            if (status) params.append('status', status);
            
            const result = await this.apiRequest(`/recruitment/pipeline?${params.toString()}`);
            return result.data;
        } catch (error) {
            console.warn('获取招聘流程失败，使用模拟数据:', error);
            let data = this.mockData.pipeline;
            if (jobId) data = data.filter(item => item.job_id === jobId);
            if (status) data = data.filter(item => item.status === status);
            return data;
        }
    }

    /**
     * 更新招聘状态
     * @param {string} id - 记录ID
     * @param {string} status - 新状态
     * @param {string} notes - 备注 (可选)
     * @returns {Promise<Object>} - 更新结果
     */
    async updateRecruitmentStatus(id, status, notes = null) {
        try {
            const data = { status };
            if (notes) data.notes = notes;
            const result = await this.apiRequest(`/recruitment/${id}/status`, 'POST', data);
            return result.data;
        } catch (error) {
            console.error('更新招聘状态失败:', error);
            throw error;
        }
    }

    /**
     * 安排面试
     * @param {string} id - 记录ID
     * @param {Object} interviewData - 面试数据 {datetime, channel, location, note}
     * @returns {Promise<Object>} - 结果
     */
    async scheduleInterview(id, interviewData) {
        try {
            const result = await this.apiRequest(`/recruitment/${id}/interview`, 'POST', interviewData);
            return result.data;
        } catch (error) {
            console.error('安排面试失败:', error);
            throw error;
        }
    }

    /**
     * 发送Offer
     * @param {string} id - 记录ID
     * @param {Object} offerData - Offer数据 {phone, email, message}
     * @returns {Promise<Object>} - 结果
     */
    async sendOffer(id, offerData) {
        try {
            const result = await this.apiRequest(`/recruitment/${id}/offer`, 'POST', offerData);
            return result.data;
        } catch (error) {
            console.error('发送Offer失败:', error);
            throw error;
        }
    }

    /**
     * 获取所有职位
     * @returns {Promise<Array>} - 职位数组
     */
    async getAllJobs() {
        try {
            const result = await this.apiRequest('/jobs');
            return result.data;
        } catch (error) {
            console.warn('获取职位列表失败，使用模拟数据:', error);
            return this.mockData.jobs;
        }
    }

    /**
     * 根据ID获取简历
     * @param {string} resumeId - 简历ID
     * @returns {Promise<Object|null>} - 简历对象或null
     */
    async getResumeById(resumeId) {
        try {
            const result = await this.apiRequest(`/resumes/${resumeId}`);
            return result.data;
        } catch (error) {
            if (error.message.includes('不存在')) {
                return null;
            }
            console.warn('获取简历失败，使用模拟数据:', error);
            const resume = this.mockData.resumes.find(r => r.id === resumeId);
            if (!resume) return null;
            return resume;
        }
    }

    /**
     * 根据简历ID获取分析结果
     * @param {string} resumeId - 简历ID
     * @returns {Promise<Array>} - 该简历的所有分析结果
     */
    async getAnalysesByResumeId(resumeId) {
        try {
            const result = await this.apiRequest(`/analysis/resume/${resumeId}`);
            return result.data;
        } catch (error) {
            console.warn('获取简历分析结果失败，使用模拟数据:', error);
            return this.mockData.analyses.filter(a => a.resume_id === resumeId);
        }
    }

    /**
     * 获取最新的分析结果
     * @param {string} resumeId - 简历ID
     * @returns {Promise<Object|null>} - 最新分析结果或null
     */
    async getLatestAnalysis(resumeId) {
        try {
            const result = await this.apiRequest(`/analysis/latest/${resumeId}`);
            return result.data;
        } catch (error) {
            console.warn('获取最新分析结果失败，使用模拟数据:', error);
            const analyses = this.mockData.analyses.filter(a => a.resume_id === resumeId);
            return analyses.length > 0 ? analyses[0] : null;
        }
    }

    /**
     * 删除简历
     * @param {string} resumeId - 简历ID
     * @returns {Promise<boolean>} - 删除是否成功
     */
    async deleteResume(resumeId) {
        try {
            await this.apiRequest(`/resumes/${resumeId}`, 'DELETE');
            return true;
        } catch (error) {
            if (error.message.includes('不存在')) {
                return false;
            }
            console.error('删除简历失败:', error);
            throw error;
        }
    }

    /**
     * 更新简历状态
     * @param {string} resumeId - 简历ID
     * @param {string} status - 新状态
     * @returns {Promise<boolean>} - 更新是否成功
     */
    async updateResumeStatus(resumeId, status) {
        try {
            const resume = await this.getResumeById(resumeId);
            if (!resume) {
                return false;
            }

            await this.apiRequest(`/resumes/${resumeId}`, 'PUT', {
                ...resume,
                status: status
            });

            return true;
        } catch (error) {
            console.error('更新简历状态失败:', error);
            throw error;
        }
    }

    /**
     * 获取仪表盘统计数据
     * @returns {Promise<Object>}
     */
    async getDashboardStats() {
        try {
            const result = await this.apiRequest('/dashboard/stats');
            return result.data;
        } catch (error) {
            console.warn('获取仪表盘统计失败，使用模拟数据:', error);
            // Calculate from mock data
            const jobs = this.mockData.jobs || [];
            const pipeline = this.mockData.pipeline || [];
            const resumes = this.mockData.resumes || [];
            
            return {
                total_candidates: resumes.length,
                new_candidates_today: resumes.filter(r => new Date(r.upload_date) > new Date(Date.now() - 86400000)).length,
                active_jobs: jobs.filter(j => j.status === 'published').length,
                interviews_scheduled: pipeline.filter(p => p.status === 'interview').length,
                offers_sent: pipeline.filter(p => p.status === 'offer').length
            };
        }
    }

    /**
     * 获取待办事项
     * @returns {Promise<Array>}
     */
    async getPendingTasks() {
        try {
             const result = await this.apiRequest('/dashboard/tasks');
             return result.data;
        } catch (error) {
            console.warn('获取待办事项失败，使用模拟数据');
            return [
                { type: 'review', title: '待筛选简历', count: 5, priority: 'high', link: 'resume-management.html?status=pending' },
                { type: 'interview', title: '今日面试', count: 2, priority: 'high', link: 'recruitment-flow.html' },
                { type: 'offer', title: '待审批Offer', count: 1, priority: 'medium', link: 'recruitment-flow.html' },
                { type: 'parsing', title: '简历解析任务', count: 0, priority: 'low', link: 'resume-upload-pc.html' }
            ];
        }
    }

    async getAIPrediction(period = '7d') {
        try {
            const params = new URLSearchParams();
            params.append('period', period);
            const result = await this.apiRequest(`/dashboard/ai-prediction?${params.toString()}`);
            return result.data;
        } catch (error) {
            const pipeline = this.mockData.pipeline || [];
            const counts = {
                applied: pipeline.filter(p => p.status === 'applied').length,
                screening: pipeline.filter(p => p.status === 'screening').length,
                interview: pipeline.filter(p => p.status === 'interview').length,
                offer: pipeline.filter(p => p.status === 'offer').length,
                hired: pipeline.filter(p => p.status === 'hired').length
            };
            const rates = { appliedToInterview: 0.4, interviewToOffer: 0.35, offerToHire: 0.7 };
            const forecast = {
                interview: Math.max(0, Math.round((counts.applied + counts.screening) * rates.appliedToInterview)),
                offer: Math.max(0, Math.round(counts.interview * rates.interviewToOffer)),
                hired: Math.max(0, Math.round(counts.offer * rates.offerToHire))
            };
            return {
                period,
                forecast,
                conversionRates: rates,
                topFactors: [
                    { name: 'JD匹配度', impact: '+12%' },
                    { name: '候选人响应速度', impact: '+8%' },
                    { name: '面试安排效率', impact: '+6%' }
                ],
                recommendations: [
                    '优先跟进高匹配度候选人面试',
                    '简化Offer审批流程提升转化',
                    '对响应慢的候选人进行提醒'
                ]
            };
        }
    }

    applyUserMockData() {
        let phone = null;
        try {
            const raw = localStorage.getItem('userInfo') || '{}';
            const obj = JSON.parse(raw);
            const u = obj.user || obj;
            phone = u.phone || null;
        } catch (_) {}
        if (phone === '18605355138') {
            const now = Date.now();
            const d = (n) => new Date(now - n).toISOString();
            this.mockData = {
                resumes: [
                    { id: 'u1860-r1', file_name: '简历_张三_Java工程师.pdf', upload_date: d(2*86400000), status: 'analyzed', tags: ['Java','Spring','微服务'] },
                    { id: 'u1860-r2', file_name: '简历_李四_产品经理.pdf', upload_date: d(1*86400000), status: 'pending', tags: ['产品','需求','Axure'] },
                    { id: 'u1860-r3', file_name: '简历_王五_前端开发.docx', upload_date: d(3*86400000), status: 'analyzed', tags: ['React','TypeScript','UI'] },
                    { id: 'u1860-r4', file_name: '简历_赵六_测试工程师.pdf', upload_date: d(5*86400000), status: 'pending', tags: ['自动化','JUnit','Playwright'] },
                    { id: 'u1860-r5', file_name: '简历_钱七_数据分析师.pdf', upload_date: d(6*86400000), status: 'analyzed', tags: ['Python','SQL','可视化'] }
                ],
                analyses: [
                    { resume_id: 'u1860-r1', overall_score: 86, dimensions: { experience: 88, education: 82, skills: 87, potential: 80, match: 85 }, suggestions: ['补充性能调优案例'], strengths: ['后端经验丰富'], weaknesses: ['英文学术写作弱'] },
                    { resume_id: 'u1860-r3', overall_score: 81, dimensions: { experience: 78, education: 85, skills: 84, potential: 80, match: 82 }, suggestions: ['增加可复用组件案例'], strengths: ['工程化能力好'], weaknesses: ['大型项目经验少'] },
                    { resume_id: 'u1860-r5', overall_score: 79, dimensions: { experience: 75, education: 88, skills: 80, potential: 78, match: 77 }, suggestions: ['完善AB测试经历'], strengths: ['统计基础扎实'], weaknesses: ['业务落地经验一般'] }
                ],
                jobs: [
                    { id: 'u1860-j1', title: '高级Java开发工程师', department: '技术部', location: '北京', type: '全职', status: 'published', created_at: d(7*86400000) },
                    { id: 'u1860-j2', title: '前端开发工程师', department: '技术部', location: '上海', type: '全职', status: 'published', created_at: d(4*86400000) },
                    { id: 'u1860-j3', title: '产品经理', department: '产品部', location: '广州', type: '全职', status: 'published', created_at: d(2*86400000) }
                ],
                pipeline: [
                    { id: 'u1860-p1', job_id: 'u1860-j1', resume_id: 'u1860-r1', status: 'interview', candidate_name: '张三', job_title: '高级Java开发工程师', applied_at: d(6*86400000) },
                    { id: 'u1860-p2', job_id: 'u1860-j3', resume_id: 'u1860-r2', status: 'screening', candidate_name: '李四', job_title: '产品经理', applied_at: d(3*86400000) },
                    { id: 'u1860-p3', job_id: 'u1860-j2', resume_id: 'u1860-r3', status: 'offer', candidate_name: '王五', job_title: '前端开发工程师', applied_at: d(5*86400000) },
                    { id: 'u1860-p4', job_id: 'u1860-j1', resume_id: 'u1860-r4', status: 'applied', candidate_name: '赵六', job_title: '高级Java开发工程师', applied_at: d(1*86400000) },
                    { id: 'u1860-p5', job_id: 'u1860-j2', resume_id: 'u1860-r5', status: 'hired', candidate_name: '钱七', job_title: '前端开发工程师', applied_at: d(8*86400000) }
                ]
            };
        }
    }

    /**
     * 获取统计数据
     * @returns {Promise<Object>} - 统计信息
     */
    async getStatistics() {
        try {
            const [resumes, analyses, jobs] = await Promise.all([
                this.getAllResumes(),
                this.getAllAnalyses(),
                this.getAllJobs()
            ]);

            const stats = {
                totalResumes: resumes.length,
                analyzedResumes: resumes.filter(r => r.status === 'analyzed').length,
                totalJobs: jobs.length,
                totalAnalyses: analyses.length,
                averageScore: 0,
                excellentResumes: 0,
                goodResumes: 0,
                averageResumes: 0,
                poorResumes: 0
            };

            if (analyses.length > 0) {
                const totalScore = analyses.reduce((sum, analysis) => sum + analysis.overall_score, 0);
                stats.averageScore = Math.round(totalScore / analyses.length);

                // 按分数分类
                analyses.forEach(analysis => {
                    const score = analysis.overall_score;
                    if (score >= 90) stats.excellentResumes++;
                    else if (score >= 80) stats.goodResumes++;
                    else if (score >= 70) stats.averageResumes++;
                    else stats.poorResumes++;
                });
            }

            return stats;
        } catch (error) {
            console.error('获取统计数据失败:', error);
            // 如果出错，使用模拟数据计算
             const resumes = this.mockData.resumes;
             const analyses = this.mockData.analyses;
             const jobs = this.mockData.jobs;
             
             const stats = {
                totalResumes: resumes.length,
                analyzedResumes: resumes.filter(r => r.status === 'analyzed').length,
                totalJobs: jobs.length,
                totalAnalyses: analyses.length,
                averageScore: 0,
                excellentResumes: 0,
                goodResumes: 0,
                averageResumes: 0,
                poorResumes: 0
            };
            
            if (analyses.length > 0) {
                const totalScore = analyses.reduce((sum, analysis) => sum + analysis.overall_score, 0);
                stats.averageScore = Math.round(totalScore / analyses.length);
                analyses.forEach(analysis => {
                    const score = analysis.overall_score;
                    if (score >= 90) stats.excellentResumes++;
                    else if (score >= 80) stats.goodResumes++;
                    else if (score >= 70) stats.averageResumes++;
                    else stats.poorResumes++;
                });
            }
            return stats;
        }
    }

    /**
     * 搜索简历
     * @param {string} query - 搜索关键词
     * @param {Object} filters - 过滤条件
     * @returns {Promise<Array>} - 搜索结果
     */
    async searchResumes(query = '', filters = {}) {
        try {
            let resumes = await this.getAllResumes();

            // 文本搜索
            if (query) {
                const lowerQuery = query.toLowerCase();
                resumes = resumes.filter(resume =>
                    resume.file_name.toLowerCase().includes(lowerQuery) ||
                    (resume.tags && resume.tags.some(tag => tag.toLowerCase().includes(lowerQuery)))
                );
            }

            // 状态过滤
            if (filters.status) {
                resumes = resumes.filter(resume => resume.status === filters.status);
            }

            // 分数范围过滤
            if (filters.scoreRange) {
                const analyses = await this.getAllAnalyses();
                const scoreMap = {};
                analyses.forEach(analysis => {
                    scoreMap[analysis.resume_id] = analysis.overall_score;
                });

                resumes = resumes.filter(resume => {
                    const score = scoreMap[resume.id] || 0;
                    return score >= filters.scoreRange.min && score <= filters.scoreRange.max;
                });
            }

            // 日期范围过滤
            if (filters.dateRange) {
                const startDate = new Date(filters.dateRange.start);
                const endDate = new Date(filters.dateRange.end);

                resumes = resumes.filter(resume => {
                    const uploadDate = new Date(resume.upload_date);
                    return uploadDate >= startDate && uploadDate <= endDate;
                });
            }

            return resumes;
        } catch (error) {
            console.error('搜索简历失败:', error);
            // 这里其实不需要特别处理，因为getAllResumes已经有了fallback
            // 但为了保险起见，可以返回空数组或者再次尝试使用mock数据
            return this.mockData.resumes;
        }
    }

    /**
     * 导出数据
     * @param {string} format - 导出格式 ('json' | 'csv')
     * @returns {Promise<string>} - 导出的数据
     */
    async exportData(format = 'json') {
        try {
            const [resumes, analyses] = await Promise.all([
                this.getAllResumes(),
                this.getAllAnalyses()
            ]);

            if (format === 'json') {
                return JSON.stringify({
                    resumes,
                    analyses,
                    exportDate: new Date().toISOString()
                }, null, 2);
            } else if (format === 'csv') {
                // 简化的CSV导出
                const headers = ['文件名', '上传日期', '状态', '综合评分', '分析日期'];
                const rows = [headers.join(',')];

                for (const resume of resumes) {
                    const latestAnalysis = await this.getLatestAnalysis(resume.id);
                    const row = [
                        `"${resume.file_name}"`,
                        resume.upload_date.split('T')[0],
                        resume.status,
                        latestAnalysis ? latestAnalysis.overall_score : 'N/A',
                        latestAnalysis ? latestAnalysis.analysis_date.split('T')[0] : 'N/A'
                    ];
                    rows.push(row.join(','));
                }

                return rows.join('\n');
            }

            throw new Error('Unsupported export format');
        } catch (error) {
            console.error('导出数据失败:', error);
            throw error;
        }
    }

    /**
     * 清空所有数据
     * @returns {Promise<boolean>} - 是否成功
     */
    async clearAllData() {
        try {
            const resumes = await this.getAllResumes();
            const deletePromises = resumes.map(resume => this.deleteResume(resume.id));
            await Promise.all(deletePromises);
            return true;
        } catch (error) {
            console.error('清空数据失败:', error);
            throw error;
        }
    }

    /**
     * 从解析数据中提取标签
     * @param {Object} parsedData - 解析后的简历数据
     * @returns {Array} - 标签数组
     */
    extractTags(parsedData) {
        const tags = [];

        if (parsedData && parsedData.skills) {
            tags.push(...parsedData.skills.slice(0, 5)); // 最多取5个技能作为标签
        }

        if (parsedData && parsedData.jobTitle) {
            tags.push(parsedData.jobTitle);
        }

        if (parsedData && parsedData.industry) {
            tags.push(parsedData.industry);
        }

        return [...new Set(tags)]; // 去重
    }
}

// 创建全局实例
window.resumeDataManager = new ResumeDataManager();
