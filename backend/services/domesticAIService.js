const axios = require('axios');
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
    
    const defaultBaseUrl = AI_SERVICES[originalProvider] ? AI_SERVICES[originalProvider].baseUrl : '';
    const baseURL = p && p.baseUrl ? p.baseUrl : defaultBaseUrl;
    
    const apiKey = apiKeyOverride || (p && p.apiKey ? p.apiKey : (
      originalProvider === 'MODELSCOPE' ? process.env.MODELSCOPE_API_KEY :
      originalProvider === 'SILICONFLOW' ? process.env.SILICONFLOW_API_KEY :
      originalProvider === 'GLM' ? process.env.GLM_API_KEY :
      originalProvider === 'QWEN' ? process.env.QWEN_API_KEY :
      originalProvider === 'KIMI' ? process.env.KIMI_API_KEY :
      originalProvider === 'MINIMAX' ? process.env.MINIMAX_API_KEY :
      originalProvider === 'DEEPSEEK' ? process.env.DEEPSEEK_API_KEY : ''
    ));
    const headers = {};
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    if (service === 'QWEN') headers['Content-Type'] = 'application/json';
    const timeout = (p && typeof p.timeout === 'number' && p.timeout > 0)
      ? p.timeout
      : (process.env.AI_TIMEOUT_MS ? parseInt(process.env.AI_TIMEOUT_MS, 10) : 30000);
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
      MODELSCOPE: process.env.MODELSCOPE_API_KEY,
      SILICONFLOW: process.env.SILICONFLOW_API_KEY,
      GLM: process.env.GLM_API_KEY,
      QWEN: process.env.QWEN_API_KEY,
      KIMI: process.env.KIMI_API_KEY,
      MINIMAX: process.env.MINIMAX_API_KEY,
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
      const prompt = `作为一个资深的招聘专家，请根据以下招聘数据进行非量化的、模糊的趋势预测分析。
数据概览：
${JSON.stringify(data, null, 2)}

要求：
1. 不要进行具体的数字预测（如"下周将收到5份简历"），而是给出趋势性的描述（如"简历投递量呈现稳步增长趋势"、"面试转化率近期有所放缓"）。
2. 分析招聘漏斗的健康度，指出可能存在的瓶颈。
3. 给出针对性的改进建议。
4. 语言风格要专业、客观但具有前瞻性。

请返回如下 JSON 格式：
{
  "trend_analysis": "一段关于招聘趋势的文字描述...",
  "pipeline_health": "一段关于漏斗健康度的定性评价...",
  "potential_bottlenecks": ["瓶颈1", "瓶颈2"],
  "suggestions": ["建议1", "建议2"]
}`;

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
      // 降级处理
      return {
        success: true,
        data: {
            trend_analysis: "当前招聘活动保持平稳，建议持续关注关键岗位的候选人储备。",
            pipeline_health: "招聘漏斗运转正常",
            potential_bottlenecks: ["暂未发现明显瓶颈"],
            suggestions: ["继续保持当前的招聘节奏", "定期复盘招聘渠道效果"]
        },
        service: 'FALLBACK',
        model: 'fallback'
      };
    }
  }

  // 简历分析
  async analyzeResume(resumeText, jobDescription = '', userCtx = null) {
    const startTime = Date.now();
    const { service, model, apiKey } = await this.selectOptimalService('resume_analysis', userCtx);

    try {
      const prompt = await promptService.getPrompt('resume_analysis', {
        resumeText,
        jobDescriptionSection: promptService.prepareJobDescriptionVar(jobDescription)
      });
      const result = await this.callAIService(service, model, prompt, apiKey);
      const responseTime = Date.now() - startTime;
      
      // 估算token数量（简化计算）
      const tokens = Math.ceil((prompt.length + JSON.stringify(result).length) / 4);
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
      
      // 尝试使用备用服务
      const prompt = await promptService.getPrompt('resume_analysis', {
        resumeText,
        jobDescriptionSection: promptService.prepareJobDescriptionVar(jobDescription)
      });
      return await this.fallbackToBackupService('resume_analysis', prompt, null, userCtx);
    }
  }

  async analyzeUrlResume(urlText, userCtx = null) {
    const startTime = Date.now();
    const { service, model, apiKey } = await this.selectOptimalService('url_read', userCtx);
    try {
      const prompt = await promptService.getPrompt('resume_analysis', {
        resumeText: urlText,
        jobDescriptionSection: ''
      });
      const result = await this.callAIService(service, model, prompt, apiKey);
      const responseTime = Date.now() - startTime;
      const tokens = Math.ceil((prompt.length + JSON.stringify(result).length) / 4);
      this.recordServiceStats(service, true, tokens, responseTime);
      return { success: true, data: result, service, model, cost: this.calculateCost(service, tokens), responseTime };
    } catch (error) {
      this.recordServiceStats(service, false);
      const prompt = await promptService.getPrompt('resume_analysis', {
        resumeText: urlText,
        jobDescriptionSection: ''
      });
      return await this.fallbackToBackupService('url_read', prompt, null, userCtx);
    }
  }

  // 职位匹配
  async matchJobs(resumeText, jobs, userCtx = null) {
    const startTime = Date.now();
    const { service, model, apiKey } = await this.selectOptimalService('job_matching', userCtx);

    try {
      const prompt = await promptService.getPrompt('job_matching', {
        resumeText,
        jobsJson: JSON.stringify(jobs, null, 2)
      });
      const result = await this.callAIService(service, model, prompt, apiKey);
      const responseTime = Date.now() - startTime;
      
      const tokens = Math.ceil((prompt.length + JSON.stringify(result).length) / 4);
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
      const prompt = await promptService.getPrompt('job_matching', {
        resumeText,
        jobsJson: JSON.stringify(jobs, null, 2)
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
          prompt = await promptService.getPrompt('content_gen_resume_summary', { dataJson });
          break;
        case 'cover_letter':
          prompt = await promptService.getPrompt('content_gen_cover_letter', { dataJson });
          break;
        case 'job_description':
          prompt = await promptService.getPrompt('content_gen_job_description', { dataJson });
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
          prompt = await promptService.getPrompt('content_gen_resume_summary', { dataJson });
          break;
        case 'cover_letter':
          prompt = await promptService.getPrompt('content_gen_cover_letter', { dataJson });
          break;
        case 'job_description':
          prompt = await promptService.getPrompt('content_gen_job_description', { dataJson });
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
      const result = await this.callAIService(service, model, messages, apiKey);
      const responseTime = Date.now() - startTime;
      const tokens = Math.ceil(JSON.stringify(messages).length / 4);
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
    const config = this.getServiceConfig(service, apiKey);
    const originalProvider = this.getOriginalProviderName(service);
    
    switch (originalProvider) {
      case 'MODELSCOPE':
        return await this.callModelScope(config, model, promptOrMessages);
      case 'SILICONFLOW':
        return await this.callSiliconFlow(config, model, promptOrMessages);
      case 'GLM':
        return await this.callGLM(config, model, promptOrMessages);
      case 'QWEN':
        return await this.callQwen(config, model, promptOrMessages);
      case 'KIMI':
        return await this.callKimi(config, model, promptOrMessages);
      case 'MINIMAX':
        return await this.callMiniMax(config, model, promptOrMessages);
      case 'DEEPSEEK':
        return await this.callDeepSeek(config, model, promptOrMessages);
      case 'MOCK':
        return await this.callMockService(model, promptOrMessages);
      default:
        throw new Error(`不支持的服务: ${service} (Mapped to: ${originalProvider})`);
    }
  }

  // 调用魔搭服务
  async callModelScope(config, model, promptOrMessages) {
    const response = await axios.post(
      `${config.baseURL}/chat/completions`,
      {
        model: AI_SERVICES.MODELSCOPE.models[model] || model,
        messages: Array.isArray(promptOrMessages) ? promptOrMessages : [{ role: 'user', content: promptOrMessages }],
        temperature: 0.7,
        max_tokens: 2000
      },
      config
    );

    return response.data.choices[0].message.content;
  }

  // 调用硅基流动服务
  async callSiliconFlow(config, model, promptOrMessages) {
    const response = await axios.post(
      `${config.baseURL}/chat/completions`,
      {
        model: AI_SERVICES.SILICONFLOW.models[model] || model,
        messages: Array.isArray(promptOrMessages) ? promptOrMessages : [{ role: 'user', content: promptOrMessages }],
        temperature: 0.7,
        max_tokens: 2000
      },
      config
    );

    return response.data.choices[0].message.content;
  }

  // 调用GLM服务
  async callGLM(config, model, promptOrMessages) {
    const response = await axios.post(
      `${config.baseURL}/chat/completions`,
      {
        model: AI_SERVICES.GLM.models[model] || model,
        messages: Array.isArray(promptOrMessages) ? promptOrMessages : [{ role: 'user', content: promptOrMessages }],
        temperature: 0.7,
        max_tokens: 2000
      },
      config
    );

    return response.data.choices[0].message.content;
  }

  // 调用千问服务
  async callQwen(config, model, promptOrMessages) {
    const response = await axios.post(
      `${config.baseURL}/api/v1/services/aigc/text-generation/generation`,
      {
        model: AI_SERVICES.QWEN.models[model] || model,
        input: {
          messages: Array.isArray(promptOrMessages) ? promptOrMessages : [{ role: 'user', content: promptOrMessages }]
        },
        parameters: {
          temperature: 0.7,
          max_tokens: 2000
        }
      },
      config
    );

    return response.data.output.choices[0].message.content;
  }

  // 调用 Kimi (Moonshot)
  async callKimi(config, model, promptOrMessages) {
    const response = await axios.post(
      `${config.baseURL}/chat/completions`,
      {
        model: AI_SERVICES.KIMI.models[model] || model,
        messages: Array.isArray(promptOrMessages) ? promptOrMessages : [{ role: 'user', content: promptOrMessages }]
      },
      config
    );
    return response.data.choices?.[0]?.message?.content || '';
  }

  // 调用 MiniMax
  async callMiniMax(config, model, promptOrMessages) {
    const response = await axios.post(
      `${config.baseURL}/text/chatcompletion`,
      {
        model: AI_SERVICES.MINIMAX.models[model] || model,
        messages: Array.isArray(promptOrMessages) ? promptOrMessages : [{ role: 'user', content: promptOrMessages }]
      },
      config
    );
    const out = response.data?.choices?.[0]?.messages?.[0]?.text || response.data?.choices?.[0]?.message || '';
    return out;
  }

  // 调用 DeepSeek
  async callDeepSeek(config, model, promptOrMessages) {
    const response = await axios.post(
      `${config.baseURL}/chat/completions`,
      {
        model: AI_SERVICES.DEEPSEEK.models[model] || model,
        messages: Array.isArray(promptOrMessages) ? promptOrMessages : [{ role: 'user', content: promptOrMessages }]
      },
      config
    );
    return response.data?.choices?.[0]?.message?.content || '';
  }

  // 调用 Mock 服务
  async callMockService(model, promptOrMessages) {
    await new Promise(resolve => setTimeout(resolve, 1500)); // 模拟延迟

    // 判断是简历分析还是简历对比
    const input = Array.isArray(promptOrMessages) 
      ? promptOrMessages.map(m => m.content).join('\n') 
      : promptOrMessages;

    if (input.includes('comparison_table') || input.includes('对比报告')) {
      return JSON.stringify({
        radar_scores: {
          job_match: {"A": 4, "B": 3},
          skill_match: {"A": 5, "B": 4},
          experience_match: {"A": 3, "B": 5},
          learning_ability: {"A": 4, "B": 4},
          teamwork: {"A": 4, "B": 5}
        },
        comparison_table: [
          {
            "dimension": "教育背景", 
            "A": "重点大学硕士，计算机专业，学术背景扎实。", 
            "B": "本科学历，但有相关专业认证。", 
            "winner": "A", 
            "comment": "A的学历层次更高，专业对口。"
          },
          {
            "dimension": "工作经验", 
            "A": "3年大厂经验，参与过核心项目。", 
            "B": "5年创业公司经验，全栈能力强。", 
            "winner": "B", 
            "comment": "B的实战经验更丰富，适应性可能更强。"
          },
          {
            "dimension": "技能专长", 
            "A": "精通Java后端，熟悉分布式系统。", 
            "B": "熟悉Node.js/Python，擅长快速开发。", 
            "winner": "Tie", 
            "comment": "各有侧重，取决于具体岗位需求。"
          }
        ],
        recommendation: {
          "winner": "A", 
          "reason": "考虑到岗位对基础架构的要求，A的系统性思维和教育背景更匹配。"
        },
        summary_report: "两份简历都非常优秀。候选人A学术背景好，适合攻坚核心技术；候选人B实战经验丰富，适合业务快速迭代。建议根据当前团队短板选择。"
      });
    }

    // 默认简历分析
    return JSON.stringify({
      basic_info: { 
        name: "张三 (模拟)", 
        email: "zhangsan@example.com", 
        phone: "13800138000", 
        location: "北京", 
        age: "28", 
        education: "硕士", 
        school: "北京科技大学", 
        work_years: "5年", 
        last_company: "某知名互联网公司", 
        last_position: "高级后端工程师", 
        salary_expectation: "30k-45k" 
      },
      education_background: [ 
        { "school": "北京科技大学", "degree": "硕士", "major": "计算机科学与技术", "start_date": "2018-09", "end_date": "2021-06" },
        { "school": "北京科技大学", "degree": "本科", "major": "软件工程", "start_date": "2014-09", "end_date": "2018-06" }
      ],
      work_experience: [ 
        { "company": "某知名互联网公司", "title": "高级后端工程师", "start_date": "2021-07", "end_date": "至今", "responsibilities": "负责核心交易系统的设计与开发，优化高并发场景下的系统性能。" } 
      ],
      project_experience: [ 
        { "name": "分布式交易系统重构", "role": "核心开发", "stack": ["Java", "Spring Boot", "MySQL", "Redis"], "description": "对老旧交易系统进行微服务化重构。", "impact": "系统吞吐量提升50%，故障率降低90%。" } 
      ],
      skills_certifications: { 
        "skills": ["Java", "Python", "Spring Cloud", "MySQL", "Docker", "Kubernetes"], 
        "certifications": ["PMP", "AWS Certified Solutions Architect" ] 
      },
      self_evaluation: "热爱技术，善于解决复杂问题，有良好的团队协作精神。",
      evaluation_report: {
        "core_strengths": ["扎实的计算机基础", "丰富的高并发实战经验", "良好的系统设计能力"],
        "potential_issues": ["前端技术相对薄弱", "团队管理经验尚缺"],
        "career_advice": ["建议深入研究云原生架构", "可以尝试带领小型团队，提升管理能力"]
      },
      radar_scores: {
        "job_match": 4,
        "skill_match": 5,
        "experience_match": 4,
        "learning_ability": 4,
        "teamwork": 5
      },
      overall_score: 88,
      summary: "该候选人（模拟数据）具备扎实的技术功底和丰富的实战经验，非常适合后端开发相关的高级岗位。建议重点考察其在复杂系统设计方面的具体思路。"
    });
  }

  // 构建简历分析提示词
  buildResumeAnalysisPrompt(resumeText, jobDescription) {
    return `你是资深人力资源分析师。请对以下简历进行结构化解析与评估，并严格返回 JSON（不包含任何额外文本）。

输入说明：已为你提供从 PDF/Word/网页抽取的纯文本：
${resumeText}

${jobDescription ? `目标职位描述：
${jobDescription}
` : ''}

请输出如下 JSON 结构（字段必须存在，允许为空；中文内容优先）：
{
  "basic_info": { "name": "", "email": "", "phone": "", "location": "", "age": "", "education": "", "school": "", "work_years": "", "last_company": "", "last_position": "", "salary_expectation": "" },
  "education_background": [ { "school": "", "degree": "", "major": "", "start_date": "", "end_date": "" } ],
  "work_experience": [ { "company": "", "title": "", "start_date": "", "end_date": "", "responsibilities": "" } ],
  "project_experience": [ { "name": "", "role": "", "stack": [""], "description": "", "impact": "" } ],
  "skills_certifications": { "skills": [""], "certifications": ["" ] },
  "self_evaluation": "",
  "evaluation_report": {
    "core_strengths": ["专业技能/项目亮点/职业稳定性"],
    "potential_issues": ["经验断层/技能短板/职业规划模糊"],
    "career_advice": ["技能提升方向/岗位推荐/成长路径"]
  },
  "radar_scores": {
    "job_match": 3,
    "skill_match": 3,
    "experience_match": 3,
    "learning_ability": 3,
    "teamwork": 3
  },
  "overall_score": 85,
  "summary": "100-150字总结候选人的整体情况"
}

要求：
- 结合文本上下文做合理推断并在缺失处补全，但避免杜撰；
- 如为推断请在对应字符串尾部加上“（推断）”；
- radar_scores 中的评分范围 1-5（整数）；
- 返回必须是有效 JSON。`;
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
      return { success: false, error: error.message };
    }
  }

  // 构建简历对比提示词
  buildResumeComparisonPrompt(resumeList, jobDescription = '') {
    let resumesText = '';
    const labels = [];
    resumeList.forEach((r, index) => {
        const label = String.fromCharCode(65 + index); // A, B, C...
        labels.push(label);
        resumesText += `简历${label} (文件名: ${r.name}):\n${r.text.substring(0, 3000)}\n\n`; 
    });

    return `你是资深人力资源专家。请对比以下${resumeList.length}份简历，并严格依据目标岗位与简历文本证据做客观评估，仅返回有效 JSON（不包含代码块）。

${resumesText}

${jobDescription ? `目标职位（JD）：\n${jobDescription}\n` : ''}

评估规则：
1) 评分范围 1-5：1=不符合/无证据，2=较弱/证据有限，3=一般，4=较强，5=高度匹配/多处证据。
2) 禁止编造信息；每项结论需提供证据片段。
3) global_scores = 将 radar_scores 按权重计算到百分制（job_match 25%、skill_match 40%、experience_match 25%、learning_ability 5%、teamwork 5%），取整。
4) winner 与最高 global_scores 保持一致；若分数相同则为 Tie。

请输出如下 JSON 结构：
{
  "radar_scores": {
    "job_match": {"A": 4, "B": 3},
    "skill_match": {"A": 5, "B": 4},
    "experience_match": {"A": 3, "B": 5},
    "learning_ability": {"A": 4, "B": 4},
  "teamwork": {"A": 4, "B": 5}
  },
  "global_scores": {"A": 88, "B": 82},
  "comparison_table": [
    {"dimension": "教育背景", "A": "...", "B": "...", "winner": "A/B/Tie", "comment": "..."},
    {"dimension": "工作经验", "A": "...", "B": "...", "winner": "A/B/Tie", "comment": "..."},
    {"dimension": "技能专长", "A": "...", "B": "...", "winner": "A/B/Tie", "comment": "..."}
  ],
  "recommendation": {
    "winner": "A", 
    "reason": "...",
    "notes": "..."
  },
  "evidence_refs": [
    {"resume": "A", "snippet": "..."},
    {"resume": "B", "snippet": "..."}
  ],
  "summary_report": "..."
}

要求：
- 必须包含所有简历（${labels.join(', ')}）在各维度的评分；
- 必须提供 global_scores 并与推荐结论一致；
- comparison_table 必须覆盖关键维度并给出胜出者；
- 每条结论需在 evidence_refs 中至少提供一个证据片段；
- 返回必须是有效 JSON。`;
  }

  // 构建职位匹配提示词
  buildJobMatchingPrompt(resumeText, jobs) {
    return `请分析简历与以下职位的匹配度：

简历内容：
${resumeText}

职位列表：
${JSON.stringify(jobs, null, 2)}

请返回匹配度最高的前5个职位，格式如下（JSON）：
[
  {
    "job_id": "职位ID",
    "match_score": 85,
    "reason": "匹配原因",
    "recommendations": ["建议1", "建议2"]
  }
]`;
  }

  // 构建内容生成提示词
  buildContentGenerationPrompt(type, data) {
    switch (type) {
      case 'resume_summary':
        return `请根据以下信息生成专业的简历摘要：
${JSON.stringify(data, null, 2)}

要求：简洁、专业、突出关键优势，字数控制在200字以内。`;
      
      case 'cover_letter':
        return `请根据以下信息生成求职信：
${JSON.stringify(data, null, 2)}

要求：格式规范、内容真诚、突出匹配度，字数控制在500字以内。`;
      
      case 'job_description':
        return `请根据以下信息优化职位描述：
${JSON.stringify(data, null, 2)}

要求：清晰、准确、吸引人，突出职位亮点。`;
      
      default:
        return data.prompt || '请生成相关内容';
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
          return { success:true, data: result, service: svc, model: chosen.model, fallback:true };
        } catch (e) { continue }
      }
    }
    // 尝试其他可用服务 (SystemConfig/Env)
    for (const service of SERVICE_PRIORITY) {
      if (this.isServiceAvailable(service)) {
        try {
          const models = Object.keys(AI_SERVICES[service].models);
          const result = await this.callAIService(service, models[0], args[0]);
          return {
            success: true,
            data: result,
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
    try {
      const mock = await this.callMockService('mock', args[0]);
      return { success: true, data: mock, service: 'MOCK', model: 'mock', fallback: true };
    } catch (_) {}
    return { success: false, error: '所有AI服务都不可用' };
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
        const modelKey = prov && prov.model ? prov.model : (Object.keys(AI_SERVICES[service].models)[0] || '');
        const remoteModel = AI_SERVICES[service].models[modelKey] || modelKey;
        let url = '';
        let payload = {};
        if (service === 'QWEN') {
          url = `${cfg.baseURL}/services/aigc/text-generation/generation`;
          payload = { model: remoteModel, input: { messages: [{ role: 'user', content: 'ping' }] }, parameters: { max_tokens: 1 } };
        } else if (service === 'MINIMAX') {
          url = `${cfg.baseURL}/text/chatcompletion`;
          payload = { model: remoteModel, messages: [{ role: 'user', content: 'ping' }] };
        } else {
          url = `${cfg.baseURL}/chat/completions`;
          payload = { model: remoteModel, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 };
        }
        const resp = await axios.post(url, payload, { headers: cfg.headers, timeout: 8000 }).catch(() => null);
        status[service] = { available: !!(resp && resp.status === 200), lastFailure: this.serviceFailures[service], stats: this.serviceStats[service] };
      } catch (_) {
        status[service] = { available: false, lastFailure: this.serviceFailures[service], stats: this.serviceStats[service] };
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
