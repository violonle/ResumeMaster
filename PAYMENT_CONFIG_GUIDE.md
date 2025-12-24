# 支付功能配置指南

本文档详细说明了如何配置 SuperResumeMaster 系统的支付功能，包括微信支付和支付宝支付的参数设置。

## 1. 配置文件位置

所有支付相关的配置均位于后端项目的环境变量文件中。

- **文件路径**: `backend/.env`
- **示例文件**: `backend/.env.example`

如果 `backend/.env` 文件不存在，请复制 `.env.example` 并重命名为 `.env`。

## 2. 微信支付配置 (WeChat Pay)

要启用微信支付，您需要拥有一个[微信支付商户平台](https://pay.weixin.qq.com/)账号，并获取以下信息：

```ini
# 微信支付配置
# 微信公众号或小程序的AppID
WECHAT_APP_ID=your_wechat_app_id

# 微信支付商户号 (MchId)
WECHAT_MCH_ID=your_wechat_merchant_id

# API密钥 (Key)
# 获取路径：微信支付商户平台 -> 账户中心 -> API安全 -> 设置API密钥
WECHAT_API_KEY=your_wechat_api_key

# AppSecret
# 获取路径：微信公众平台 -> 开发 -> 基本配置
WECHAT_APP_SECRET=your_wechat_app_secret

# 支付结果回调地址
# 注意：必须是公网可访问的域名，不能是 localhost
WECHAT_NOTIFY_URL=https://your-domain.com/api/payment/wechat-notify
```

## 3. 支付宝配置 (Alipay)

要启用支付宝支付，您需要拥有一个[支付宝开放平台](https://open.alipay.com/)账号，并创建一个应用获取以下信息：

```ini
# 支付宝支付配置
# 支付宝应用的AppID
ALIPAY_APP_ID=your_alipay_app_id

# 应用私钥 (PrivateKey)
# 使用支付宝开发助手生成的应用私钥（PKCS1或PKCS8格式，取决于您的代码配置，通常推荐RSA2）
ALIPAY_PRIVATE_KEY=your_alipay_private_key

# 支付宝公钥 (AlipayPublicKey)
# 注意：这是"支付宝公钥"，不是您生成的"应用公钥"。
# 获取路径：在开放平台上传您的应用公钥后，查看"支付宝公钥"
ALIPAY_PUBLIC_KEY=your_alipay_public_key

# 支付结果回调地址
# 注意：必须是公网可访问的域名
ALIPAY_NOTIFY_URL=https://your-domain.com/api/payment/alipay-notify

# 支付成功后的跳转地址 (前端页面地址)
ALIPAY_RETURN_URL=https://your-domain.com/payment/success

# 沙箱环境配置
# 正式环境设为 false，开发测试设为 true
ALIPAY_SANDBOX=false
```

## 4. 开发与测试

### 模拟支付
在开发阶段，如果您尚未申请到真实的支付商户账号，可以使用系统内置的"模拟支付"功能来验证业务流程。

- **前提条件**: 用户需登录。
- **接口地址**: `POST /api/payment/simulate`
- **参数**: `{ "outTradeNo": "ORDER_xxxxxx" }`
- **效果**: 直接将指定订单状态更为"已支付"，并触发后续订阅开通逻辑。

### 注意事项
1. **回调地址**: `WECHAT_NOTIFY_URL` 和 `ALIPAY_NOTIFY_URL` 必须配置为公网可访问的 URL。在本地开发时，可以使用内网穿透工具（如 ngrok, frp 等）将本地端口映射到公网域名。
2. **证书安全**: 请妥善保管您的私钥和 API 密钥，不要将其提交到公开的代码仓库中。
3. **日志监控**: 系统会在 `backend/logs` (如果配置了日志文件) 或控制台输出支付相关的日志，遇到问题时请优先查看日志中的错误信息。
