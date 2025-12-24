const crypto = require('crypto');
const axios = require('axios');
const xml2js = require('xml2js');
const moment = require('moment');

const ConfigHelper = require('../utils/configHelper');

const fs = require('fs');
const https = require('https');

class WechatPayService {
  constructor(config) {
    const wechatConfig = config || ConfigHelper.getWechatPayConfig();
    this.appId = wechatConfig.appId;
    this.mchId = wechatConfig.mchId;
    this.apiKey = wechatConfig.apiKey;
    this.appSecret = wechatConfig.appSecret;
    this.notifyUrl = wechatConfig.notifyUrl;
    this.unifiedOrderUrl = 'https://api.mch.weixin.qq.com/pay/unifiedorder';
    this.orderQueryUrl = 'https://api.mch.weixin.qq.com/pay/orderquery';
    this.closeOrderUrl = 'https://api.mch.weixin.qq.com/pay/closeorder';
    this.refundUrl = 'https://api.mch.weixin.qq.com/secapi/pay/refund';
    this.certPath = wechatConfig.certPath || process.env.WECHAT_CERT_PATH;
    this.keyPath = wechatConfig.keyPath || process.env.WECHAT_KEY_PATH;
  }

  // 生成随机字符串
  generateNonceStr(length = 32) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // 生成签名
  generateSign(params) {
    // 按ASCII字典序排序
    const sortedParams = Object.keys(params)
      .filter(key => params[key] !== '' && key !== 'sign')
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');
    
    const stringSignTemp = `${sortedParams}&key=${this.apiKey}`;
    return crypto.createHash('md5').update(stringSignTemp).digest('hex').toUpperCase();
  }

  // 将对象转换为XML
  objectToXml(obj) {
    let xml = '<xml>';
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        xml += `<${key}><![CDATA[${obj[key]}]]></${key}>`;
      }
    }
    xml += '</xml>';
    return xml;
  }

  // 将XML转换为对象
  xmlToObject(xml) {
    return new Promise((resolve, reject) => {
      xml2js.parseString(xml, { explicitArray: false }, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result.xml);
        }
      });
    });
  }

  // 统一下单接口
  async createUnifiedOrder(orderData) {
    const params = {
      appid: this.appId,
      mch_id: this.mchId,
      nonce_str: this.generateNonceStr(),
      body: orderData.body,
      out_trade_no: orderData.outTradeNo,
      total_fee: orderData.totalFee, // 单位为分
      spbill_create_ip: orderData.spbillCreateIp || '127.0.0.1',
      notify_url: this.notifyUrl,
      trade_type: orderData.tradeType || 'JSAPI',
      openid: orderData.openId
    };

    // 生成签名
    params.sign = this.generateSign(params);

    try {
      const xml = this.objectToXml(params);
      const response = await axios.post(this.unifiedOrderUrl, xml, {
        headers: { 'Content-Type': 'application/xml' }
      });

      const result = await this.xmlToObject(response.data);
      
      if (result.return_code === 'SUCCESS' && result.result_code === 'SUCCESS') {
        return {
          success: true,
          data: {
            appId: this.appId,
            timeStamp: Math.floor(Date.now() / 1000).toString(),
            nonceStr: this.generateNonceStr(),
            package: `prepay_id=${result.prepay_id}`,
            signType: 'MD5'
          }
        };
      } else {
        return {
          success: false,
          error: result.err_code_des || result.return_msg
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 查询订单
  async queryOrder(outTradeNo) {
    const params = {
      appid: this.appId,
      mch_id: this.mchId,
      out_trade_no: outTradeNo,
      nonce_str: this.generateNonceStr()
    };

    params.sign = this.generateSign(params);

    try {
      const xml = this.objectToXml(params);
      const response = await axios.post(this.orderQueryUrl, xml, {
        headers: { 'Content-Type': 'application/xml' }
      });

      const result = await this.xmlToObject(response.data);
      
      if (result.return_code === 'SUCCESS' && result.result_code === 'SUCCESS') {
        return {
          success: true,
          data: {
            tradeState: result.trade_state,
            totalFee: result.total_fee,
            transactionId: result.transaction_id,
            timeEnd: result.time_end
          }
        };
      } else {
        return {
          success: false,
          error: result.err_code_des || result.return_msg
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 关闭订单
  async closeOrder(outTradeNo) {
    const params = {
      appid: this.appId,
      mch_id: this.mchId,
      out_trade_no: outTradeNo,
      nonce_str: this.generateNonceStr()
    };

    params.sign = this.generateSign(params);

    try {
      const xml = this.objectToXml(params);
      const response = await axios.post(this.closeOrderUrl, xml, {
        headers: { 'Content-Type': 'application/xml' }
      });

      const result = await this.xmlToObject(response.data);
      
      if (result.return_code === 'SUCCESS' && result.result_code === 'SUCCESS') {
        return { success: true };
      } else {
        return {
          success: false,
          error: result.err_code_des || result.return_msg
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 申请退款
  async refund(refundData) {
    const params = {
      appid: this.appId,
      mch_id: this.mchId,
      nonce_str: this.generateNonceStr(),
      out_trade_no: refundData.outTradeNo,
      out_refund_no: refundData.outRefundNo || `REFUND_${refundData.outTradeNo}`,
      total_fee: refundData.totalFee,
      refund_fee: refundData.refundFee,
      op_user_id: this.mchId
    };

    params.sign = this.generateSign(params);

    try {
      const xml = this.objectToXml(params);
      
      const options = {
        headers: { 'Content-Type': 'application/xml' }
      };

      // 如果配置了证书，添加到请求选项中
      if (this.certPath && this.keyPath) {
        try {
            const httpsAgent = new https.Agent({
                cert: fs.readFileSync(this.certPath),
                key: fs.readFileSync(this.keyPath),
                passphrase: this.mchId // 默认密码为商户号
            });
            options.httpsAgent = httpsAgent;
        } catch (certError) {
            console.warn('加载微信支付证书失败:', certError.message);
            // 继续尝试无证书请求（可能会失败）
        }
      }

      const response = await axios.post(this.refundUrl, xml, options);

      const result = await this.xmlToObject(response.data);
      
      if (result.return_code === 'SUCCESS' && result.result_code === 'SUCCESS') {
        return {
          success: true,
          data: {
            transactionId: result.transaction_id,
            outTradeNo: result.out_trade_no,
            outRefundNo: result.out_refund_no,
            refundId: result.refund_id,
            refundFee: result.refund_fee
          }
        };
      } else {
        return {
          success: false,
          error: result.err_code_des || result.return_msg
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
  verifyNotifySign(params) {
    const receivedSign = params.sign;
    const calculatedSign = this.generateSign(params);
    return receivedSign === calculatedSign;
  }

  // 处理支付回调
  async handleNotify(notifyData) {
    try {
      // 验证签名
      if (!this.verifyNotifySign(notifyData)) {
        return {
          success: false,
          error: '签名验证失败'
        };
      }

      // 验证支付状态
      if (notifyData.result_code !== 'SUCCESS') {
        return {
          success: false,
          error: '支付失败'
        };
      }

      return {
        success: true,
        data: {
          outTradeNo: notifyData.out_trade_no,
          transactionId: notifyData.transaction_id,
          totalFee: notifyData.total_fee,
          timeEnd: notifyData.time_end
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 生成支付成功响应XML
  generateSuccessResponse() {
    return `<xml>
      <return_code><![CDATA[SUCCESS]]></return_code>
      <return_msg><![CDATA[OK]]></return_msg>
    </xml>`;
  }

  // 生成支付失败响应XML
  generateFailResponse(message = 'FAIL') {
    return `<xml>
      <return_code><![CDATA[FAIL]]></return_code>
      <return_msg><![CDATA[${message}]]></return_msg>
    </xml>`;
  }
}

module.exports = WechatPayService;