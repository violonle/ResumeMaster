const axios = require('axios');
const OpenAI = require('openai');
const { AI_SERVICES, SERVICE_PRIORITY, MODEL_STRATEGIES } = require('../config/aiServices');
const { SystemConfig, ModelKey } = require('../models');
const promptService = require('./promptService');

class DomesticAIService {
  constructor() {
    this.serviceStats = {};
    this.serviceFailures = {};
    this.costTracker = {};
    this.aiConfig = null;
    this.aiConfigLoadedAt = 0;
    this.initializeServices();
  }

  async loadAIConfig() {
    const now = Date.now();
    if (this.aiConfig && now - this.aiConfigLoadedAt < 60000) return this.aiConfig;
    const row = await SystemConfig.findOne({ where: { key: 'ai_config' } });
    let cfg = null;
    try { cfg = row && row.value ? JSON.parse(row.value) : null } catch (_) { cfg = null }
    this.aiConfig = cfg;
    this.aiConfigLoadedAt = now;
    return this.aiConfig;
  }

  getProviderConfig(service) {
    const providers = (this.aiConfig && this.aiConfig.providers) ? this.aiConfig.providers : {};
    const upper = String(service).toUpperCase();
    const lower = String(service).toLowerCase();
    const direct = providers[upper] || providers[lower] || null;
    return direct || null;
  }

  async resolveTaskMapping(taskType) {
    await this.loadAIConfig();
    const tm = this.aiConfig && this.aiConfig.taskMapping ? this.aiConfig.taskMapping : null;
    const m = tm ? tm[taskType] : null;
    if (m && m.provider && m.model) return { service: String(m.provider).toUpperCase(), model: m.model };
    if ((taskType === 'resume_analysis' || taskType === 'resume_compare') && tm && tm['analysis'] && tm['analysis'].provider && tm['analysis'].model) {
      const a = tm['analysis'];
      return { service: String(a.provider).toUpperCase(), model: a.model };
    }
    return null;
  }

  // 初始化服务状态
  initializeServices() {
    Object.keys(AI_SERVICES).forEach(service => {
      this.serviceStats[service] = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalTokens: 0,
        totalCost: 0,
        averageResponseTime: 0,
        lastUsed: null
      };
      this.serviceFailures[service] = 0;
      this.costTracker[service] = 0;
    });
  }

  // 辅助：获取原始 Provider 名称（去除 _2 等后缀）
  getOriginalProviderName(serviceName) {
    if (!serviceName) return '';
    // 如果直接在 AI_SERVICES 中存在，则直接返回
    if (AI_SERVICES[serviceName]) return serviceName;
    
    // 尝试去除 _后缀
    const parts = serviceName.split('_');
    if (parts.length > 1) {
      const base = parts[0];
      if (AI_SERVICES[base]) return base;
    }
    return serviceName;
  }

  // 获取服务配置
  getServiceConfig(service, apiKeyOverride = null) {
    const p = this.getProviderConfig(service);
    const originalProvider = this.getOriginalProviderName(service);
    
    const defaultBaseUrl = (
      originalProvider === 'SILICONFLOW' ? process.env.SILICONFLOW_BASE_URL :
      originalProvider === 'GLM' ? process.env.GLM_BASE_URL :
      originalProvider === 'QWEN' ? process.env.QWEN_BASE_URL :
      originalProvider === 'DEEPSEEK' ? process.env.DEEPSEEK_BASE_URL : ''
    ) || (AI_SERVICES[originalProvider] ? AI_SERVICES[originalProvider].baseUrl : '');
    const baseURL = p && p.baseUrl ? p.baseUrl : defaultBaseUrl;
    
    const apiKey = apiKeyOverride || (p && p.apiKey ? p.apiKey : (
      originalProvider === 'SILICONFLOW' ? process.env.SILICONFLOW_API_KEY :
      originalProvider === 'GLM' ? process.env.GLM_API_KEY :
      originalProvider === 'QWEN' ? process.env.QWEN_API_KEY :
      originalProvider === 'DEEPSEEK' ? process.env.DEEPSEEK_API_KEY : ''
    ));
    const headers = {};
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    if (service === 'QWEN') headers['Content-Type'] = 'application/json';
    let timeout = (p && typeof p.timeout === 'number' && p.timeout > 0)
      ? p.timeout
      : (process.env.AI_TIMEOUT_MS ? parseInt(process.env.AI_TIMEOUT_MS, 10) : 180000);
    if (process.env.NODE_ENV !== 'production' && timeout > 120000) {
      timeout = 120000;
    }
    return { baseURL, timeout, headers };
  }

  // 选择最优服务
  async selectOptimalService(taskType = 'resume_analysis', userCtx = null) {
    console.log(`[AI Service] Selecting optimal service for task: ${taskType}`);
    
    await this.loadAIConfig();
    console.log(`[AI Service] Current AI Config loaded. Providers count: ${Object.keys(this.aiConfig?.providers || {}).length}`);

    const mapped = await this.resolveTaskMapping(taskType);
    if (mapped) {
        const available = this.isServiceAvailable(mapped.service);
        console.log(`[AI Service] Task mapping found: ${mapped.service} / ${mapped.model}, Available: ${available}`);
        if (available) {
            console.log(`[AI Service] Using task mapping: ${mapped.service} / ${mapped.model}`);
            return mapped;
        } else {
            console.warn(`[AI Service] Mapped service ${mapped.service} is not available (Failures: ${this.serviceFailures[mapped.service] || 0}). Falling back.`);
        }
    } else {
        console.log(`[AI Service] No task mapping found for ${taskType}`);
    }
    
    // 优先使用数据库启用的模型密钥（支持同平台多模型并行启用）
    const enabledKeys = await this.getEnabledModelKeys(userCtx);
    console.log(`[AI Service] Enabled keys from DB: ${enabledKeys.length}`);
    
    if (enabledKeys.length) {
      // 简单优先级：按 SERVICE_PRIORITY 顺序选择第一个可用的 provider 的一条模型，轮询模型列表
      for (const svc of SERVICE_PRIORITY) {
        const keysOfSvc = enabledKeys.filter(k => String(k.provider).toUpperCase() === svc);
        // 只要数据库中有key，且失败次数未超标，就尝试使用（不再依赖 isServiceAvailable 检查 Env/SystemConfig）
        const failures = this.serviceFailures[svc] || 0;
        if (keysOfSvc.length && failures < 5) {
          const idx = this.nextIndexForService(svc, keysOfSvc.length);
          const chosen = keysOfSvc[idx];
          console.log(`[AI Service] Selected via priority: ${svc} / ${chosen.model}`);
          return { service: svc, model: chosen.model, apiKey: chosen.apiKey };
        }
      }
    }
    
    const def = this.aiConfig && this.aiConfig.defaultProvider ? String(this.aiConfig.defaultProvider).toUpperCase() : null;
    if (def && this.isServiceAvailable(def)) {
      const p = this.getProviderConfig(def);
      const model = p && p.model ? p.model : Object.keys(AI_SERVICES[def].models)[0];
      console.log(`[AI Service] Selected default provider: ${def} / ${model}`);
      return { service: def, model };
    }
    
    const strategy = MODEL_STRATEGIES[taskType] || MODEL_STRATEGIES['resume_analysis'];
    for (const model of [...(strategy?.preferred||[]), ...(strategy?.fallback||[])]) {
      const service = this.findServiceByModel(model);
      if (service && this.isServiceAvailable(service)) {
          console.log(`[AI Service] Selected via strategy: ${service} / ${model}`);
          return { service, model };
      }
    }
    
    for (const service of SERVICE_PRIORITY) {
      if (this.isServiceAvailable(service)) {
        const models = Object.keys(AI_SERVICES[service].models);
        console.log(`[AI Service] Fallback to first available: ${service} / ${models[0]}`);
        return { service, model: models[0] };
      }
    }
    
    const allowMock = process.env.ALLOW_MOCK_AI === '1' || process.env.NODE_ENV !== 'production';
    if (allowMock) {
      console.warn('[AI Service] No available AI service found. Falling back to MOCK.');
      return { service: 'MOCK', model: 'mock' };
    }
    console.warn('[AI Service] No available AI service found.');
    throw new Error('No available AI service found. Please configure API keys.');
  }

  // 根据模型找到对应服务
  findServiceByModel(model) {
    for (const [serviceName, service] of Object.entries(AI_SERVICES)) {
      if (service.models[model]) {
        return serviceName;
      }
    }
    return null;
  }

  // 检查服务是否可用
  isServiceAvailable(service) {
    const failures = this.serviceFailures[service] || 0;
    if (failures >= 5) return false;
    const p = this.getProviderConfig(service);
    if (p && p.enabled && p.apiKey) return true;
    const apiKeyMap = {
      SILICONFLOW: process.env.SILICONFLOW_API_KEY,
      GLM: process.env.GLM_API_KEY,
      QWEN: process.env.QWEN_API_KEY,
      DEEPSEEK: process.env.DEEPSEEK_API_KEY
    };
    return !!apiKeyMap[service];
  }

  // 记录服务统计
  recordServiceStats(service, success, tokens = 0, responseTime = 0) {
    if (!service) return; // 防止 service 为空

    // 确保 serviceStats 中有该 service 的记录
    if (!this.serviceStats[service]) {
      console.warn(`[AI Service] Warning: Recording stats for unknown service '${service}'. Initializing stats.`);
      this.serviceStats[service] = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalTokens: 0,
        totalCost: 0,
        averageResponseTime: 0,
        lastUsed: null
      };
      if (this.serviceFailures[service] === undefined) this.serviceFailures[service] = 0;
      if (this.costTracker[service] === undefined) this.costTracker[service] = 0;
    }

    const stats = this.serviceStats[service];
    stats.totalRequests++;
    stats.lastUsed = new Date();

    if (success) {
      stats.successfulRequests++;
      stats.totalTokens += tokens;
      this.serviceFailures[service] = 0; // 重置失败计数
      
      // 计算平均响应时间
      if (stats.averageResponseTime === 0) {
        stats.averageResponseTime = responseTime;
      } else {
        stats.averageResponseTime = (stats.averageResponseTime + responseTime) / 2;
      }

      // 计算成本
      const cost = this.calculateCost(service, tokens);
      stats.totalCost += cost;
      this.costTracker[service] += cost;
    } else {
      stats.failedRequests++;
      this.serviceFailures[service] = (this.serviceFailures[service] || 0) + 1;
    }
  }

  // 计算成本
  calculateCost(service, tokens) {
    const originalProvider = this.getOriginalProviderName(service);
    const svcConfig = AI_SERVICES[originalProvider];
    if (!svcConfig || !svcConfig.pricing) return 0;

    const pricing = svcConfig.pricing;
    const model = Object.keys(pricing)[0]; // 简化处理，使用第一个模型的价格
    const pricePer1K = pricing[model] || 0.001;
    return (tokens / 1000) * pricePer1K;
  }

  // 招聘趋势预测
  async generateRecruitmentForecast(data, userCtx = null) {
    const startTime = Date.now();
    // 复用简历分析的任务类型配置，确保使用相同的大模型
    const { service, model, apiKey } = await this.selectOptimalService('resume_analysis', userCtx);

    try {
      const prompt = await promptService.getPrompt('recruitment_forecast', {
        dataJson: JSON.stringify(data, null, 2)
      });

      console.log(`[AI Forecast] Starting generation using ${service}/${model}`);
      const result = await this.callAIService(service, model, prompt, apiKey);
      const responseTime = Date.now() - startTime;
      
      // 估算token数量
      const tokens = Math.ceil((prompt.length + (typeof result === 'string' ? result.length : 500)) / 4);
      this.recordServiceStats(service, true, tokens, responseTime);

      // 使用统一的 JSON 解析逻辑
      const parsed = this.parseJSONResponse(result);
      
      if (!parsed) {
        console.warn(`[AI Forecast] Failed to parse JSON response from ${service}/${model}. Raw result:`, 
          typeof result === 'string' ? result.substring(0, 200) + '...' : 'Object');
        throw new Error('无法从 AI 响应中解析出有效的预测 JSON 结构');
      }

      return {
        success: true,
        data: parsed,
        service: service,
        model: model
      };
    } catch (error) {
      this.recordServiceStats(service, false);
      console.error(`AI 预测分析失败 (${service}):`, error.message);
      
      // 返回降级数据
      return {
        success: false,
        error: error.message,
        data: {
            trend_analysis: "无法生成实时趋势分析，原因：" + (error.message || "未知错误"),
            pipeline_health: "服务暂时不可用",
            potential_bottlenecks: ["AI 服务连接失败或响应解析错误"],
            suggestions: ["请检查后台 AI 模型配置", "确保 API Key 有效且未超限", "尝试刷新页面重新分析"]
        },
        service: 'ERROR',
        model: 'error'
      };
    }
  }

  // 简历分析
  async analyzeResume(resumeText, jobDescription = '', userCtx = null, scene = null, questionCount = 8, force = false) {
    const startTime = Date.now();
    
    // Determine prompt key and task type based on scene
    let promptKey;
    let taskType;

    // 核心统一：只有 deep_analysis 场景使用深度解析模板，其他统一使用快评模板
    if (scene === 'deep_analysis') {
        promptKey = 'resume_deep_analysis';
        taskType = 'resume_analysis';
        // 核心修复：如果是深度解析场景，questionCount 固定为 10 以获取更详尽内容
        questionCount = 10;
    } else if (scene === 'supplement_report') {
        promptKey = 'resume_supplement_report';
        taskType = 'resume_analysis';
    } else if (scene === 'interview_question_generation') {
        promptKey = 'interview_question_generation';
        taskType = 'interview';
    } else if (scene === 'interview_answer_evaluation') {
        promptKey = 'interview_answer_evaluation';
        taskType = 'interview';
    } else {
        // 包含 analysis, talent_pool, resume_quick_score 以及任何未知场景
        // 统一使用快速打分模板，确保性能和一致性
        promptKey = 'resume_quick_score';
        taskType = 'job';
    }

    const { service, model, apiKey } = await this.selectOptimalService(taskType, userCtx);

    try {
      const isDeepAnalysis = scene === 'deep_analysis';
      const isSupplement = scene === 'supplement_report';
      
      // 核心修复：确保深度解析和补充报告场景下也能正确传递 JD
      // 且使用统一的 JD 处理逻辑
      const jdSection = (jobDescription) ? promptService.prepareJobDescriptionVar(jobDescription) : '';
      
      const prompt = await promptService.getPrompt(promptKey, {
        resumeText,
        jobDescriptionSection: jdSection,
        targetJobSection: jdSection,
        questionCount: questionCount
      });
      
      console.log(`[AI Service] Starting analyzeResume for task: ${taskType}, scene: ${scene}, model: ${service}/${model}${force ? ' (FORCED)' : ''}`);
      
      const result = await this.callAIService(service, model, prompt, apiKey, force);
      const responseTime = Date.now() - startTime;
      
      console.log(`[AI Service] Raw response from ${service}/${model}:`, 
        typeof result === 'string' ? result.substring(0, 500) + (result.length > 500 ? '...' : '') : 'Object received');
      
      // 估算token数量（简化计算）
      const tokens = Math.ceil((prompt.length + JSON.stringify(result).length) / 4);
      this.recordServiceStats(service, true, tokens, responseTime);

      // 使用通用的解析逻辑
      const parsed = this.parseJSONResponse(result);
      if (!parsed) {
        throw new Error('无法从 AI 响应中解析出有效的对比 JSON 结构');
      }

      return {
        success: true,
        data: parsed,
        service: service,
        model: model,
        cost: this.calculateCost(service, tokens),
        responseTime: responseTime
      };
    } catch (error) {
      this.recordServiceStats(service, false);
      
      const isDeepAnalysis = scene === 'deep_analysis';
      const jdSection = (!isDeepAnalysis && jobDescription) ? `### 目标职位描述 (JD):\n${jobDescription}` : '';
      // 准备重试的 prompt
      const retryPrompt = await promptService.getPrompt(promptKey, {
        resumeText,
        jobDescriptionSection: jdSection,
        targetJobSection: jdSection,
        questionCount: questionCount
      });
      
      return await this.fallbackToBackupService(taskType, retryPrompt, null, userCtx);
    }
  }

  async analyzeUrlResume(urlText, userCtx = null) {
    const startTime = Date.now();
    const { service, model, apiKey } = await this.selectOptimalService('url_read', userCtx);
    try {
      const prompt = await promptService.getPrompt('resume_deep_analysis', {
        resumeText: urlText,
        targetJobSection: ''
      });
      const result = await this.callAIService(service, model, prompt, apiKey);
      const responseTime = Date.now() - startTime;
      const tokens = Math.ceil((prompt.length + JSON.stringify(result).length) / 4);
      this.recordServiceStats(service, true, tokens, responseTime);
      return { success: true, data: result, service, model, cost: this.calculateCost(service, tokens), responseTime };
    } catch (error) {
      this.recordServiceStats(service, false);
      const prompt = await promptService.getPrompt('resume_deep_analysis', {
        resumeText: urlText,
        targetJobSection: ''
      });
      return await this.fallbackToBackupService('url_read', prompt, null, userCtx);
    }
  }

  // 简历结构化抽取
  async extractStructuredData(resumeText, userCtx = null) {
    const startTime = Date.now();
    const { service, model, apiKey } = await this.selectOptimalService('analysis', userCtx);

    try {
      const prompt = await promptService.getPrompt('resume_structuring', {
        resumeText
      });

      console.log(`[AI Structuring] Starting extraction using ${service}/${model}`);
      const result = await this.callAIService(service, model, prompt, apiKey);
      const responseTime = Date.now() - startTime;
      
      const tokens = Math.ceil((prompt.length + (typeof result === 'string' ? result.length : 500)) / 4);
      this.recordServiceStats(service, true, tokens, responseTime);

      const parsed = this.parseJSONResponse(result);
      
      if (!parsed || !parsed.name) {
        console.warn(`[AI Structuring] Extraction results incomplete from ${service}/${model}`);
      }

      return {
        success: true,
        data: parsed,
        service: service,
        model: model,
        responseTime: responseTime
      };
    } catch (error) {
      this.recordServiceStats(service, false);
      console.error(`AI 结构化提取失败 (${service}):`, error.message);
      
      return {
        success: false,
        error: error.message,
        service: service,
        model: model
      };
    }
  }

  // 解析 AI 响应中的 JSON
  parseJSONResponse(text) {
    if (!text) return null;
    if (typeof text === 'object') return text;

    try {
      // 0. 清理可能存在的 BOM 或特殊字符
      let cleanText = text.toString().trim();
      if (cleanText.charCodeAt(0) === 0xFEFF) {
        cleanText = cleanText.slice(1);
      }

      // 1. 尝试直接解析
      try {
        return JSON.parse(cleanText);
      } catch (e) {
        // Continue to other methods
      }

      // 2. 尝试从 Markdown 代码块中提取 (处理可能带有 json 标识的情况)
      const markdownRegex = /```(?:json|JSON)?\s*([\s\S]*?)\s*```/i;
      const match = cleanText.match(markdownRegex);
      if (match && match[1]) {
        try {
          return JSON.parse(match[1].trim());
        } catch (e) {
          // Continue to extract from the matched string
          cleanText = match[1].trim();
        }
      }

      // 3. 尝试提取第一个 { 和最后一个 } 之间的内容 (针对大模型可能带有的解释性文字)
      const firstBrace = cleanText.indexOf('{');
      const lastBrace = cleanText.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const jsonStr = cleanText.substring(firstBrace, lastBrace + 1);
        try {
          return JSON.parse(jsonStr);
        } catch (e) {
          // 4. 处理 JSON 中常见的格式错误 (针对大模型生成的非标准 JSON)
          try {
            // 尝试修复：去除注释、修复末尾逗号、处理转义字符
            const fixedJson = jsonStr
              .replace(/\/\/.*$/gm, '') // 去除单行注释
              .replace(/\/\*[\s\S]*?\*\//g, '') // 去除多行注释
              .replace(/,\s*([}\]])/g, '$1') // 去除对象/数组末尾多余的逗号
              .replace(/\\([^"\\\/bfnrtu])/g, '$1') // 处理不正确的转义字符
              .replace(/[\u0000-\u001F]+/g, ' '); // 处理不可见控制字符
            
            return JSON.parse(fixedJson);
          } catch (e2) {
            // 5. 极端情况：尝试提取不完整但包含关键信息的 JSON 结构
            // 如果解析仍然失败，记录错误并返回 null
            console.error('[AI Service] JSON parsing still failed after cleanup attempts:', e2.message);
          }
        }
      }
    } catch (innerError) {
      console.error('[AI Service] JSON parse error:', innerError.message);
      console.debug('[AI Service] Failed text snippet:', typeof text === 'string' ? text.substring(0, 200) : 'Non-string data');
    }
    return null;
  }

  validateQuickScore(obj) {
    if (!obj || typeof obj !== 'object') return false;
    if (typeof obj.overall_score !== 'number') return false;
    if (obj.overall_score < 0 || obj.overall_score > 100) return false;
    return true;
  }

  // 职位匹配
  async matchJobs(resumeText, jobs, userCtx = null) {
    const startTime = Date.now();
    const { service, model, apiKey } = await this.selectOptimalService('job_matching', userCtx);

    try {
      const prompt = await promptService.getPrompt('resume_quick_score', {
        resumeText,
        jobDescriptionSection: promptService.prepareJobDescriptionVar(JSON.stringify(jobs))
      });
      const result = await this.callAIService(service, model, prompt, apiKey);
      const responseTime = Date.now() - startTime;
      
      const tokens = Math.ceil((prompt.length + JSON.stringify(result).length) / 4);
      this.recordServiceStats(service, true, tokens, responseTime);

      let parsed = this.parseJSONResponse(result);
      if (!this.validateQuickScore(parsed)) {
        throw new Error('INVALID_JSON_RESPONSE');
      }

      return {
        success: true,
        data: parsed,
        service: service,
        model: model,
        cost: this.calculateCost(service, tokens),
        responseTime: responseTime
      };
    } catch (error) {
      this.recordServiceStats(service, false);
      const prompt = await promptService.getPrompt('resume_quick_score', {
        resumeText,
        jobDescriptionSection: promptService.prepareJobDescriptionVar(JSON.stringify(jobs))
      });
      return await this.fallbackToBackupService('job_matching', prompt, null, userCtx);
    }
  }

  // 内容生成
  async generateContent(type, data, userCtx = null) {
    const startTime = Date.now();
    const { service, model, apiKey } = await this.selectOptimalService('content_generation', userCtx);

    try {
      let prompt;
      const dataJson = JSON.stringify(data, null, 2);
      
      switch (type) {
        case 'resume_summary':
          prompt = await promptService.getPrompt('resume_deep_analysis', { 
              resumeText: dataJson,
              targetJobSection: '请根据以上数据生成简历摘要。'
          });
          break;
        case 'cover_letter':
          prompt = await promptService.getPrompt('resume_deep_analysis', { 
              resumeText: dataJson,
              targetJobSection: '请根据以上数据生成求职信。'
          });
          break;
        case 'job_description':
          prompt = await promptService.getPrompt('resume_deep_analysis', { 
              resumeText: dataJson,
              targetJobSection: '请根据以上数据优化职位描述。'
          });
          break;
        default:
          prompt = data.prompt || '请生成相关内容';
      }

      const result = await this.callAIService(service, model, prompt, apiKey);
      const responseTime = Date.now() - startTime;
      
      const tokens = Math.ceil((prompt.length + result.length) / 4);
      this.recordServiceStats(service, true, tokens, responseTime);

      return {
        success: true,
        data: result,
        service: service,
        model: model,
        cost: this.calculateCost(service, tokens),
        responseTime: responseTime
      };
    } catch (error) {
      this.recordServiceStats(service, false);
      let prompt;
      const dataJson = JSON.stringify(data, null, 2);
      switch (type) {
        case 'resume_summary':
          prompt = await promptService.getPrompt('resume_deep_analysis', { 
              resumeText: dataJson,
              targetJobSection: '请根据以上数据生成简历摘要。'
          });
          break;
        case 'cover_letter':
          prompt = await promptService.getPrompt('resume_deep_analysis', { 
              resumeText: dataJson,
              targetJobSection: '请根据以上数据生成求职信。'
          });
          break;
        case 'job_description':
          prompt = await promptService.getPrompt('resume_deep_analysis', { 
              resumeText: dataJson,
              targetJobSection: '请根据以上数据优化职位描述。'
          });
          break;
        default:
          prompt = data.prompt || '请生成相关内容';
      }
      return await this.fallbackToBackupService('content_generation', prompt, null, userCtx);
    }
  }

  // 通用聊天（多轮消息）
  async chat(messages, userCtx = null) {
    const startTime = Date.now();
    const { service, model, apiKey } = await this.selectOptimalService('chat', userCtx);
    try {
      // 从提示词模板获取系统身份设定
      const systemPrompt = await promptService.getPrompt('chat', { message: '' });
      
      // 构建包含系统提示词的消息列表
      const finalMessages = [
        { role: 'system', content: systemPrompt },
        ...messages
      ];

      const result = await this.callAIService(service, model, finalMessages, apiKey);
      const responseTime = Date.now() - startTime;
      const tokens = Math.ceil(JSON.stringify(finalMessages).length / 4);
      this.recordServiceStats(service, true, tokens, responseTime);
      return { success:true, data: result, service, model, cost: this.calculateCost(service, tokens), responseTime };
    } catch (error) {
      console.error(`[AI Service] Chat failed with service ${service} / ${model}:`, error.message);
      if (error.response) {
          console.error('[AI Service] Response data:', JSON.stringify(error.response.data));
      }
      this.recordServiceStats(service, false);
      const fb = await this.fallbackToBackupService('chat', messages, userCtx);
      return fb;
    }
  }

  // 调用AI服务
  async callAIService(service, model, promptOrMessages, apiKey = null, force = false) {
    if (String(service).toUpperCase() === 'MOCK') {
      return this.buildMockResponse(promptOrMessages);
    }
    const originalProvider = this.getOriginalProviderName(service);
    
    const config = this.getServiceConfig(service, apiKey);
    
    // 使用 OpenAI SDK 调用兼容的服务
    const supportedProviders = ['SILICONFLOW', 'GLM', 'QWEN', 'DEEPSEEK'];
    if (supportedProviders.includes(originalProvider)) {
      return await this.callOpenAICompatible(originalProvider, config, model, promptOrMessages, force);
    }

    throw new Error(`不支持的服务: ${service} (Mapped to: ${originalProvider})`);
  }

  // 调用OpenAI SDK调用兼容的服务
  async callOpenAICompatible(provider, config, model, promptOrMessages, force = false) {
    const auth = config && config.headers ? config.headers.Authorization : null;
    const apiKey = auth ? String(auth).replace('Bearer ', '') : '';
    console.log(`[AI Service] Calling OpenAI compatible service: ${provider}, Model: ${model}, BaseURL: ${config.baseURL}${force ? ' (FORCED)' : ''}`);
    
    const client = new OpenAI({
      apiKey: apiKey,
      baseURL: config.baseURL,
      timeout: config.timeout
    });
    
    let messages = Array.isArray(promptOrMessages) ? promptOrMessages : [{ role: 'user', content: promptOrMessages }];
    
    // 如果是强制重新解析，增加一个随机标识符以绕过可能的 API 服务商缓存
    if (force) {
        const timestamp = new Date().toISOString();
        const nonce = Math.random().toString(36).substring(7);
        messages = [
            { role: 'system', content: `Current Request ID: ${timestamp}-${nonce}. Please provide a completely fresh and independent evaluation for this request, ignoring any previous context.` },
            ...messages
        ];
    }

    const maxTries = 3;
    let tries = 0;
    let lastErr = null;
    while (tries < maxTries) {
      try {
        const response = await client.chat.completions.create({
          model: AI_SERVICES[provider].models[model] || model,
          messages,
          temperature: force ? 0.5 : 0.3, // 强制重新解析时稍微提高随机性
          max_tokens: 4000
        });
        const content = response.choices[0].message.content;
        return content;
      } catch (e) {
        lastErr = e;
        console.error(`[AI Service] Attempt ${tries + 1} failed for ${provider}/${model}:`, e.message);
        if (e.response) {
            console.error(`[AI Service] Response error:`, JSON.stringify(e.response.data));
        }
        const code = String(e && e.status || '');
        if (code === '401' || code === '403') break;
        const delay = Math.min(800 * Math.pow(2, tries), 3000);
        await new Promise(rs => setTimeout(rs, delay));
        tries++;
      }
    }
    console.error(`[AI Service] All attempts failed for ${provider}/${model}. Final error:`, lastErr.message);
    throw lastErr || new Error('AI_REQUEST_FAILED');
  }


  // 简历对比
  async compareResumes(resumeList, jobDescription = '') {
    // 兼容旧调用方式
    if (arguments.length === 2 && typeof arguments[0] === 'string') {
      return this.compareResumes([{id:'A', name:'简历A', text:arguments[0]}, {id:'B', name:'简历B', text:arguments[1]}], jobDescription);
    }

    const startTime = Date.now();
    const { service, model, apiKey } = await this.selectOptimalService('resume_compare');

    try {
      // Build resumesText logic inline
      let resumesText = '';
      resumeList.forEach((r, index) => {
          const label = String.fromCharCode(65 + index); // A, B, C...
          resumesText += `简历${label} (文件名: ${r.name}):\n${r.text.substring(0, 3000)}\n\n`; 
      });

      const prompt = await promptService.getPrompt('resume_compare', {
        resumesText,
        jobDescriptionSection: promptService.prepareJobDescriptionVar(jobDescription)
      });

      const result = await this.callAIService(service, model, prompt, apiKey);
      const responseTime = Date.now() - startTime;
      
      const tokens = Math.ceil((prompt.length + JSON.stringify(result).length) / 4);
      this.recordServiceStats(service, true, tokens, responseTime);

      // 解析 AI 响应中的 JSON
      const parsed = this.parseJSONResponse(result);
      if (!parsed) {
        throw new Error('无法从 AI 响应中解析出有效的对比 JSON 结构');
      }

      // 验证候选人数量，确保没有遗漏
      if (!parsed.candidates || !Array.isArray(parsed.candidates)) {
        throw new Error('AI 返回的数据缺少 candidates 数组');
      }
      if (parsed.candidates.length < resumeList.length) {
        throw new Error(`AI 返回的候选人数量(${parsed.candidates.length})少于输入(${resumeList.length})，触发重试`);
      }

      return {
        success: true,
        data: parsed,
        service: service,
        model: model,
        cost: this.calculateCost(service, tokens),
        responseTime: responseTime
      };
    } catch (error) {
      this.recordServiceStats(service, false);
      console.error(`[AI Service] Compare resumes failed with ${service}:`, error.message);
      
      // Fallback mechanism
      try {
        let resumesText = '';
        resumeList.forEach((r, index) => {
            const label = String.fromCharCode(65 + index);
            resumesText += `简历${label} (文件名: ${r.name}):\n${r.text.substring(0, 3000)}\n\n`; 
        });

        const prompt = await promptService.getPrompt('resume_compare', {
          resumesText,
          jobDescriptionSection: promptService.prepareJobDescriptionVar(jobDescription)
        });

        return await this.fallbackToBackupService('resume_compare', prompt, null);
      } catch (fallbackError) {
        return { success: false, error: error.message };
      }
    }
  }

  // 回退到备用服务
  async fallbackToBackupService(taskType, ...args) {
    console.log(`主服务失败，尝试备用服务处理任务: ${taskType}`);
    const userCtx = args.length >= 3 ? args[2] : null;
    const enabledKeys = await this.getEnabledModelKeys(userCtx);
    for (const svc of SERVICE_PRIORITY) {
      const keysOfSvc = enabledKeys.filter(k => k.provider === svc);
      // 只要数据库中有key，就尝试使用
      if (keysOfSvc.length) {
        try {
          const idx = this.nextIndexForService(svc, keysOfSvc.length);
          const chosen = keysOfSvc[idx];
          const result = await this.callAIService(svc, chosen.model, args[0], chosen.apiKey);
          // 确保解析 JSON
          const parsed = this.parseJSONResponse(result);
          return { success:true, data: parsed || result, service: svc, model: chosen.model, fallback:true };
        } catch (e) { continue }
      }
    }
    // 尝试其他可用服务 (SystemConfig/Env)
    for (const service of SERVICE_PRIORITY) {
      if (this.isServiceAvailable(service)) {
        try {
          const models = Object.keys(AI_SERVICES[service].models);
          const result = await this.callAIService(service, models[0], args[0]);
          // 确保解析 JSON
          const parsed = this.parseJSONResponse(result);

          // 【关键修复】如果是简历对比任务，必须验证完整性并做前端兼容
          if (taskType === 'resume_compare' && parsed) {
             if (!parsed.resumes && parsed.candidates) {
                parsed.resumes = parsed.candidates.map(c => ({
                  ...c,
                  scores: c.scores_percent || c.scores || {}
                }));
             }
             if (!parsed.dimensions) {
                parsed.dimensions = ['skills', 'experience', 'education', 'stability', 'potential', 'teamwork'];
             }
          }

          return {
            success: true,
            data: parsed || result,
            service: service,
            model: models[0],
            fallback: true
          };
        } catch (error) {
          console.log(`备用服务 ${service} 也失败了:`, error.message);
          continue;
        }
      }
    }
    if (process.env.ALLOW_MOCK_AI === '1' || process.env.NODE_ENV !== 'production') {
      return { success: true, data: this.buildMockResponse(args[0]), service: 'MOCK', model: 'mock', fallback: true };
    }
    return { success: false, error: '所有AI服务均不可用，请检查API Key配置。' };
  }

  buildMockResponse(promptOrMessages) {
    const content = Array.isArray(promptOrMessages)
      ? promptOrMessages.map(m => m && m.content ? String(m.content) : '').join('\n')
      : String(promptOrMessages || '');

    const hash = Array.from(Buffer.from(content)).reduce((acc, b) => (acc + b) % 997, 0);
    const clamp = (n) => Math.max(0, Math.min(100, n));
    const base = 70 + (hash % 21);

    const scores = {
      skills: clamp(base + 3),
      experience: clamp(base + 1),
      education: clamp(base - 2),
      stability: clamp(base - 1),
      potential: clamp(base + 2),
      teamwork: clamp(base + 4)
    };

    const overall = clamp(Math.round((scores.skills + scores.experience + scores.education + scores.stability + scores.potential + scores.teamwork) / 6));

    if (content.includes('对比') || content.includes('简历A') || content.includes('简历B')) {
      return {
        candidates: [
          { overall_score: overall, scores_percent: scores, evaluation_report: { summary: '候选人A综合表现稳健，技术与协作能力较突出。' } },
          { overall_score: clamp(overall - 5), scores_percent: { ...scores, stability: clamp(scores.stability - 5) }, evaluation_report: { summary: '候选人B潜力良好，但稳定性与经验契合需进一步验证。' } }
        ],
        recommendation: {
          winner: 'A',
          reason: '综合得分更高，风险更可控，岗位匹配更稳定。'
        }
      };
    }

    return {
      overall_score: overall,
      scores_percent: scores,
      evaluation_report: {
        summary: '系统当前未配置可用 AI 服务，已返回可用的示例深度分析报告（用于联调与演示）。',
        strengths: ['技术栈覆盖较全面', '沟通表达清晰', '学习能力与适应性较好'],
        weaknesses: ['核心项目细节需进一步核实', '部分维度证据不足'],
        suggestions: ['补充关键项目的量化指标与职责边界', '结合岗位 JD 进行针对性二次面试'],
        hiring_advice: '建议进入下一轮面试，重点验证核心项目与稳定性。'
      }
    };
  }

  // 获取服务统计信息
  getServiceStats() {
    return {
      services: this.serviceStats,
      totalCost: Object.values(this.costTracker).reduce((sum, cost) => sum + cost, 0),
      serviceAvailability: SERVICE_PRIORITY.map(service => ({
        service,
        available: this.isServiceAvailable(service),
        failureCount: this.serviceFailures[service] || 0
      }))
    };
  }

  // 重置服务状态
  resetServiceStats() {
    this.initializeServices();
  }

  // 获取可用服务列表
  getAvailableServices() {
    return Object.keys(AI_SERVICES).map(service => ({
      name: service,
      models: Object.keys(AI_SERVICES[service].models),
      available: this.isServiceAvailable(service),
      pricing: AI_SERVICES[service].pricing
    }));
  }

  // 检查服务状态
  async checkServiceStatus() {
    await this.loadAIConfig();
    const status = {};
    for (const service of SERVICE_PRIORITY) {
      try {
        const cfg = this.getServiceConfig(service);
        const prov = this.getProviderConfig(service);
        if (!this.isServiceAvailable(service)) {
          status[service] = { available: false, lastFailure: this.serviceFailures[service], stats: this.serviceStats[service] };
          continue;
        }
        
        const originalProvider = this.getOriginalProviderName(service);
        const modelKey = prov && prov.model ? prov.model : (Object.keys(AI_SERVICES[originalProvider]?.models || {})[0] || '');
        const remoteModel = (AI_SERVICES[originalProvider]?.models || {})[modelKey] || modelKey;
        
        // 统一使用 OpenAI SDK 方式进行探活
        const client = new OpenAI({
          apiKey: cfg.headers.Authorization.replace('Bearer ', ''),
          baseURL: cfg.baseURL,
          timeout: 5000 // 探活超时设置短一点
        });

        try {
          await client.chat.completions.create({
            model: remoteModel,
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 1
          });
          status[service] = { available: true, lastFailure: 0, stats: this.serviceStats[service] };
        } catch (e) {
          console.error(`[AI Service] Status check failed for ${service}:`, e.message);
          status[service] = { available: false, lastFailure: this.serviceFailures[service], stats: this.serviceStats[service], error: e.message };
        }
      } catch (err) {
        status[service] = { available: false, lastFailure: this.serviceFailures[service], stats: this.serviceStats[service], error: err.message };
      }
    }
    return status;
  }
  // 读取数据库中启用的模型密钥（公司优先，次选全局）
  async getEnabledModelKeys(userCtx) {
    const where = {}; // Removed enabled check due to DB schema mismatch
    const companyId = userCtx && userCtx.company_id ? userCtx.company_id : null;
    let keys = [];
    try {
      if (companyId) {
        keys = await ModelKey.findAll({ where: { ...where, company_id: companyId } });
      }
      if (!keys || keys.length === 0) {
        const more = await ModelKey.findAll({ where: { ...where, scope: 'global' } });
        keys = more || [];
      }
    } catch (e) { 
        console.error('Error fetching model keys:', e);
        keys = [] 
    }

    await this.loadAIConfig();
    const configProviders = (this.aiConfig && this.aiConfig.providers) ? this.aiConfig.providers : {};

    let out = keys.map(k => {
        const provider = String(k.provider).toUpperCase();
        let model = k.model;
        // If model is missing in DB key (or DB schema mismatch), try to find it in SystemConfig
        if (!model) {
            // Try exact match or upper case match in config
            const p = configProviders[provider] || configProviders[Object.keys(configProviders).find(key => key.toUpperCase() === provider)];
            if (p && p.model) model = p.model;
        }
        // If still missing, pick first available from static config
        if (!model && AI_SERVICES[provider]) {
             const models = Object.keys(AI_SERVICES[provider].models);
             if (models.length) model = models[0];
        }
        return { provider, model, apiKey: k.api_key };
    });

    // 如果数据库没有配置，回退读取 SystemConfig: ai_config.providers
    if (!out.length) {
      const providers = configProviders;
      for (const name in providers) {
        const p = providers[name];
        if (!p) continue;
        const enabled = typeof p.enabled === 'boolean' ? p.enabled : true;
        const apiKey = p.apiKey || p.api_key || '';
        if (!enabled || !apiKey) continue;
        const svc = String(name).toUpperCase();
        const models = AI_SERVICES[svc] ? Object.keys(AI_SERVICES[svc].models) : [];
        const model = p.model || (models.length ? models[0] : '');
        out.push({ provider: svc, model, apiKey });
      }
    }
    return out;
  }

  // 轮询索引
  nextIndexForService(service, len) {
    if (!this._rr) this._rr = {};
    const cur = this._rr[service] || 0;
    const next = (cur + 1) % len;
    this._rr[service] = next;
    return cur;
  }
}

module.exports = DomesticAIService;
