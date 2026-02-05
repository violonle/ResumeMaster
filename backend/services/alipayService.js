const crypto = require('crypto');
const axios = require('axios');
const moment = require('moment');
const ConfigHelper = require('../utils/configHelper');

const { SystemConfig } = require('../models');

class AlipayService {
  constructor(config) {
    this.updateConfig(config || ConfigHelper.getAlipayConfig());
  }

  updateConfig(config) {
    this.appId = config.appId;
    this.privateKey = this.formatPrivateKey(config.privateKey);
    this.publicKey = config.publicKey;
    this.alipayPublicKey = this.formatPublicKey(config.alipayPublicKey || config.publicKey);
    this.notifyUrl = config.notifyUrl;
    this.returnUrl = config.returnUrl;
    this.gatewayUrl = config.serverUrl || 'https://openapi.alipay.com/gateway.do';
    this.sandboxGatewayUrl = 'https://openapi-sandbox.dl.alipaydev.com/gateway.do';
    this.isSandbox = config.sandbox || config.isSandbox || false;
    this.currentGatewayUrl = this.isSandbox ? this.sandboxGatewayUrl : this.gatewayUrl;
    this.charset = 'UTF-8';
    this.signType = 'RSA2';
    this.version = '1.0';
    this.format = 'JSON';
    this.enabled = config.enabled !== undefined ? config.enabled : true;
    this.sandbox = config.sandbox || false;
  }

  formatPrivateKey(key) {
    if (!key) return '';
    // 支持 PKCS1 和 PKCS8 格式
    if (key.includes('BEGIN PRIVATE KEY') || key.includes('BEGIN RSA PRIVATE KEY')) return key;

    const match = key.match(/.{1,64}/g);
    if (!match) return key;

    // 默认转换为 PKCS8 (通常兼容性更好)
    return `-----BEGIN PRIVATE KEY-----\n${match.join('\n')}\n-----END PRIVATE KEY-----`;
  }

  /**
   * 检查配置是否完整
   * @returns {boolean}
   */
  isConfigured() {
    // 只要配置了 appId、私钥和公钥即可
    return !!(this.appId && this.privateKey && (this.publicKey || this.alipayPublicKey));
  }

  async loadConfigFromDb() {
    try {
      console.log('AlipayService: Loading config from DB for key "payment_alipay"...');
      const cfg = await SystemConfig.findOne({ where: { key: 'payment_alipay' } });
      if (cfg && cfg.value) {
        console.log('AlipayService: Found config in DB');
        const dbConfig = typeof cfg.value === 'string' ? JSON.parse(cfg.value) : cfg.value;
        console.log('AlipayService: DB Config Keys:', Object.keys(dbConfig));
        const envConfig = ConfigHelper.getAlipayConfig();
        this.updateConfig({ ...envConfig, ...dbConfig });
        console.log('AlipayService: Config updated. appId:', this.appId);
      } else {
        console.log('AlipayService: No config found in DB for "payment_alipay"');
      }
    } catch (error) {
      console.error('AlipayService: Failed to load alipay config from DB:', error);
    }
  }

  // 格式化公钥
  formatPublicKey(key) {
    if (!key) return '';
    if (key.includes('BEGIN PUBLIC KEY') || key.includes('BEGIN RSA PUBLIC KEY')) return key;

    // 每64个字符换行
    const match = key.match(/.{1,64}/g);
    if (!match) return key;

    return `-----BEGIN PUBLIC KEY-----\n${match.join('\n')}\n-----END PUBLIC KEY-----`;
  }

  // 生成签名
  generateSign(params) {
    try {
      if (!this.privateKey) {
        throw new Error('支付宝私钥未配置或无效');
      }

      // 1. 筛选并排序
      const keys = Object.keys(params)
        .filter(key => params[key] !== undefined && params[key] !== null && params[key] !== '' && key !== 'sign')
        .sort();

      // 2. 拼接待签名字符串 (不使用 decodeURIComponent，直接使用原始值)
      const signContent = keys
        .map(key => {
          let value = params[key];
          // 如果是对象，转为 JSON 字符串
          if (typeof value === 'object') {
            value = JSON.stringify(value);
          }
          return `${key}=${value}`;
        })
        .join('&');

      console.log('AlipayService: Sign Content:', signContent);

      // 3. 签名
      const signer = this.signType === 'RSA2' ? 'RSA-SHA256' : 'RSA-SHA1';
      const sign = crypto.createSign(signer).update(signContent, 'utf8').sign(this.privateKey, 'base64');

      return sign;
    } catch (error) {
      console.error('AlipayService: Generate Sign Error:', error.message);
      throw error;
    }
  }

  // 验证签名
  verifySign(params, sign) {
    const sortedParams = Object.keys(params)
      .filter(key => params[key] !== '' && key !== 'sign' && key !== 'sign_type')
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');

    if (this.signType === 'RSA2') {
      return crypto.createVerify('RSA-SHA256').update(sortedParams, 'utf8').verify(this.publicKey || this.alipayPublicKey, sign, 'base64');
    } else {
      return crypto.createVerify('RSA-SHA1').update(sortedParams, 'utf8').verify(this.publicKey || this.alipayPublicKey, sign, 'base64');
    }
  }

  // 构建请求参数
  buildRequestParams(method, bizContent, notifyUrl = null, returnUrl = null) {
    const params = {
      app_id: this.appId,
      method: method,
      charset: this.charset,
      sign_type: this.signType,
      timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
      version: this.version,
      format: this.format,
      biz_content: typeof bizContent === 'string' ? bizContent : JSON.stringify(bizContent)
    };

    if (notifyUrl) {
      params.notify_url = notifyUrl;
    }

    if (returnUrl) {
      params.return_url = returnUrl;
    }

    // 生成签名
    params.sign = this.generateSign(params);

    console.log('AlipayService: Request Params prepared for method:', method);
    return params;
  }

  // 电脑网站支付（统一收单下单并支付页面接口）
  async pagePay(subject, outTradeNo, totalAmount, body = '') {
    const bizContent = {
      out_trade_no: outTradeNo,
      product_code: 'FAST_INSTANT_TRADE_PAY',
      total_amount: totalAmount.toString(),
      subject: subject,
      body: body
    };

    const params = this.buildRequestParams(
      'alipay.trade.page.pay',
      bizContent,
      this.notifyUrl,
      this.returnUrl
    );

    // 构建表单提交HTML
    let formHtml = `<form id="alipaysubmit" name="alipaysubmit" action="${this.currentGatewayUrl}?charset=${this.charset}" method="POST">`;

    for (const key in params) {
      if (params.hasOwnProperty(key)) {
        // 使用单引号包裹 value，避免 JSON 双引号截断
        // 对 value 中的单引号进行转义 (虽然 JSON 中很少有单引号，但为了安全)
        const value = String(params[key]).replace(/'/g, '&#39;');
        formHtml += `<input type="hidden" name="${key}" value='${value}'/>`;
      }
    }

    formHtml += '</form>';
    formHtml += '<script>document.forms["alipaysubmit"].submit();</script>';

    return formHtml;
  }

  // 手机网站支付（统一收单下单并支付页面接口）
  async wapPay(subject, outTradeNo, totalAmount, body = '') {
    const bizContent = {
      out_trade_no: outTradeNo,
      product_code: 'QUICK_WAP_WAY',
      total_amount: totalAmount.toString(),
      subject: subject,
      body: body
    };

    const params = this.buildRequestParams(
      'alipay.trade.wap.pay',
      bizContent,
      this.notifyUrl,
      this.returnUrl
    );

    // 构建表单提交HTML
    let formHtml = `<form id="alipaysubmit" name="alipaysubmit" action="${this.currentGatewayUrl}?charset=${this.charset}" method="POST">`;

    for (const key in params) {
      if (params.hasOwnProperty(key)) {
        // 使用单引号包裹 value
        const value = String(params[key]).replace(/'/g, '&#39;');
        formHtml += `<input type="hidden" name="${key}" value='${value}'/>`;
      }
    }

    formHtml += '</form>';
    formHtml += '<script>document.forms["alipaysubmit"].submit();</script>';

    return formHtml;
  }

  // 统一收单交易下单接口（小程序支付）
  async createOrder(subject, outTradeNo, totalAmount, buyerId, body = '') {
    const bizContent = {
      out_trade_no: outTradeNo,
      product_code: 'JSAPI_PAY',
      total_amount: totalAmount.toString(),
      subject: subject,
      body: body,
      buyer_id: buyerId
    };

    const params = this.buildRequestParams(
      'alipay.trade.create',
      bizContent,
      this.notifyUrl
    );

    try {
      const response = await axios.post(this.currentGatewayUrl, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      const result = response.data;

      if (result.alipay_trade_create_response && result.alipay_trade_create_response.code === '10000') {
        return {
          success: true,
          data: {
            tradeNo: result.alipay_trade_create_response.trade_no
          }
        };
      } else {
        return {
          success: false,
          error: result.alipay_trade_create_response?.msg || '下单失败'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 统一收单交易查询接口
  async queryOrder(outTradeNo) {
    const bizContent = {
      out_trade_no: outTradeNo
    };

    const params = this.buildRequestParams(
      'alipay.trade.query',
      bizContent
    );

    try {
      const response = await axios.post(this.currentGatewayUrl, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      const result = response.data;

      if (result.alipay_trade_query_response && result.alipay_trade_query_response.code === '10000') {
        return {
          success: true,
          data: {
            tradeNo: result.alipay_trade_query_response.trade_no,
            tradeStatus: result.alipay_trade_query_response.trade_status,
            totalAmount: result.alipay_trade_query_response.total_amount,
            buyerUserId: result.alipay_trade_query_response.buyer_user_id,
            gmtPayment: result.alipay_trade_query_response.gmt_payment
          }
        };
      } else {
        return {
          success: false,
          error: result.alipay_trade_query_response?.msg || '查询失败'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 统一收单交易关闭接口
  async closeOrder(outTradeNo) {
    const bizContent = {
      out_trade_no: outTradeNo
    };

    const params = this.buildRequestParams(
      'alipay.trade.close',
      bizContent
    );

    try {
      const response = await axios.post(this.currentGatewayUrl, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      const result = response.data;

      if (result.alipay_trade_close_response && result.alipay_trade_close_response.code === '10000') {
        return { success: true };
      } else {
        return {
          success: false,
          error: result.alipay_trade_close_response?.msg || '关闭失败'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 统一收单交易退款接口
  async refund(outTradeNo, refundAmount, refundReason = '') {
    const bizContent = {
      out_trade_no: outTradeNo,
      refund_amount: refundAmount.toString(),
      refund_reason: refundReason
    };

    const params = this.buildRequestParams(
      'alipay.trade.refund',
      bizContent
    );

    try {
      const response = await axios.post(this.currentGatewayUrl, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      const result = response.data;

      if (result.alipay_trade_refund_response && result.alipay_trade_refund_response.code === '10000') {
        return {
          success: true,
          data: {
            tradeNo: result.alipay_trade_refund_response.trade_no,
            refundFee: result.alipay_trade_refund_response.refund_fee,
            gmtRefundPay: result.alipay_trade_refund_response.gmt_refund_pay
          }
        };
      } else {
        return {
          success: false,
          error: result.alipay_trade_refund_response?.msg || '退款失败'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 验证支付回调签名
  verifyNotifySign(params, sign) {
    return this.verifySign(params, sign);
  }

  // 处理支付回调
  async handleNotify(notifyData) {
    try {
      // 验证签名
      const sign = notifyData.sign;
      if (!this.verifyNotifySign(notifyData, sign)) {
        return {
          success: false,
          error: '签名验证失败'
        };
      }

      // 验证支付状态
      if (notifyData.trade_status !== 'TRADE_SUCCESS' && notifyData.trade_status !== 'TRADE_FINISHED') {
        return {
          success: false,
          error: '支付未完成'
        };
      }

      return {
        success: true,
        data: {
          outTradeNo: notifyData.out_trade_no,
          tradeNo: notifyData.trade_no,
          tradeStatus: notifyData.trade_status,
          totalAmount: notifyData.total_amount,
          buyerUserId: notifyData.buyer_user_id,
          gmtPayment: notifyData.gmt_payment
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 生成支付成功响应
  generateSuccessResponse() {
    return 'success';
  }

  // 生成支付失败响应
  generateFailResponse() {
    return 'fail';
  }
}

module.exports = AlipayService;