/**
 * 简历数据管理模块
 * 负责简历数据的存储、检索和管理（通过API调用）
 */

(function() {
if (typeof window.ResumeDataManager !== 'undefined') return;

class ResumeDataManagerInternal {
    constructor() {
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const isBackendPort = window.location.port === '3000';
        
        this.apiBaseUrl = '/api';
        this.fallbackApiBaseUrl = (isLocal && !isBackendPort) ? 'http://localhost:3000/api' : '/api';
        
        this.token = null;
        this.init();
    }

    /**
     * 初始化数据管理器
     */
    init() {
        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        if (userInfo.token) {
            this.token = userInfo.token;
        }
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
     * @param {boolean} silent - 是否不显示错误通知
     * @returns {Promise} - API响应
     */
    // 状态转换工具
    toCN(s) {
        const k = String(s || '').toLowerCase();
        if (k === 'applied' || k === '投递' || k === 'new' || k === '') return '投递';
        if (k === 'screening' || k === '快评' || k === '已快评' || k === '已快评_alias' || k === 'passed') return '快评';
        if (k === 'interview' || k === '面试') return '面试';
        if (k === 'offer' || k === '已发offer') return 'Offer';
        if (k === 'hired' || k === '入职' || k === '已入职' || k === '已录用') return '入职';
        if (k === 'rejected' || k === '淘汰' || k === '已淘汰') return '淘汰';
        return '投递';
    }

    async apiRequest(endpoint, method = 'GET', data = null, showLoading = true, silent = false) {
        if (showLoading && typeof ErrorHandler !== 'undefined') {
            ErrorHandler.showLoading(true);
        }

        const isForm = (data && typeof FormData !== 'undefined' && data instanceof FormData);
        const headers = isForm ? {} : { 'Content-Type': 'application/json' };
        
        // 增强 Token 获取逻辑
        let token = this.token;

        // 1. 尝试从 userAuthInstance 获取 (优先 window 全局实例)
        if (!token && typeof window.userAuthInstance !== 'undefined' && typeof window.userAuthInstance.getToken === 'function') {
            token = window.userAuthInstance.getToken();
        }
        // 2. 尝试从局部 userAuthInstance 获取
        if (!token && typeof userAuthInstance !== 'undefined' && typeof userAuthInstance.getToken === 'function') {
            token = userAuthInstance.getToken();
        }
        // 3. 尝试从 localStorage 获取
        if (!token) {
            try {
                const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
                token = userInfo.token;
            } catch (_) {}
        }
        // 4. 尝试从 localStorage 直接获取 token (旧兼容)
        if (!token) {
            token = localStorage.getItem('token');
        }

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        } else {
            console.warn('[ResumeDataManager] API请求缺失Token:', endpoint);
        }

        const options = { method, headers, cache: method === 'GET' ? 'no-store' : 'default' };
        if (data) options.body = isForm ? data : JSON.stringify(data);

        const tryRequest = async (base) => {
            const response = await fetch(`${base}${endpoint}`, options);
            const text = await response.text();
            let result;
            try {
                result = text ? JSON.parse(text) : {};
            } catch (e) {
                // 仅记录警告，避免控制台充满红色的 JSON 解析错误
                console.warn(`⚠️ [API] ${base} 返回了非 JSON 响应，将尝试下一个备选地址。`);
                // 如果是404/500且返回HTML，这里会捕获
                const err = new Error(response.ok ? '服务器返回了非JSON格式的数据' : `请求失败 (${response.status})`);
                err.status = response.status;
                throw err;
            }

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

        const bases = [this.apiBaseUrl, this.fallbackApiBaseUrl, '/api'].filter((v, i, arr) => v && arr.indexOf(v) === i);

        let lastError;
        for (const b of bases) {
            try {
                const res = await tryRequest(b);
                this.apiBaseUrl = b;
                if (showLoading && typeof ErrorHandler !== 'undefined') { ErrorHandler.showLoading(false); }
                
                // 全局兼容：如果返回结果中有 recruitment_status，尝试转换
                if (res && res.data) {
                    const processItem = (item) => {
                        if (item && typeof item === 'object' && 'recruitment_status' in item) {
                            item.recruitment_status = this.toCN(item.recruitment_status);
                        }
                        return item;
                    };
                    if (Array.isArray(res.data)) {
                        res.data.forEach(processItem);
                    } else if (typeof res.data === 'object') {
                        Object.values(res.data).forEach(val => {
                            if (Array.isArray(val)) val.forEach(processItem);
                            else processItem(val);
                        });
                    }
                }
                
                return res;
            } catch (e) {
                lastError = e;
                if (e && e.status === 401) { break; }
                continue;
            }
        }
        if (showLoading && typeof ErrorHandler !== 'undefined') { ErrorHandler.showLoading(false); }
        if (!silent) {
            if (typeof ErrorHandler !== 'undefined') {
                ErrorHandler.showError(lastError);
            }
        }
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
                tags: []
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
     * @param {boolean} silent - 是否不显示错误通知
     * @returns {Promise<Array>} - 简历数组
     */
    async getAllResumes(silent = false) {
        const result = await this.apiRequest('/resumes', 'GET', null, true, silent);
        return result.data;
    }

    async getTalentPoolResumes(groupByStatus = false, silent = false, query = {}) {
        const qs = new URLSearchParams();
        if (groupByStatus) qs.set('groupByStatus', 'true');
        
        // 遍历 query 对象，将所有参数添加到 URLSearchParams
        Object.keys(query).forEach(key => {
            if (query[key] !== undefined && query[key] !== null) {
                qs.set(key, String(query[key]));
            }
        });

        // 兼容旧字段
        if (query.isTalentPool === true || query.is_talent_pool === true || query.isTalentPool === 'true' || query.is_talent_pool === 'true') {
            qs.set('is_talent_pool', 'true');
        }
        
        const result = await this.apiRequest(`/library/resumes?${qs.toString()}`, 'GET', null, true, silent);
        return (result && result.data) ? result.data : [];
    }

    /**
     * 获取所有分析结果
     * @param {boolean} silent - 是否不显示错误通知
     * @returns {Promise<Array>} - 分析结果数组
     */
    async getAllAnalyses(silent = false) {
        const result = await this.apiRequest('/analysis', 'GET', null, true, silent);
        return result.data;
    }

    /**
     * 获取招聘流程数据
     * @param {string} jobId - 职位ID (可选)
     * @param {string} status - 状态 (可选)
     * @param {boolean} silent - 是否不显示错误通知
     * @returns {Promise<Object>} - 流程数据 (按状态分组)
     */
    async getRecruitmentPipeline(jobId = null, options = null, silent = false) {
        // 统一使用 getTalentPoolResumes 并开启 groupByStatus=true
        // 这样可以确保"全部岗位"和"特定岗位"的数据来源一致，且都包含人才库中的简历
        const query = {
            include_rejected: true // 招聘看板必须包含已淘汰的数据，否则淘汰池会显示为空
        };
        
        if (jobId && jobId !== 'all') {
            query.jobId = jobId;
        }
        
        if (options && typeof options === 'object') {
            if (options.status) query.status = options.status;
            if (options.q) query.q = options.q;
        }

        return this.getTalentPoolResumes(true, silent, query);
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
            const data = { status, notes };
            const result = await this.apiRequest(`/recruitment/candidates/${id}/status`, 'POST', data);
            return result.data;
        } catch (error) {
            console.error('更新招聘状态失败:', error);
            throw error;
        }
    }

    /**
     * 安排面试
     * @param {string} id - 记录ID (ResumeJob ID)
     * @param {Object} interviewData - 面试数据 {datetime, channel, location, note}
     * @returns {Promise<Object>} - 结果
     */
    async scheduleInterview(id, interviewData) {
        try {
            const result = await this.apiRequest(`/recruitment/candidates/${id}/schedule-interview`, 'POST', interviewData);
            return result.data;
        } catch (error) {
            console.error('安排面试失败:', error);
            throw error;
        }
    }

    /**
     * 发送Offer
     * @param {string} id - 记录ID (ResumeJob ID)
     * @param {Object} offerData - Offer数据 {phone, email, message}
     * @returns {Promise<Object>} - 结果
     */
    async sendOffer(id, offerData) {
        try {
            const result = await this.apiRequest(`/recruitment/candidates/${id}/send-offer`, 'POST', offerData);
            return result.data;
        } catch (error) {
            console.error('发送Offer失败:', error);
            throw error;
        }
    }

    /**
     * 创建职位
     * @param {Object} jobData - 职位数据
     * @returns {Promise<Object>} - 创建的职位
     */
    async createJob(jobData) {
        try {
            const result = await this.apiRequest('/jobs', 'POST', jobData);
            return result.data;
        } catch (error) {
            console.error('创建职位失败:', error);
            throw error;
        }
    }

    /**
     * 根据ID获取职位
     * @param {string} jobId - 职位ID
     * @returns {Promise<Object>} - 职位详情
     */
    async getJobById(jobId) {
        const result = await this.apiRequest(`/jobs/${jobId}`);
        return result.data;
    }

    /**
     * 更新职位
     * @param {string} jobId - 职位ID
     * @param {Object} jobData - 更新数据
     * @returns {Promise<Object>} - 更新结果
     */
    async updateJob(jobId, jobData) {
        const result = await this.apiRequest(`/jobs/${jobId}`, 'PUT', jobData);
        return result.data;
    }

    /**
     * 删除职位
     * @param {string} jobId - 职位ID
     * @returns {Promise<boolean>} - 删除结果
     */
    async deleteJob(jobId) {
        await this.apiRequest(`/jobs/${jobId}`, 'DELETE');
        return true;
    }

    /**
     * 获取所有职位
     * @param {boolean} showLoading - 是否显示加载状态
     * @param {boolean} fullResponse - 是否返回完整响应（包含统计数据）
     * @returns {Promise<Array|Object>} - 职位数组或完整响应
     */
    async getAllJobs(showLoading = true, fullResponse = false) {
        const result = await this.apiRequest('/jobs', 'GET', null, showLoading);
        return fullResponse ? result : result.data;
    }

    /**
     * 根据ID获取简历
     * @param {string} resumeId - 简历ID
     * @returns {Promise<Object|null>} - 简历对象或null
     */
    async getResumeById(resumeId) {
        console.log('getResumeById调用参数:', resumeId, '类型:', typeof resumeId);
        try {
            const endpoint = `/resumes/${resumeId}`;
            console.log('发送API请求:', endpoint);
            const result = await this.apiRequest(endpoint);
            console.log('API请求成功，返回结果:', result);
            return result.data;
        } catch (error) {
            console.error('getResumeById出错:', error, '状态码:', error.status, '错误信息:', error.message);
            if (error.message.includes('不存在')) {
                return null;
            }
            throw error;
        }
    }

    /**
     * 根据简历ID获取分析结果
     * @param {string} resumeId - 简历ID
     * @returns {Promise<Array>} - 该简历的所有分析结果
     */
    async getAnalysesByResumeId(resumeId) {
        const result = await this.apiRequest(`/analysis/resume/${resumeId}`);
        return result.data;
    }

    /**
     * 获取最新的分析结果
     * @param {string} resumeId - 简历ID
     * @returns {Promise<Object|null>} - 最新分析结果或null
     */
    async getLatestAnalysis(resumeId) {
        const result = await this.apiRequest(`/analysis/latest/${resumeId}`);
        return result.data;
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
     * 更新简历系统状态 (uploaded, parsing, analyzed, failed, archived)
     * @param {string} resumeId - 简历ID
     * @param {string} status - 新状态
     * @returns {Promise<boolean>} - 更新是否成功
     */
    async updateResumeStatus(resumeId, status) {
        try {
            await this.apiRequest(`/resumes/${resumeId}`, 'PUT', {
                status: status
            });
            return true;
        } catch (error) {
            console.error('更新简历状态失败:', error);
            throw error;
        }
    }

    /**
     * 更新简历招聘流程状态 (投递, 快评, 面试, Offer, 入职, 放弃, 淘汰)
     * @param {string} resumeId - 简历ID
     * @param {string} status - 新招聘状态
     * @returns {Promise<boolean>} - 更新是否成功
     */
    /**
     * 更新简历招聘状态 (人才库专用)
     * @param {string} resumeId - 简历ID
     * @param {string} status - 状态 (中文)
     * @param {string} notes - 备注 (可选)
     * @returns {Promise<boolean>}
     */
    async updateResumeRecruitmentStatus(resumeId, status, notes = null) {
        try {
            await this.apiRequest(`/resumes/${resumeId}/status`, 'PUT', {
                status: status,
                notes: notes
            });
            return true;
        } catch (error) {
            console.error('更新简历招聘状态失败:', error);
            throw error;
        }
    }

    /**
     * 获取仪表盘统计数据
     * @returns {Promise<Object>}
     */
    async getDashboardStats() {
        const result = await this.apiRequest('/dashboard/stats');
        return result.data;
    }

    /**
     * 获取待办事项
     * @returns {Promise<Array>}
     */
    async getPendingTasks() {
        const result = await this.apiRequest('/dashboard/tasks');
        return result.data;
    }

    async getAIPrediction(period = '7d') {
        const params = new URLSearchParams();
        params.append('period', period);
        const result = await this.apiRequest(`/dashboard/ai-prediction?${params.toString()}`);
        return result.data;
    }

    async getStatistics() {
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

    async searchResumes(query = '', filters = {}) {
        let resumes = await this.getAllResumes();

        if (query) {
            const lowerQuery = query.toLowerCase();
            resumes = resumes.filter(resume =>
                resume.file_name.toLowerCase().includes(lowerQuery)
            );
        }

        if (filters.status) {
            resumes = resumes.filter(resume => resume.status === filters.status);
        }

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

        if (filters.dateRange) {
            const startDate = new Date(filters.dateRange.start);
            const endDate = new Date(filters.dateRange.end);

            resumes = resumes.filter(resume => {
                const uploadDate = new Date(resume.upload_date);
                return uploadDate >= startDate && uploadDate <= endDate;
            });
        }

        return resumes;
    }

    async exportData(format = 'json') {
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
    }

    async clearAllData() {
        const resumes = await this.getAllResumes();
        const deletePromises = resumes.map(resume => this.deleteResume(resume.id));
        await Promise.all(deletePromises);
        return true;
    }

    /**
     * 从解析数据中提取标签 (已禁用技能标签)
     * @param {Object} parsedData - 解析后的简历数据
     * @returns {Array} - 标签数组
     */
    extractTags(parsedData) {
        return []; // 禁用技能标签提取
    }
}

window.ResumeDataManager = ResumeDataManagerInternal;
})();

// 创建全局实例
if (!window.resumeDataManager || typeof window.resumeDataManager.updateResumeRecruitmentStatus !== 'function') {
    window.resumeDataManager = new window.ResumeDataManager();
}
