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
    const timeout = (p && typeof p.timeout === 'number' && p.timeout > 0)
      ? p.timeout
      : (process.env.AI_TIMEOUT_MS ? parseInt(process.env.AI_TIMEOUT_MS, 10) : 120000);
    return { baseURL, timeout, headers };
  }

  // 选择最优服务
  async selectOptimalService(taskType = 'resume_analysis', userCtx = null) {
    // console.log(`[AI Service] Selecting optimal service for task: ${taskType}`);
    
    await this.loadAIConfig();
    // console.log(`[AI Service] Current AI Config TaskMapping:`, this.aiConfig ? JSON.stringify(this.aiConfig.taskMapping) : 'null');

    const mapped = await this.resolveTaskMapping(taskType);
    if (mapped) {
        const available = this.isServiceAvailable(mapped.service);
        // console.log(`[AI Service] Task mapping found: ${mapped.service} / ${mapped.model}, Available: ${available}`);
        if (available) {
            console.log(`[AI Service] Used task mapping: ${mapped.service} / ${mapped.model}`);
            return mapped;
        } else {
            console.warn(`[AI Service] Mapped service ${mapped.service} is not available (Failures: ${this.serviceFailures[mapped.service] || 0}). Falling back.`);
        }
    } else {
        // console.log(`[AI Service] No task mapping found for ${taskType}`);
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

      const result = await this.callAIService(service, model, prompt, apiKey);
      const responseTime = Date.now() - startTime;
      const tokens = Math.ceil((prompt.length + JSON.stringify(result).length) / 4);
      this.recordServiceStats(service, true, tokens, responseTime);

      // 尝试解析JSON，如果失败则封装文本
      let parsed;
      try {
        const text = typeof result === 'string' ? result : JSON.stringify(result);
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
        } else {
            throw new Error('No JSON found');
        }
      } catch (e) {
        parsed = {
            trend_analysis: typeof result === 'string' ? result : "无法生成趋势分析",
            pipeline_health: "暂无数据",
            potential_bottlenecks: [],
            suggestions: []
        };
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
      
      // 如果是明确的 API 错误，抛出异常
      if (error.response && error.response.status === 401) {
          throw new Error(`${service} API Key 无效或已过期`);
      }
      
      // 否则返回降级数据，但标记为 fallback
      return {
        success: false,
        error: error.message,
        data: {
            trend_analysis: "无法生成实时趋势分析，请检查 AI 服务配置。",
            pipeline_health: "服务暂时不可用",
            potential_bottlenecks: [],
            suggestions: ["请在后台检查 AI 模型配置和 API Key"]
        },
        service: 'ERROR',
        model: 'error'
      };
    }
  }

  // 简历分析
  async analyzeResume(resumeText, jobDescription = '', userCtx = null, scene = null) {
    const startTime = Date.now();
    
    // Determine prompt key and task type based on scene
    let promptKey;
    let taskType;

    if (scene === 'talent_pool') {
        promptKey = 'resume_quick_score';
        taskType = 'job_matching';
    } else if (scene === 'deep_analysis' || scene === 'analysis') {
        promptKey = 'resume_deep_analysis';
        taskType = 'resume_analysis';
    } else if (scene === 'supplement_report') {
        promptKey = 'resume_supplement_report';
        taskType = 'resume_analysis';
    } else {
        // Legacy fallback
        promptKey = jobDescription ? 'resume_quick_score' : 'resume_deep_analysis';
        taskType = jobDescription ? 'job_matching' : 'resume_analysis';
    }

    const { service, model, apiKey } = await this.selectOptimalService(taskType, userCtx);

    try {
      let prompt;
      
      if (scene === 'talent_pool') {
          prompt = await promptService.getPrompt('resume_quick_score', {
              resumeText,
              jobDescriptionSection: promptService.prepareJobDescriptionVar(jobDescription)
          });
      } else if (scene === 'deep_analysis' || scene === 'analysis') {
          prompt = await promptService.getPrompt('resume_deep_analysis', {
              resumeText,
              targetJobSection: promptService.prepareTargetJobSection(jobDescription)
          });
      } else if (scene === 'supplement_report') {
          prompt = await promptService.getPrompt('resume_supplement_report', {
              resumeText,
              targetJobSection: promptService.prepareTargetJobSection(jobDescription)
          });
      } else {
          // Original fallback logic
          if (jobDescription) {
            prompt = await promptService.getPrompt('resume_quick_score', {
              resumeText,
              jobDescriptionSection: promptService.prepareJobDescriptionVar(jobDescription)
            });
          } else {
            prompt = await promptService.getPrompt('resume_deep_analysis', {
              resumeText,
              targetJobSection: ''
            });
          }
      }
      
      const result = await this.callAIService(service, model, prompt, apiKey);
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
      
      // 尝试使用备用服务
      let prompt;
      if (scene === 'talent_pool') {
          prompt = await promptService.getPrompt('resume_quick_score', {
              resumeText,
              jobDescriptionSection: promptService.prepareJobDescriptionVar(jobDescription)
          });
      } else if (scene === 'deep_analysis' || scene === 'analysis') {
          prompt = await promptService.getPrompt('resume_deep_analysis', {
              resumeText,
              targetJobSection: promptService.prepareTargetJobSection(jobDescription)
          });
      } else if (scene === 'supplement_report') {
          prompt = await promptService.getPrompt('resume_supplement_report', {
              resumeText,
              targetJobSection: promptService.prepareTargetJobSection(jobDescription)
          });
      } else {
          if (jobDescription) {
            prompt = await promptService.getPrompt('resume_quick_score', {
              resumeText,
              jobDescriptionSection: promptService.prepareJobDescriptionVar(jobDescription)
            });
          } else {
            prompt = await promptService.getPrompt('resume_deep_analysis', {
              resumeText,
              targetJobSection: ''
            });
          }
      }
      return await this.fallbackToBackupService(taskType, prompt, null, userCtx);
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

  // 解析 AI 响应中的 JSON
  parseJSONResponse(text) {
    if (!text) return null;
    if (typeof text === 'object') return text;

    try {
      // 1. 尝试直接解析
      return JSON.parse(text);
    } catch (e) {
      try {
      // 2. 尝试从 Markdown 代码块中提取 (处理可能带有 json 标识的情况)
        const markdownRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
        const match = text.match(markdownRegex);
        if (match && match[1]) {
          return JSON.parse(match[1].trim());
        }

        // 3. 尝试提取第一个 { 和最后一个 } 之间的内容 (针对大模型可能带有的解释性文字)
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          const jsonStr = text.substring(firstBrace, lastBrace + 1);
          return JSON.parse(jsonStr);
        }
      } catch (innerError) {
        console.error('[AI Service] JSON parse error:', innerError.message);
        console.debug('[AI Service] Failed text snippet:', text.substring(0, 200));
      }
    }
    return null;
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

      // 使用通用的解析逻辑
      const parsed = this.parseJSONResponse(result) || {
          overall_score: 0,
          match_level: "未知",
          reason: "解析失败"
      };

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
  async callAIService(service, model, promptOrMessages, apiKey = null) {
    const originalProvider = this.getOriginalProviderName(service);
    
    const config = this.getServiceConfig(service, apiKey);
    
    // 使用 OpenAI SDK 调用兼容的服务
    const supportedProviders = ['SILICONFLOW', 'GLM', 'QWEN', 'DEEPSEEK'];
    if (supportedProviders.includes(originalProvider)) {
      return await this.callOpenAICompatible(originalProvider, config, model, promptOrMessages);
    }

    throw new Error(`不支持的服务: ${service} (Mapped to: ${originalProvider})`);
  }

  // 调用OpenAI SDK调用兼容的服务
  async callOpenAICompatible(provider, config, model, promptOrMessages) {
    const client = new OpenAI({
      apiKey: config.headers.Authorization.replace('Bearer ', ''),
      baseURL: config.baseURL,
      timeout: config.timeout
    });

    const messages = Array.isArray(promptOrMessages) 
      ? promptOrMessages 
      : [{ role: 'user', content: promptOrMessages }];

    console.log(`[AI Service] Calling ${provider} with model ${model}`);
    console.log(`[AI Service] First 200 chars of prompt: ${messages[messages.length-1].content.substring(0, 200)}...`);

    const response = await client.chat.completions.create({
      model: AI_SERVICES[provider].models[model] || model,
      messages: messages,
      temperature: 0.3,
      max_tokens: 2000
    });

    const content = response.choices[0].message.content;
    console.log(`[AI Service] Response received from ${provider}, length: ${content.length}`);
    return content;
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
    // 所有可用服务尝试完毕，不再回退到 MOCK，直接报错
    return { success: false, error: '所有AI服务均不可用，请检查API Key配置。' };
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
