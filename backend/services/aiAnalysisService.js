/**
 * AI分析服务
 * 集成真实的AI大模型进行简历分析
 */
const fs = require('fs').promises;
const path = require('path');

class AIAnalysisService {
    constructor() {
        // 支持多种AI模型
        this.providers = {
            openai: {
                apiKey: process.env.OPENAI_API_KEY,
                baseUrl: 'https://api.openai.com/v1',
                models: ['gpt-4', 'gpt-3.5-turbo', 'gpt-4-turbo'],
                enabled: !!process.env.OPENAI_API_KEY
            },
            anthropic: {
                apiKey: process.env.ANTHROPIC_API_KEY,
                baseUrl: 'https://api.anthropic.com',
                models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
                enabled: !!process.env.ANTHROPIC_API_KEY
            },
            google: {
                apiKey: process.env.GOOGLE_API_KEY,
                baseUrl: 'https://generativelanguage.googleapis.com',
                models: ['gemini-pro', 'gemini-pro-vision'],
                enabled: !!process.env.GOOGLE_API_KEY
            },
            local: {
                baseUrl: process.env.LOCAL_API_URL || 'http://localhost:11434',
                models: ['llama2', 'codellama', 'mistral'],
                enabled: !!process.env.LOCAL_API_URL
            }
        };
        this.currentProvider = this.getPreferredProvider();
        this.currentModel = this.getPreferredModel();
    }

    /**
     * 获取首选的AI提供商
     */
    getPreferredProvider() {
        for (const [name, config] of Object.entries(this.providers)) {
            if (config.enabled) {
                return name;
            }
        }
        return 'mock'; // 降级到模拟模式
    }

    /**
     * 获取首选的AI模型
     */
    getPreferredModel() {
        const provider = this.providers[this.currentProvider];
        if (provider && provider.models.length > 0) {
            return provider.models[0]; // 返回第一个可用模型
        }
        return 'gpt-4'; // 默认模型
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

            // 检查API密钥
            if (this.currentProvider === 'mock') {
                console.warn('使用模拟AI分析（缺少API密钥）');
                return this.generateMockAnalysis(resumeText, targetJob);
            }

            // 构建分析提示词
            const prompt = this.buildAnalysisPrompt(resumeText, targetJob, analysisOptions);

            // 调用AI API
            let analysisResult;
            try {
                if (this.currentProvider === 'openai') {
                    analysisResult = await this.callOpenAI(prompt);
                } else if (this.currentProvider === 'anthropic') {
                    analysisResult = await this.callAnthropic(prompt);
                } else if (this.currentProvider === 'google') {
                    analysisResult = await this.callGoogle(prompt);
                } else if (this.currentProvider === 'local') {
                    analysisResult = await this.callLocal(prompt);
                } else {
                    throw new Error('未配置的AI提供商');
                }
            } catch (apiError) {
                console.error(`${this.currentProvider} API调用失败，尝试降级...`, apiError);
                // 尝试其他可用的提供商
                const fallbackProvider = this.getFallbackProvider();
                if (fallbackProvider) {
                    console.log(`尝试使用备用提供商: ${fallbackProvider}`);
                    this.currentProvider = fallbackProvider;
                    this.currentModel = this.getPreferredModel();
                    
                    if (this.currentProvider === 'openai') {
                        analysisResult = await this.callOpenAI(prompt);
                    } else if (this.currentProvider === 'anthropic') {
                        analysisResult = await this.callAnthropic(prompt);
                    } else if (this.currentProvider === 'google') {
                        analysisResult = await this.callGoogle(prompt);
                    } else if (this.currentProvider === 'local') {
                        analysisResult = await this.callLocal(prompt);
                    }
                } else {
                    throw apiError;
                }
            }

            // 解析和分析AI返回的结果
            return this.parseAIResponse(analysisResult, targetJob);

        } catch (error) {
            console.error('AI分析服务错误:', error);
            
            // 错误降级：返回基础分析结果
            return this.generateFallbackAnalysis(resumeText, targetJob, error);
        }
    }

    /**
     * 调用OpenAI API
     */
    async callOpenAI(prompt) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.openaiApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4',
                messages: [
                    {
                        role: 'system',
                        content: '你是一位专业的HR和简历分析师，请根据提供的简历内容进行分析。'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 2000
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`OpenAI API错误: ${error.error?.message || '未知错误'}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }

    /**
     * 调用Anthropic API
     */
    async callAnthropic(prompt) {
        const provider = this.providers.anthropic;
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': provider.apiKey,
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: this.currentModel,
                max_tokens: 2000,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Anthropic API错误: ${error.error?.message || '未知错误'}`);
        }

        const data = await response.json();
        return data.content[0].text;
    }

    /**
     * 调用Google AI API
     */
    async callGoogle(prompt) {
        const provider = this.providers.google;
        const response = await fetch(`${provider.baseUrl}/v1beta/models/${this.currentModel}:generateContent?key=${provider.apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 2000
                }
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Google AI API错误: ${error.error?.message || '未知错误'}`);
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    }

    /**
     * 调用本地AI API
     */
    async callLocal(prompt) {
        const provider = this.providers.local;
        const response = await fetch(`${provider.baseUrl}/api/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: this.currentModel,
                prompt: prompt,
                stream: false,
                options: {
                    temperature: 0.3
                }
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`本地AI API错误: ${error || '未知错误'}`);
        }

        const data = await response.json();
        return data.response;
    }

    /**
     * 构建分析提示词
     */
    buildAnalysisPrompt(resumeText, targetJob, options) {
        let prompt = `请分析以下简历内容并提供详细评估：

**简历内容：**
${resumeText}

**分析要求：**
1. 整体评分（1-100分）
2. 各维度评分：基础匹配度、经验相关度、技能匹配度、学习能力、发展潜力、团队合作
3. 3-5个主要优势
4. 2-3个需要改进的方面
5. 具体的优化建议
6. 如果有目标职位，请针对该职位进行分析`;

        if (targetJob) {
            prompt += `
**目标职位：**
- 职位：${targetJob.title || '未指定'}
- 要求：${targetJob.requirements || '未提供'}
- 薪资：${targetJob.salary || '未提供'}
- 地点：${targetJob.location || '未提供'}`;
        }

        prompt += `
**请以JSON格式返回结果，格式如下：**
{
  "overall_score": 85,
  "dimensions": {
    "basic_match": 90,
    "experience_relevance": 85,
    "skill_match": 80,
    "learning_ability": 88,
    "development_potential": 85,
    "teamwork": 87
  },
  "strengths": ["技能匹配度高", "项目经验丰富"],
  "weaknesses": ["需要加强某些技术栈"],
  "suggestions": [
    {
      "type": "skill",
      "priority": "high",
      "title": "技能提升建议",
      "description": "具体建议内容",
      "actionItems": ["具体行动项1", "具体行动项2"]
    }
  ],
  "detailed_analysis": {
    "skill_analysis": "技能分析详情",
    "experience_analysis": "经验分析详情",
    "education_analysis": "教育背景分析",
    "project_analysis": "项目分析"
  }
}`;

        return prompt;
    }

    /**
     * 解析AI返回的结果
     */
    parseAIResponse(aiResponse, targetJob) {
        try {
            // 尝试提取JSON部分
            const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('无法从AI响应中提取JSON数据');
            }

            const parsedResult = JSON.parse(jsonMatch[0]);
            
            // 验证必要字段
            if (!parsedResult.overall_score || !parsedResult.dimensions) {
                throw new Error('AI响应格式不正确');
            }

            // 添加元数据
            return {
                ...parsedResult,
                targetJob,
                analysisDate: new Date().toISOString(),
                aiProvider: this.currentProvider,
                rawResponse: aiResponse
            };

        } catch (error) {
            console.error('解析AI响应错误:', error);
            throw new Error(`AI响应解析失败: ${error.message}`);
        }
    }

    /**
     * 生成模拟分析结果（降级方案）
     */
    generateMockAnalysis(resumeText, targetJob) {
        // 简化的模拟分析逻辑
        const words = resumeText.split(/\s+/).length;
        const hasExperience = resumeText.toLowerCase().includes('经验') || 
                             resumeText.toLowerCase().includes('工作') ||
                             resumeText.toLowerCase().includes('项目');
        
        const baseScore = Math.min(90, Math.max(50, 60 + (words / 100)));
        const score = Math.round(baseScore + (hasExperience ? 10 : 0));

        return {
            overall_score: score,
            dimensions: {
                basic_match: Math.round(score * 0.9),
                experience_relevance: Math.round(hasExperience ? score * 0.95 : score * 0.6),
                skill_match: Math.round(score * 0.85),
                learning_ability: Math.round(score * 0.9),
                development_potential: Math.round(score * 0.88),
                teamwork: Math.round(score * 0.92)
            },
            strengths: [
                '简历结构清晰',
                hasExperience ? '具备相关工作经验' : '教育背景良好'
            ],
            weaknesses: [
                '可以进一步量化工作成果',
                '技能描述可以更加具体'
            ],
            suggestions: [
                {
                    type: 'format',
                    priority: 'medium',
                    title: '格式优化',
                    description: '建议优化简历格式，提高可读性',
                    actionItems: ['统一字体和样式', '合理使用项目符号', '控制篇幅在2页内']
                }
            ],
            targetJob,
            analysisDate: new Date().toISOString(),
            aiProvider: 'mock_fallback',
            rawResponse: '使用模拟分析结果（API不可用）'
        };
    }

    /**
     * 生成降级分析结果
     */
    generateFallbackAnalysis(resumeText, targetJob, error) {
        console.warn('AI分析降级到基础分析:', error.message);
        return this.generateMockAnalysis(resumeText, targetJob);
    }

    /**
     * 文档内容提取（PDF、DOCX等）
     */
    async extractDocumentContent(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        
        try {
            switch (ext) {
                case '.pdf':
                    return await this.extractPDFContent(filePath);
                case '.docx':
                    return await this.extractDOCXContent(filePath);
                case '.txt':
                case '.html':
                    return await this.extractTextContent(filePath);
                default:
                    throw new Error(`不支持的文件格式: ${ext}`);
            }
        } catch (error) {
            console.error('文档提取错误:', error);
            throw new Error(`文档内容提取失败: ${error.message}`);
        }
    }

    /**
     * 提取PDF内容
     */
    async extractPDFContent(filePath) {
        // 在实际部署中，需要安装 pdf-parse 库
        try {
            const pdf = require('pdf-parse');
            const dataBuffer = require('fs').readFileSync(filePath);
            const data = await pdf(dataBuffer);
            return data.text;
        } catch (error) {
            console.error('PDF解析错误:', error);
            throw new Error('PDF文件解析失败');
        }
    }

    /**
     * 提取DOCX内容
     */
    async extractDOCXContent(filePath) {
        try {
            const mammoth = require('mammoth');
            const result = await mammoth.extractRawText({ path: filePath });
            return result.value;
        } catch (error) {
            console.error('DOCX解析错误:', error);
            throw new Error('DOCX文件解析失败');
        }
    }

    /**
     * 提取文本内容
     */
    async extractTextContent(filePath) {
        try {
            return await fs.readFile(filePath, 'utf8');
        } catch (error) {
            console.error('文本文件读取错误:', error);
            throw new Error('文本文件读取失败');
        }
    }

    /**
     * 批量分析简历
     * @param {Array} resumes - 简历数据数组
     * @param {Object} options - 分析选项
     * @returns {Promise<Array>} - 分析结果数组
     */
    async batchAnalyzeResumes(resumes, options = {}) {
        const results = [];
        const batchSize = 5; // 每批处理数量，避免API限制

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

            // 在批次之间添加延迟
            if (i + batchSize < resumes.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        return results;
    }

    /**
     * 获取备用提供商
     */
    getFallbackProvider() {
        const providers = Object.keys(this.providers);
        const currentIndex = providers.indexOf(this.currentProvider);
        
        for (let i = currentIndex + 1; i < providers.length; i++) {
            if (this.providers[providers[i]].enabled) {
                return providers[i];
            }
        }
        
        // 如果没有找到可用的，降级到模拟模式
        return null;
    }

    /**
     * 获取服务状态
     */
    getServiceStatus() {
        return {
            provider: this.currentProvider,
            model: this.currentModel,
            availableProviders: Object.keys(this.providers).filter(p => this.providers[p].enabled),
            configurations: {
                openai: !!this.providers.openai.apiKey,
                anthropic: !!this.providers.anthropic.apiKey,
                google: !!this.providers.google.apiKey,
                local: !!this.providers.local.baseUrl
            },
            isOperational: this.currentProvider !== 'mock'
        };
    }
}

module.exports = AIAnalysisService;