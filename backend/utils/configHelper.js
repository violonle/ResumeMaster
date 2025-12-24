/**
 * 服务配置助手
 * 处理环境变量和默认配置
 */

class ConfigHelper {
  // 获取微信支付配置
  static getWechatPayConfig() {
    return {
      appId: process.env.WECHAT_APP_ID || 'default_wechat_app_id',
      mchId: process.env.WECHAT_MCH_ID || 'default_wechat_mch_id',
      apiKey: process.env.WECHAT_API_KEY || 'default_wechat_api_key',
      appSecret: process.env.WECHAT_APP_SECRET || 'default_wechat_app_secret',
      notifyUrl: process.env.WECHAT_NOTIFY_URL || 'http://localhost:3000/api/payment/wechat-notify'
    };
  }

  // 获取支付宝配置
  static getAlipayConfig() {
    return {
      appId: process.env.ALIPAY_APP_ID || 'default_alipay_app_id',
      privateKey: process.env.ALIPAY_PRIVATE_KEY || 'default_alipay_private_key',
      publicKey: process.env.ALIPAY_PUBLIC_KEY || 'default_alipay_public_key',
      serverUrl: process.env.ALIPAY_SERVER_URL || 'https://openapi.alipay.com/gateway.do',
      notifyUrl: process.env.ALIPAY_NOTIFY_URL || 'http://localhost:3000/api/payment/alipay-notify',
      returnUrl: process.env.ALIPAY_RETURN_URL || 'http://localhost:3000/payment/success',
      sandbox: process.env.ALIPAY_SANDBOX === 'true'
    };
  }

  // 获取AI服务配置
  static getAIServiceConfig() {
    return {
      modelscope: {
        apiKey: process.env.MODELSCOPE_API_KEY || 'default_modelscope_key',
        baseUrl: process.env.MODELSCOPE_BASE_URL || 'https://api.modelscope.cn'
      },
      siliconflow: {
        apiKey: process.env.SILICONFLOW_API_KEY || 'default_siliconflow_key',
        baseUrl: process.env.SILICONFLOW_BASE_URL || 'https://api.siliconflow.cn'
      },
      glm: {
        apiKey: process.env.GLM_API_KEY || 'default_glm_key',
        baseUrl: process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4'
      },
      qwen: {
        apiKey: process.env.QWEN_API_KEY || 'default_qwen_key',
        baseUrl: process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com'
      },
      kimi: {
        apiKey: process.env.KIMI_API_KEY || 'default_kimi_key',
        baseUrl: process.env.KIMI_BASE_URL || 'https://api.moonshot.cn'
      },
      minimax: {
        apiKey: process.env.MINIMAX_API_KEY || 'default_minimax_key',
        baseUrl: process.env.MINIMAX_BASE_URL || 'https://api.minimax.chat'
      },
      deepseek: {
        apiKey: process.env.DEEPSEEK_API_KEY || 'default_deepseek_key',
        baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
      }
    };
  }

  // 检查配置是否完整
  static validateConfig(type) {
    const required = {
      wechatpay: ['WECHAT_APP_ID', 'WECHAT_MCH_ID', 'WECHAT_API_KEY'],
      alipay: ['ALIPAY_APP_ID', 'ALIPAY_PRIVATE_KEY', 'ALIPAY_PUBLIC_KEY'],
      ai: ['MODELSCOPE_API_KEY', 'SILICONFLOW_API_KEY', 'GLM_API_KEY', 'QWEN_API_KEY', 'KIMI_API_KEY', 'MINIMAX_API_KEY', 'DEEPSEEK_API_KEY']
    };

    const configType = required[type];
    if (!configType) return true;

    const missing = configType.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      console.warn(`⚠️  ${type}配置不完整，缺少环境变量:`, missing.join(', '));
      console.log('💡 请设置以下环境变量以确保服务正常运行');
      return false;
    }
    
    return true;
  }

  // 获取配置状态
  static getConfigStatus() {
    return {
      wechatpay: this.validateConfig('wechatpay'),
      alipay: this.validateConfig('alipay'),
      ai: this.validateConfig('ai'),
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = ConfigHelper;
