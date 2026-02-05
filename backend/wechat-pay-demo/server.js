const express = require('express');
const bodyParser = require('body-parser');
const WxPay = require('wechatpay-node-v3');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

// 微信支付配置
const config = {
  appid: process.env.WECHAT_APPID,
  mchid: process.env.WECHAT_MCHID,
  serial_no: process.env.WECHAT_SERIAL_NO,
  publicKey: fs.readFileSync(path.join(__dirname, 'apiclient_cert.pem')), // 需要放置证书
  privateKey: fs.readFileSync(path.join(__dirname, 'apiclient_key.pem')), // 需要放置私钥
  key: process.env.WECHAT_APIV3_KEY,
};

const wxpay = new WxPay(config);

// 1. 统一下单接口 (Native/H5/JSAPI)
app.post('/api/pay/create', async (req, res) => {
  const { amount, description, tradeType = 'NATIVE', openId } = req.body;
  const outTradeNo = `DEMO_${Date.now()}`;

  const params = {
    description,
    out_trade_no: outTradeNo,
    notify_url: process.env.NOTIFY_URL,
    amount: {
      total: Math.round(amount * 100),
      currency: 'CNY'
    }
  };

  try {
    let result;
    if (tradeType === 'NATIVE') {
      result = await wxpay.transactions_native(params);
    } else if (tradeType === 'H5') {
      params.scene_info = {
        payer_client_ip: req.ip.replace('::ffff:', ''),
        h5_info: { type: 'Wap' }
      };
      result = await wxpay.transactions_h5(params);
    } else if (tradeType === 'JSAPI') {
      params.payer = { openid: openId };
      result = await wxpay.transactions_jsapi(params);
    }

    if (result.status === 200 || result.status === 201) {
      res.json({ success: true, data: result.data || result });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. 支付回调接口
app.post('/api/wechat/notify', async (req, res) => {
  const headers = req.headers;
  const body = req.body;

  try {
    // 验签
    const isValid = await wxpay.verifySign({
      timestamp: headers['wechatpay-timestamp'],
      nonce: headers['wechatpay-nonce'],
      body: body,
      serial: headers['wechatpay-serial'],
      signature: headers['wechatpay-signature']
    });

    if (!isValid) {
      return res.status(401).json({ code: 'FAIL', message: '签名验证失败' });
    }

    // 解密
    const result = wxpay.decipher_gcm(
      body.resource.ciphertext,
      body.resource.associated_data,
      body.resource.nonce,
      process.env.WECHAT_APIV3_KEY
    );

    console.log('Decrypted Notify:', result);

    if (result.trade_state === 'SUCCESS') {
      // 在此处处理订单逻辑，例如更新数据库
      res.json({ code: 'SUCCESS', message: '成功' });
    } else {
      res.json({ code: 'FAIL', message: '支付未成功' });
    }
  } catch (error) {
    console.error('Notify Error:', error);
    res.status(500).json({ code: 'FAIL', message: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Demo server running on port ${PORT}`);
  console.log('Please ensure apiclient_cert.pem and apiclient_key.pem are in this directory.');
});
