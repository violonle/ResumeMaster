const crypto = require('crypto');
const axios = require('axios');
const moment = require('moment');
const ConfigHelper = require('../utils/configHelper');

class AlipayService {
  constructor(config) {
    const alipayConfig = config || ConfigHelper.getAlipayConfig();
    this.appId = alipayConfig.appId;
    this.privateKey = alipayConfig.privateKey;
    this.publicKey = alipayConfig.publicKey;
    this.alipayPublicKey = this.formatPublicKey(alipayConfig.alipayPublicKey || alipayConfig.publicKey);
    this.notifyUrl = alipayConfig.notifyUrl;
    this.returnUrl = alipayConfig.returnUrl;
    this.gatewayUrl = alipayConfig.serverUrl || 'https://openapi.alipay.com/gateway.do';
    this.sandboxGatewayUrl = 'https://openapi.alipaydev.com/gateway.do';
    this.isSandbox = alipayConfig.sandbox || alipayConfig.isSandbox || false;
    this.currentGatewayUrl = this.isSandbox ? this.sandboxGatewayUrl : this.gatewayUrl;
    this.charset = 'UTF-8';
    this.signType = 'RSA2';
    this.version = '1.0';
    this.format = 'JSON';
  }

  // 格式化公钥
  formatPublicKey(key) {
    if (!key) return '';
    if (key.includes('BEGIN PUBLIC KEY')) return key;
    
    // 每64个字符换行
    const match = key.match(/.{1,64}/g);
    if (!match) return key;
    
    return `-----BEGIN PUBLIC KEY-----\n${match.join('\n')}\n-----END PUBLIC KEY-----`;
  }

  // 生成签名
  generateSign(params) {
    // 按ASCII字典序排序
    const sortedParams = Object.keys(params)
      .filter(key => params[key] !== '' && key !== 'sign' && key !== 'sign_type')
      .sort()
      .map(key => `${key}=${decodeURIComponent(params[key])}`)
      .join('&');
    
    const signContent = `${sortedParams}`;
    
    if (this.signType === 'RSA2') {
      return crypto.createSign('RSA-SHA256').update(signContent, 'utf8').sign(this.privateKey, 'base64');
    } else {
      return crypto.createSign('RSA-SHA1').update(signContent, 'utf8').sign(this.privateKey, 'base64');
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
      return crypto.createVerify('RSA-SHA256').update(sortedParams, 'utf8').verify(this.alipayPublicKey, sign, 'base64');
    } else {
      return crypto.createVerify('RSA-SHA1').update(sortedParams, 'utf8').verify(this.alipayPublicKey, sign, 'base64');
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
      format: this.format
    };

    if (bizContent) {
      params.biz_content = JSON.stringify(bizContent);
    }

    if (notifyUrl) {
      params.notify_url = notifyUrl;
    }

    if (returnUrl) {
      params.return_url = returnUrl;
    }

    // 生成签名
    params.sign = this.generateSign(params);
    
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
        formHtml += `<input type="hidden" name="${key}" value="${params[key]}"/>`;
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
        formHtml += `<input type="hidden" name="${key}" value="${params[key]}"/>`;
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