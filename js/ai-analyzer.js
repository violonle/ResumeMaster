/**
 * AI简历分析器模块
 * 调用后端API进行简历分析
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
    }

    /**
     * 检查是否已存在分析结果
     * @param {string} resumeId - 简历ID
     * @returns {Promise<Object|null>} - 存在的分析结果或null
     */
    async checkExistingAnalysis(resumeId) {
        if (!resumeId) return null;
        try {
            // 直接调用 resumeDataManager 获取最新分析结果
            // 该方法对应后端的 /analysis/latest/:resumeId 接口，会查询 DeepAnalysisRecord 表
            const result = await window.resumeDataManager.getLatestAnalysis(resumeId);
            return result;
        } catch (error) {
            console.error('检查现有分析失败:', error);
            return null;
        }
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
                jobDescription: targetJob ? JSON.stringify(targetJob) : null,
                options: { scene: 'deep_analysis' }
            }, true, true); // Added silent=true

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
            const formData = new FormData();
            formData.append('file', file);
            if (targetJob) {
                formData.append('targetJob', JSON.stringify(targetJob));
            }

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

            // 优化：如果后端已经自动触发了分析（场景化自动初筛），则直接进入轮询
            if (uploadResult.data && uploadResult.data.isAnalyzing) {
                console.log('[AI Analyzer] Backend auto-triggered analysis, starting poll...');
                const data = await this.pollAnalysisResult(uploadResult.data.resumeId);
                if (progressCallback) {
                    progressCallback({ step: 3, total: 3, message: 'AI分析完成', progress: 100 });
                }
                return data;
            }

            const analysisResponse = await resumeDataManager.apiRequest('/ai/analyze', 'POST', {
                resumeId: uploadResult.data.resumeId,
                jobDescription: targetJob ? JSON.stringify(targetJob) : null,
                options: { scene: 'deep_analysis' }
            }, true, true); // Added silent=true

            if (analysisResponse.success) {
                if (analysisResponse.status === 'processing') {
                    const data = await this.pollAnalysisResult(uploadResult.data.resumeId);
                    if (progressCallback) {
                        progressCallback({ step: 3, total: 3, message: 'AI分析完成', progress: 100 });
                    }
                    return data;
                } else {
                    if (progressCallback) {
                        progressCallback({ step: 3, total: 3, message: 'AI分析完成', progress: 100 });
                    }
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
                jobDescription: targetJob ? JSON.stringify(targetJob) : null,
                options: { scene: 'deep_analysis' }
            }, true, true); // Added silent=true

            if (response.success) {
                if (response.status === 'processing') {
                    const data = await this.pollAnalysisResult(resumeId);
                    if (progressCallback) {
                        progressCallback({ step: 3, total: 3, message: 'AI分析完成', progress: 100 });
                    }
                    return data;
                } else {
                    if (progressCallback) {
                        progressCallback({ step: 3, total: 3, message: 'AI分析完成', progress: 100 });
                    }
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
                // 使用 silent=true 避免轮询期间的正常错误（如结果未生成）触发警示框或控制台报错
                const statusRes = await resumeDataManager.apiRequest(`/ai/status/${resumeId}`, 'GET', null, false, true);
                if (statusRes && statusRes.success) {
                    const status = statusRes.data.status;
                    if (status === 'analyzed') {
                        const resultRes = await resumeDataManager.apiRequest(`/ai/result/${resumeId}`, 'GET', null, false, true);
                        if (resultRes && resultRes.success && resultRes.data) {
                            // 增加严格校验：确保返回的结果属于当前请求的 resumeId
                            const resultData = resultRes.data;
                            const returnedId = resultData.resume_id || resultData.id;
                            if (String(returnedId) === String(resumeId)) {
                                return resultData;
                            } else {
                                console.warn(`[Poll] Received data for wrong resumeId. Expected: ${resumeId}, Got: ${returnedId}`);
                            }
                        }
                    } else if (status === 'failed') {
                        throw new Error('分析失败');
                    } else {
                        // 尝试性获取，如果还没好也不报错
                        if (attempts % 3 === 0) {
                            try {
                                const rr = await resumeDataManager.apiRequest(`/ai/result/${resumeId}`, 'GET', null, false, true);
                                if (rr && rr.success && rr.data) {
                                    const rData = rr.data;
                                    const rId = rData.resume_id || rData.id;
                                    if (String(rId) === String(resumeId)) {
                                        return rData;
                                    }
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
    async batchAnalyze(resumeIds, targetJob = null, progressCallback = null) {
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
                resumeIds: resumeIds,
                options: {
                    jobDescription: targetJob ? JSON.stringify(targetJob) : null,
                    scene: 'deep_analysis'
                }
            }, true, true);

            if (response.success) {
                if (progressCallback) {
                    progressCallback({
                        step: 3,
                        total: 3,
                        message: '批量分析完成',
                        progress: 100
                    });
                }
                return response.data;
            } else {
                throw new Error(response.error?.message || '批量分析失败');
            }
        } catch (error) {
            console.error('批量分析失败:', error);
            throw error;
        }
    }

    /**
     * 多人对比分析
     */
    async compareResumes(resumeIds, targetJob = null, progressCallback = null) {
        try {
            if (progressCallback) {
                progressCallback({
                    step: 1,
                    total: 3,
                    message: '正在准备对比数据...',
                    progress: 33
                });
            }

            const response = await resumeDataManager.apiRequest('/ai/compare-resumes', 'POST', {
                resumeIds: resumeIds,
                jobDescription: targetJob ? JSON.stringify(targetJob) : null,
                options: { scene: 'deep_analysis' }
            }, true, true); // Added silent=true

            if (response.success) {
                if (progressCallback) {
                    progressCallback({
                        step: 3,
                        total: 3,
                        message: '对比分析完成',
                        progress: 100
                    });
                }
                return response.data;
            } else {
                throw new Error(response.error?.message || '对比分析失败');
            }
        } catch (error) {
            console.error('对比分析失败:', error);
            throw error;
        }
    }
}

window.aiAnalyzer = new AIResumeAnalyzer();
