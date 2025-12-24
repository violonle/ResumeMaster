// 国内AI服务配置
const AI_SERVICES = {
  MODELSCOPE: {
    name: '魔搭（ModelScope）',
    baseUrl: 'https://api.modelscope.cn/v1',
    models: {
      'qwen-7b-chat': 'qwen/Qwen-7B-Chat',
      'qwen-14b-chat': 'qwen/Qwen-14B-Chat',
      'chatglm3-6b': 'ZhipuAI/chatglm3-6b'
    },
    pricing: {
      'qwen-7b-chat': 0.001, // 每1000tokens价格（元）
      'qwen-14b-chat': 0.002,
      'chatglm3-6b': 0.001
    }
  },
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
    baseUrl: 'https://dashscope.aliyuncs.com/api/v1',
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
  }
  ,
  KIMI: {
    name: 'Kimi（Moonshot）',
    baseUrl: 'https://api.moonshot.cn/v1',
    models: {
      'moonshot-v1-8k': 'moonshot-v1-8k',
      'moonshot-v1-32k': 'moonshot-v1-32k',
      'moonshot-v1-128k': 'moonshot-v1-128k'
    },
    pricing: {
      'moonshot-v1-8k': 0.004,
      'moonshot-v1-32k': 0.006,
      'moonshot-v1-128k': 0.01
    }
  }
  ,
  MINIMAX: {
    name: 'MiniMax',
    baseUrl: 'https://api.minimax.chat/v1',
    models: {
      'abab6.5-chat': 'abab6.5-chat',
      'abab7-chat': 'abab7-chat'
    },
    pricing: {
      'abab6.5-chat': 0.003,
      'abab7-chat': 0.004
    }
  }
  ,
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
  }
};

// 服务优先级配置（按稳定性排序）
const SERVICE_PRIORITY = [
  'SILICONFLOW',
  'QWEN',
  'GLM',
  'DEEPSEEK',
  'MINIMAX',
  'KIMI',
  'MODELSCOPE'
];

// 模型选择策略
const MODEL_STRATEGIES = {
  'resume_analysis': {
    preferred: ['qwen-plus', 'qwen-72b-chat', 'GLM-4.5-Flash', 'glm-4', 'deepseek-chat', 'moonshot-v1-32k'],
    fallback: ['qwen-turbo', 'glm-3-turbo', 'abab6.5-chat']
  },
  'job_matching': {
    preferred: ['GLM-4.5-Flash', 'glm-4', 'qwen-plus', 'yi-34b-chat', 'deepseek-reasoner'],
    fallback: ['glm-3-turbo', 'qwen-turbo', 'moonshot-v1-8k']
  },
  'content_generation': {
    preferred: ['qwen-max', 'GLM-4.5-Flash', 'glm-4', 'qwen-72b-chat', 'moonshot-v1-128k'],
    fallback: ['qwen-plus', 'glm-3-turbo', 'deepseek-chat', 'abab7-chat']
  },
  'chat': {
    preferred: ['qwen-plus', 'qwen-72b-chat', 'GLM-4.5-Flash', 'glm-4', 'deepseek-chat', 'moonshot-v1-32k'],
    fallback: ['qwen-turbo', 'glm-3-turbo', 'qwen-7b-chat', 'abab6.5-chat']
  },
  'quick_analysis': {
    preferred: ['qwen-turbo', 'glm-3-turbo', 'qwen-7b-chat', 'deepseek-chat'],
    fallback: ['chatglm3-6b', 'qwen-14b-chat', 'moonshot-v1-8k']
  }
  ,
  'resume_compare': {
    preferred: ['qwen-plus', 'qwen-72b-chat', 'GLM-4.5-Flash', 'glm-4', 'deepseek-chat'],
    fallback: ['qwen-turbo', 'glm-3-turbo', 'qwen-7b-chat']
  }
  ,
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
