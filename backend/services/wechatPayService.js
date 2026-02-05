const crypto = require('crypto');
const axios = require('axios');
const WxPay = require('wechatpay-node-v3');
const ConfigHelper = require('../utils/configHelper');
const { SystemConfig } = require('../models');

class WechatPayService {
  constructor(config) {
    this.updateConfig(config || ConfigHelper.getWechatPayConfig());
  }

  updateConfig(config) {
    this.appId = config.appId;
    this.mchId = config.mchId;
    this.apiV3Key = config.apiV3Key;
    this.notifyUrl = config.notifyUrl;
    this.serialNo = config.serialNo;
    this.enabled = config.enabled !== undefined ? config.enabled : true;
    
    // 处理私钥
    if (config.privateKey) {
      this.privateKey = config.privateKey.replace(/\\n/g, '\n');
      if (!this.privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
        this.privateKey = `-----BEGIN PRIVATE KEY-----\n${this.privateKey}\n-----END PRIVATE KEY-----`;
      }
    }

    // 初始化 wechatpay-node-v3 实例
    if (this.isConfigured()) {
      try {
        this.wxpay = new WxPay({
          appid: this.appId,
          mchid: this.mchId,
          publicKey: config.publicKey ? config.publicKey.replace(/\\n/g, '\n') : undefined, 
          privateKey: this.privateKey,
          key: this.apiV3Key, // API V3 Key
          serial_no: this.serialNo,
        });
        console.log('[DEBUG_PAY] WechatPay SDK initialized successfully');
      } catch (error) {
        console.error('[DEBUG_PAY] Failed to initialize WechatPay SDK:', error);
      }
    }
  }

  isConfigured() {
    return !!(this.mchId && this.serialNo && this.privateKey && this.apiV3Key);
  }

  async loadConfigFromDb() {
    try {
      const cfg = await SystemConfig.findOne({ where: { key: 'payment_wechat' } });
      if (cfg && cfg.value) {
        const dbConfig = typeof cfg.value === 'string' ? JSON.parse(cfg.value) : cfg.value;
        const envConfig = ConfigHelper.getWechatPayConfig();
        this.updateConfig({ ...envConfig, ...dbConfig });
      }
    } catch (error) {
      console.error('Failed to load wechat pay config from DB:', error);
    }
  }

  // 统一下单接口
  async createUnifiedOrder(orderData) {
    if (!this.wxpay) {
      return { success: false, error: '微信支付 SDK 未正确初始化，请检查配置' };
    }

    const tradeType = (orderData.tradeType || 'NATIVE').toUpperCase();
    const params = {
      description: orderData.body,
      out_trade_no: orderData.outTradeNo,
      notify_url: this.notifyUrl,
      amount: {
        total: Math.round(orderData.totalFee),
        currency: 'CNY'
      }
    };

    try {
      let result;
      console.log(`[DEBUG_PAY] Creating ${tradeType} order:`, params);

      switch (tradeType) {
        case 'NATIVE':
          result = await this.wxpay.transactions_native(params);
          console.log('[DEBUG_PAY] NATIVE result:', result);
          if (result.status !== 200 && result.status !== 201) {
            return { success: false, error: result.error || '下单失败' };
          }
          return { success: true, data: { codeUrl: result.code_url || (result.data ? result.data.code_url : undefined) } };
        
        case 'H5':
          params.scene_info = {
            payer_client_ip: orderData.spbillCreateIp || '127.0.0.1',
            h5_info: { type: 'Wap' }
          };
          result = await this.wxpay.transactions_h5(params);
          console.log('[DEBUG_PAY] H5 result:', result);
          if (result.status !== 200 && result.status !== 201) {
            return { success: false, error: result.error || '下单失败' };
          }
          return { success: true, data: { h5Url: result.h5_url || (result.data ? result.data.h5_url : undefined) } };
        
        case 'JSAPI':
          if (!orderData.openId) {
            return { success: false, error: 'JSAPI 支付需要 openId' };
          }
          params.payer = { openid: orderData.openId };
          result = await this.wxpay.transactions_jsapi(params);
          console.log('[DEBUG_PAY] JSAPI result:', result);
          if (result.status !== 200 && result.status !== 201) {
            return { success: false, error: result.error || '下单失败' };
          }
          // JSAPI result 已经包含了 appId, timeStamp, nonceStr, package, signType, paySign
          return { success: true, data: result.data || result };

        default:
          return { success: false, error: `不支持的支付类型: ${tradeType}` };
      }
    } catch (error) {
      console.error(`[DEBUG_PAY] ${tradeType} order failed:`, error);
      const errorMsg = error.response && error.response.data ? error.response.data.message : error.message;
      return { success: false, error: errorMsg };
    }
  }

  // 查询订单
  async queryOrder(outTradeNo) {
    if (!this.wxpay) return { success: false, error: 'SDK not initialized' };
    try {
      const result = await this.wxpay.query({ out_trade_no: outTradeNo });
      return {
        success: true,
        data: {
          tradeState: result.trade_state,
          tradeStateDesc: result.trade_state_desc,
          totalFee: result.amount ? result.amount.total : 0,
          transactionId: result.transaction_id,
          timeEnd: result.success_time
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // 处理回调
  async handleNotify(headers, notifyData) {
    if (!this.wxpay) return { success: false, error: 'SDK not initialized' };
    try {
      // 1. 验证签名 (可选但推荐)
      if (headers && headers['wechatpay-signature']) {
        const isValid = await this.wxpay.verifySign({
          timestamp: headers['wechatpay-timestamp'],
          nonce: headers['wechatpay-nonce'],
          body: notifyData,
          serial: headers['wechatpay-serial'],
          signature: headers['wechatpay-signature'],
          apiSecret: this.apiV3Key
        });
        
        if (!isValid) {
          console.error('[DEBUG_PAY] Invalid signature in notify');
          return { success: false, error: '签名验证失败' };
        }
      }

      // 2. 解密数据
      const { resource } = notifyData;
      if (!resource) {
        return { success: false, error: '通知数据格式错误' };
      }

      // 使用 SDK 的 decipher_gcm 方法解密
      // 参数顺序: ciphertext, associated_data, nonce, key
      const result = this.wxpay.decipher_gcm(
        resource.ciphertext,
        resource.associated_data,
        resource.nonce,
        this.apiV3Key
      );
      
      console.log('[DEBUG_PAY] Decrypted notify data:', result);

      if (result.trade_state === 'SUCCESS') {
        return {
          success: true,
          data: {
            outTradeNo: result.out_trade_no,
            transactionId: result.transaction_id,
            totalFee: result.amount ? result.amount.total : 0,
            timeEnd: result.success_time
          }
        };
      } else {
        return { success: false, error: `支付状态: ${result.trade_state}`, tradeState: result.trade_state };
      }
    } catch (error) {
      console.error('[DEBUG_PAY] Notify handle failed:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = WechatPayService;
