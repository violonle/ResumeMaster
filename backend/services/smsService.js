const axios = require('axios')
const crypto = require('crypto')
const { sequelize } = require('../models')
const { Op } = require('sequelize')

function enc(v){return encodeURIComponent(v).replace(/\+/g,'%20').replace(/\*/g,'%2A').replace(/%7E/g,'~')}
function nonce(){return crypto.randomBytes(16).toString('hex')}
function iso(){return new Date().toISOString().replace(/\.(\d{3})Z$/,'Z')}

// 短信发送场景
const SCENARIOS = {
  AUTH: 'auth',           // 登录/注册验证码
  INTERVIEW: 'interview', // 面试邀请
  OFFER: 'offer',         // Offer发送通知
  REMINDER: 'reminder'    // 面试催单通知
}

function normalizePhone(input){
  const raw = input === null || input === undefined ? '' : String(input);
  const s = raw.replace(/\s+/g, '');
  if (!s) return { ok: false, raw, phone: '', reason: 'EMPTY' };
  let digits = s.replace(/[^\d]/g, '');
  
  // 处理常见的 +86 或 86 前缀
  if (digits.length === 13 && digits.startsWith('86')) {
    digits = digits.slice(2);
  } else if (digits.length > 13 && digits.startsWith('0086')) {
    digits = digits.slice(4);
  }
  
  // 匹配 11 位中国大陆手机号
  const m = digits.match(/1[3-9]\d{9}/);
  if (!m) return { ok: false, raw, phone: '', reason: 'INVALID' };
  return { ok: true, raw, phone: m[0], reason: '' };
}

function buildResult({ success, attempted, sent, skipped, mock, provider, scenario, templateCode, error, message, data }){
  return {
    success: !!success,
    attempted: !!attempted,
    sent: !!sent,
    skipped: !!skipped,
    mock: !!mock,
    provider: provider || 'aliyun',
    scenario: scenario || null,
    templateCode: templateCode || '',
    error: error || '',
    message: message || '',
    data: data
  }
}

async function getConfig(){
  let enabledFromConfig = process.env.SMS_ENABLED !== undefined
  const cfg = {
    provider: process.env.SMS_PROVIDER || 'aliyun',
    accessKeyId: process.env.ALIYUN_SMS_ACCESS_KEY_ID || process.env.ALIYUN_ACCESS_KEY_ID || '',
    accessKeySecret: process.env.ALIYUN_SMS_SECRET_KEY || process.env.ALIYUN_ACCESS_KEY_SECRET || '',
    signName: process.env.ALIYUN_SMS_SIGN_NAME || '',
    templateCode: process.env.ALIYUN_SMS_TEMPLATE_CODE || '',
    enabled: String(process.env.SMS_ENABLED || '').toLowerCase() === 'true',
    scenarios: {
      auth: { templateCode: process.env.ALIYUN_SMS_TEMPLATE_CODE_AUTH || '' },
      interview: { templateCode: process.env.ALIYUN_SMS_TEMPLATE_CODE_INTERVIEW || '' },
      offer: { templateCode: process.env.ALIYUN_SMS_TEMPLATE_CODE_OFFER || '' },
      reminder: { templateCode: process.env.ALIYUN_SMS_TEMPLATE_CODE_REMINDER || '' }
    },
    portalUrl: process.env.PORTAL_URL || 'https://master.cloujade.com'
  }
  try{
    const SystemConfig = sequelize.models.SystemConfig
    if (SystemConfig){
      // 1. Check legacy 'sms' JSON blob (if exists)
      const legacy = await SystemConfig.findOne({ where: { key: 'sms' } })
      if (legacy && legacy.value){
        try{ 
          const v = JSON.parse(legacy.value); 
          if(v.provider) cfg.provider = v.provider;
          if(v.accessKeyId) cfg.accessKeyId = v.accessKeyId;
          if(v.accessKeySecret) cfg.accessKeySecret = v.accessKeySecret;
          if(v.signName) cfg.signName = v.signName;
          if(v.templateCode) cfg.templateCode = v.templateCode;
          if(v.scenarios) {
            cfg.scenarios = { ...cfg.scenarios, ...v.scenarios };
          }
        }catch(_){/* ignore */}
      }
      
      // 2. Check individual keys (priority)
      // PRIORITY RULE: DB Individual Key > DB JSON > Env Variables
      // This ensures that configurations made in the Admin Panel (SystemConfig) always override file-based .env settings.
      const keys = [
        'sms.provider','sms.accessKeyId','sms.accessKeySecret','sms.signName','sms.enabled', 'settings',
        'sms.templateCode',
        'sms.auth.templateCode',
        'sms.interview.templateCode',
        'sms.offer.templateCode',
        'sms.reminder.templateCode' // Backward compatibility
      ]
      const rows = await SystemConfig.findAll({ where: { key: { [Op.in]: keys } } })
      
      for(const r of rows){
        if (r.key === 'settings' && r.value) {
           try { 
             const v = JSON.parse(r.value); 
             if(v.siteName) cfg.siteName = v.siteName; 
             if(v.portalUrl) cfg.portalUrl = v.portalUrl;
           } catch(_) {}
        }
        const val = typeof r.value === 'string' ? r.value.trim() : ''
        if (r.key==='sms.provider' && val) cfg.provider = val
        if (r.key==='sms.accessKeyId' && val && val !== '***') cfg.accessKeyId = val
        if (r.key==='sms.accessKeySecret' && val && val !== '***') cfg.accessKeySecret = val
        if (r.key==='sms.signName' && val) cfg.signName = val
        if (r.key==='sms.templateCode' && val) cfg.templateCode = val
        if (r.key==='sms.enabled') {
          cfg.enabled = val === 'true'
          enabledFromConfig = true
        }
        
        // Scenario specific - Overwriting Env values with DB values if they exist
        if (r.key==='sms.auth.templateCode' && val) cfg.scenarios.auth.templateCode = val
        if (r.key==='sms.interview.templateCode' && val) cfg.scenarios.interview.templateCode = val
        if (r.key==='sms.offer.templateCode' && val) cfg.scenarios.offer.templateCode = val
        if (r.key==='sms.reminder.templateCode' && val) cfg.scenarios.reminder.templateCode = val
      }

      // Smart correction for common user mistakes
      // Mistake 1: TemplateCode entered in SignName field (SignName usually doesn't start with SMS_)
      if (cfg.signName && cfg.signName.toUpperCase().startsWith('SMS_') && !cfg.templateCode) {
        console.warn('[SMS] Detected TemplateCode in SignName field. Swapping/Fixing...');
        cfg.templateCode = cfg.signName;
        cfg.signName = ''; // Clear invalid sign name
      }
      
      // Mistake 2: Missing SignName, try to use Site Name
      if (!cfg.signName && cfg.siteName) {
        console.log('[SMS] SignName missing, using SiteName:', cfg.siteName);
        cfg.signName = cfg.siteName;
      }
    }
  }catch(e){
    console.error('[SMS] getConfig error:', e)
  }

  if (!enabledFromConfig && !cfg.enabled && cfg.accessKeyId && cfg.accessKeySecret && cfg.signName) {
    cfg.enabled = true
  }
  
  // Debug log (masked)
  console.log('[SMS] Config loaded:', { 
    provider: cfg.provider, 
    hasKey: !!cfg.accessKeyId, 
    hasSecret: !!cfg.accessKeySecret, 
    signName: cfg.signName, 
    templateCode: cfg.templateCode,
    enabled: cfg.enabled,
    scenarios: cfg.scenarios
  })
  
  return cfg
}

async function sendAliyunSms(phone, signName, templateCode, templateParam, scenario = null){
  const cfg = await getConfig()
  const id = cfg.accessKeyId
  const secret = cfg.accessKeySecret
  
  // Determine sign and template based on scenario
  let sign = cfg.signName // Always use global signName
  let tpl = templateCode
  
  if (scenario && cfg.scenarios[scenario]) {
    if (!tpl) tpl = cfg.scenarios[scenario].templateCode
  }
  
  // If no tpl found, and no scenario provided, it might be a direct call with tpl in templateCode param
  if (!tpl) tpl = cfg.templateCode // This is just a fallback for legacy support if needed
  
  if (!cfg.enabled) {
    console.warn('[SMS] Service is DISABLED in settings.');
    return buildResult({ success: false, attempted: false, sent: false, skipped: true, mock: false, provider: cfg.provider, scenario, templateCode: tpl, error: 'DISABLED', message: '短信服务未开启' });
  }

  if (!sign) return buildResult({ success: false, attempted: false, sent: false, skipped: true, mock: false, provider: cfg.provider, scenario, templateCode: tpl, error: 'CONFIG_MISSING_SIGN', message: '短信通道未配置：缺少签名' })
  if (!tpl) {
    console.error(`[SMS] Missing template code for scenario: ${scenario || 'default'}`);
    return buildResult({ success: false, attempted: false, sent: false, skipped: true, mock: false, provider: cfg.provider, scenario, templateCode: tpl, error: 'CONFIG_MISSING_TEMPLATE', message: `未配置${scenario || '短信'}模板` });
  }

  const np = normalizePhone(phone)
  if (!np.ok) {
    return buildResult({ success: false, attempted: false, sent: false, skipped: true, mock: false, provider: cfg.provider, scenario, templateCode: tpl, error: 'INVALID_PHONE', message: '手机号不合法' })
  }
  const normalizedPhone = np.phone

  if (!id || !secret) {
    console.warn('[SMS] Config missing (AccessKeyId/Secret).');
    return buildResult({ success: false, attempted: false, sent: false, skipped: true, mock: false, provider: cfg.provider, scenario, templateCode: tpl, error: 'CONFIG_MISSING_KEYS', message: '短信通道未配置：缺少AccessKey' });
  }

  // Ensure templateParam is an object for potential merging
  let finalParams = typeof templateParam === 'object' && templateParam !== null ? { ...templateParam } : {};
  
  // Fill company if missing (essential for most templates)
  if (!finalParams.company) {
      finalParams.company = cfg.siteName || '某公司';
    }
  // Fill name if missing
  if (!finalParams.name) {
    finalParams.name = '候选人';
  }
  
  // Backward compatibility: fill other aliases if not present (optional, keep minimal)
  if (!finalParams.companyName) finalParams.companyName = finalParams.company;
  if (!finalParams.siteName) finalParams.siteName = finalParams.company;
  if (!finalParams.date && finalParams.time) finalParams.date = finalParams.time;
  if (!finalParams.url && finalParams.link) finalParams.url = finalParams.link;
  if (!finalParams.address && finalParams.link) finalParams.address = finalParams.link;
  if (!finalParams.location && finalParams.link) finalParams.location = finalParams.link;
  if (!finalParams.job && finalParams.jobTitle) finalParams.job = finalParams.jobTitle;
  if (!finalParams.jobTitle && finalParams.job) finalParams.jobTitle = finalParams.job;
  
  const p = {
    Format:'JSON',
    AccessKeyId:id,
    SignatureMethod:'HMAC-SHA1',
    SignatureNonce:nonce(),
    SignatureVersion:'1.0',
    Timestamp:iso(),
    Version:'2017-05-25',
    Action:'SendSms',
    RegionId:'cn-hangzhou',
    PhoneNumbers:normalizedPhone,
    SignName:sign,
    TemplateCode:tpl,
    TemplateParam: JSON.stringify(finalParams)
  }
  const ks = Object.keys(p).sort()
  const q = ks.map(k=>`${enc(k)}=${enc(p[k])}`).join('&')
  const s = 'GET&%2F&'+enc(q)
  const sig = crypto.createHmac('sha1', secret+'&').update(s).digest('base64')
  const url = 'https://dysmsapi.aliyuncs.com/?Signature='+enc(sig)+'&'+q
  try{
    const maskedUrl = url.replace(/AccessKeyId=[^&]*/, 'AccessKeyId=***').replace(/Signature=[^&]*/, 'Signature=***');
    console.log(`[SMS] Sending to ${normalizedPhone} (raw: ${phone}) with template ${tpl} sign ${sign} params:`, p.TemplateParam)
    console.log(`[SMS] Aliyun Request URL (masked): ${maskedUrl}`);
    const res = await axios.get(url, { timeout:10000 })
    const ok = res.data && res.data.Code === 'OK'
    console.log(`[SMS] Aliyun Response for ${normalizedPhone}:`, JSON.stringify(res.data));
    if (!ok) {
      console.error(`[SMS] Aliyun Error for ${normalizedPhone}: ${res.data?.Code} - ${res.data?.Message}`);
    }
    return ok
      ? buildResult({ success: true, attempted: true, sent: true, skipped: false, mock: false, provider: cfg.provider, scenario, templateCode: tpl, error: '', message: '', data: res.data })
      : buildResult({ success: false, attempted: true, sent: false, skipped: false, mock: false, provider: cfg.provider, scenario, templateCode: tpl, error: (res.data && res.data.Code) || 'SEND_FAILED', message: (res.data && res.data.Message) || 'SEND_FAILED', data: res.data })
  }catch(e){
    console.error('[SMS] Aliyun error:', e.message, e.response && e.response.data);
    return buildResult({ success: false, attempted: true, sent: false, skipped: false, mock: false, provider: cfg.provider, scenario, templateCode: tpl, error: 'HTTP_ERROR', message: e.message, data: e.response && e.response.data })
  }
}

async function sendVerificationCode(phone, code, ip = null){
  console.log(`[SMS] sendVerificationCode phone=${phone} code=${code}`);
  
  try {
    const codeStr = String(code || '');
    if (!/^[a-zA-Z0-9]+$/.test(codeStr)) {
      return { success: false, error: 'INVALID_CODE', message: '验证码仅支持字母或数字' };
    }
    const VerificationCode = sequelize.models.VerificationCode;
    if (VerificationCode) {
      // 1. Check rate limit (1 minute)
      const lastCode = await VerificationCode.findOne({
        where: { phone },
        order: [['created_at', 'DESC']]
      });
      
      if (lastCode) {
        const diff = Date.now() - new Date(lastCode.created_at).getTime();
        // 在生产环境下严格执行60秒限制；开发环境下放宽
        const isDev = process.env.NODE_ENV !== 'production';
        const limit = isDev ? 2 * 1000 : 60 * 1000; // 开发环境缩短到2秒
        
        if (diff < limit) {
          // 如果上一次发送失败了，允许立即重试
          if (lastCode.status === 'failed') {
             // allow retry
          } else {
            return { success: false, error: 'RATE_LIMIT_EXCEEDED', message: '请勿频繁发送验证码' };
          }
        }
      }
      
      // 2. Check daily limit (10 per day)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const count = await VerificationCode.count({
        where: {
          phone,
          created_at: { [Op.gte]: today }
        }
      });
      
      const dailyLimit = (process.env.NODE_ENV !== 'production') ? 100 : 10;
      if (count >= dailyLimit) {
        return { success: false, error: 'DAILY_LIMIT_EXCEEDED', message: '今日验证码发送次数已达上限' };
      }
      
      // 3. Save to DB
      const record = await VerificationCode.create({
        phone,
        code,
        type: 'login',
        status: 'pending',
        ip,
        expires_at: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes validity
      });

      const result = await sendAliyunSms(phone, null, null, { code: String(code) }, SCENARIOS.AUTH);
      
      // Update status based on result
      if (result && result.success) {
      await record.update({ status: 'sent' });
      return { success: true, message: result.message || '验证码已发送', sent: !!result.sent, mock: !!result.mock };
    } else {
      await record.update({ status: 'failed' });
      // 如果是 Mock 模式，也认为是成功，方便开发测试
      if (result && result.mock) {
        return { success: true, message: result.message || '开发环境验证码(Mock)', sent: false, mock: true };
      }
      return { success: false, error: 'SMS_SEND_FAILED', message: result.message || '发送失败', detail: result.error, sent: false, mock: false };
    }
    }
  } catch (err) {
    console.error('[SMS] Send verification code failed:', err);
    return { success: false, error: 'SEND_ERROR', message: err.message };
  }

  // Fallback if model not found
  return sendAliyunSms(phone, null, null, { code: String(code) }, SCENARIOS.AUTH)
}

async function sendText(phone, content, scenario = null){
  let params = {};
  if (typeof content === 'object' && content !== null) {
    params = content;
  } else if (typeof content === 'string') {
    try {
      // Try to parse if it looks like JSON
      if (content.trim().startsWith('{')) {
        params = JSON.parse(content);
      } else {
        params = { code: content, content: content }; // Add content mapping for non-code templates
      }
    } catch (e) {
      params = { code: content, content: content };
    }
  } else {
    params = { code: String(content), content: String(content) };
  }
  return sendAliyunSms(phone, null, null, params, scenario)
}

async function createAliyunTemplate(name, content, type = 0, remark = '系统自动创建'){
  const cfg = await getConfig()
  const id = cfg.accessKeyId
  const secret = cfg.accessKeySecret
  if (!id || !secret) return { success:false, error:'CONFIG_MISSING' }
  const p = {
    Format:'JSON', AccessKeyId:id, SignatureMethod:'HMAC-SHA1', SignatureNonce:nonce(), SignatureVersion:'1.0', Timestamp:iso(), Version:'2017-05-25',
    Action:'CreateSmsTemplate',
    TemplateType: type,
    TemplateName: name,
    TemplateContent: content,
    Remark: remark
  }
  const ks = Object.keys(p).sort()
  const q = ks.map(k=>`${enc(k)}=${enc(p[k])}`).join('&')
  const s = 'GET&%2F&'+enc(q)
  const sig = crypto.createHmac('sha1', secret+'&').update(s).digest('base64')
  const url = 'https://dysmsapi.aliyuncs.com/?Signature='+enc(sig)+'&'+q
  try{
    const res = await axios.get(url, { timeout:10000 })
    const ok = res.data && res.data.Code === 'OK'
    return ok? { success:true, data:res.data } : { success:false, error:res.data && res.data.Message || 'CREATE_FAILED', data:res.data }
  }catch(e){
    return { success:false, error:e.message }
  }
}

module.exports = { SCENARIOS, getConfig, sendAliyunSms, sendVerificationCode, sendText, createAliyunTemplate, normalizePhone }
