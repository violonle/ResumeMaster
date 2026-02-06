// 国内AI服务配置
const AI_SERVICES = {
  SILICONFLOW: {
    name: '硅基流动',
    baseUrl: 'https://api.siliconflow.cn/v1',
    models: {
      'deepseek-chat': 'deepseek-ai/deepseek-llm-67b-chat',
      'yi-34b-chat': '01-ai/Yi-34B-Chat',
      'qwen-72b-chat': 'qwen/Qwen-72B-Chat',
      'qwen3': 'qwen/Qwen-72B-Chat',
      'Qwen3': 'qwen/Qwen-72B-Chat'
    },
    pricing: {
      'deepseek-chat': 0.002,
      'yi-34b-chat': 0.003,
      'qwen-72b-chat': 0.004
    }
  },
  GLM: {
    name: '智谱GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: {
      'glm-3-turbo': 'glm-3-turbo',
      'glm-4': 'glm-4',
      'glm-4v': 'glm-4v',
      'GLM-4.5-Flash': 'GLM-4.5-Flash'
    },
    pricing: {
      'glm-3-turbo': 0.001,
      'glm-4': 0.005,
      'glm-4v': 0.01,
      'GLM-4.5-Flash': 0.005
    }
  },
  QWEN: {
    name: '通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: {
      'qwen-turbo': 'qwen-turbo',
      'qwen-plus': 'qwen-plus',
      'qwen-max': 'qwen-max'
    },
    pricing: {
      'qwen-turbo': 0.002,
      'qwen-plus': 0.004,
      'qwen-max': 0.008
    }
  },
  DEEPSEEK: {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    models: {
      'deepseek-chat': 'deepseek-chat',
      'deepseek-reasoner': 'deepseek-reasoner'
    },
    pricing: {
      'deepseek-chat': 0.003,
      'deepseek-reasoner': 0.005
    }
  },
  MODELSCOPE: {
    name: '魔搭 ModelScope',
    baseUrl: 'https://api-inference.modelscope.cn/api/v1/inference',
    models: {
      'qwen-2.5-7b': 'Qwen/Qwen2.5-7B-Instruct',
      'qwen-2.5-14b': 'Qwen/Qwen2.5-14B-Instruct',
      'qwen-2.5-32b': 'Qwen/Qwen2.5-32B-Instruct',
      'qwen-2-vl-7b': 'Qwen/Qwen2-VL-7B-Instruct',
      'baichuan2-13b': 'baichuan-inc/Baichuan2-13B-Chat',
      'chatglm3-6b': 'THUDM/chatglm3-6b',
      'yi-34b-200k': '01ai/Yi-34B-Chat-200K',
      'llama-3.1-8b': 'Meta-Llama-3.1-8B-Instruct',
      'llama-3.1-70b': 'Meta-Llama-3.1-70B-Instruct'
    },
    pricing: {
      'qwen-2.5-7b': 0.001,
      'qwen-2.5-14b': 0.002,
      'qwen-2.5-32b': 0.004,
      'qwen-2-vl-7b': 0.002,
      'baichuan2-13b': 0.003,
      'chatglm3-6b': 0.001,
      'yi-34b-200k': 0.004,
      'llama-3.1-8b': 0.002,
      'llama-3.1-70b': 0.006
    }
  }
};

// 服务优先级配置（按稳定性排序）
const SERVICE_PRIORITY = [
  'SILICONFLOW',
  'MODELSCOPE',
  'QWEN',
  'GLM',
  'DEEPSEEK'
];

// 模型选择策略
const MODEL_STRATEGIES = {
  'resume_analysis': {
    preferred: ['qwen-plus', 'qwen-72b-chat', 'GLM-4.5-Flash', 'glm-4', 'deepseek-chat'],
    fallback: ['qwen-turbo', 'glm-3-turbo']
  },
  'job_matching': {
    preferred: ['GLM-4.5-Flash', 'glm-4', 'qwen-plus', 'yi-34b-chat', 'deepseek-reasoner'],
    fallback: ['glm-3-turbo', 'qwen-turbo']
  },
  'content_generation': {
    preferred: ['qwen-max', 'GLM-4.5-Flash', 'glm-4', 'qwen-72b-chat'],
    fallback: ['qwen-plus', 'glm-3-turbo', 'deepseek-chat']
  },
  'chat': {
    preferred: ['qwen-plus', 'qwen-72b-chat', 'GLM-4.5-Flash', 'glm-4', 'deepseek-chat'],
    fallback: ['qwen-turbo', 'glm-3-turbo']
  },
  'quick_analysis': {
    preferred: ['qwen-turbo', 'glm-3-turbo', 'deepseek-chat'],
    fallback: ['qwen-plus']
  },
  'resume_compare': {
    preferred: ['qwen-plus', 'qwen-72b-chat', 'GLM-4.5-Flash', 'glm-4', 'deepseek-chat'],
    fallback: ['qwen-turbo', 'glm-3-turbo']
  },
  'url_read': {
    preferred: ['qwen-plus', 'qwen-72b-chat', 'GLM-4.5-Flash', 'glm-4'],
    fallback: ['qwen-turbo', 'glm-3-turbo']
  }
};

module.exports = {
  AI_SERVICES,
  SERVICE_PRIORITY,
  MODEL_STRATEGIES
};
