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
  REMINDER: 'reminder'    // 面试提醒
}

async function getConfig(){
  const cfg = {
    provider: process.env.SMS_PROVIDER || 'aliyun',
    accessKeyId: process.env.ALIYUN_SMS_ACCESS_KEY_ID || process.env.ALIYUN_ACCESS_KEY_ID || '',
    accessKeySecret: process.env.ALIYUN_SMS_SECRET_KEY || process.env.ALIYUN_ACCESS_KEY_SECRET || '',
    signName: process.env.ALIYUN_SMS_SIGN_NAME || '',
    templateCode: process.env.ALIYUN_SMS_TEMPLATE_CODE || '',
    enabled: String(process.env.SMS_ENABLED || '').toLowerCase() === 'true',
    scenarios: {
      auth: { signName: '', templateCode: '' },
      interview: { signName: '', templateCode: '' },
      reminder: { signName: '', templateCode: '' }
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
          if(v.scenarios) cfg.scenarios = { ...cfg.scenarios, ...v.scenarios };
        }catch(_){/* ignore */}
      }
      
      // 2. Check individual keys (priority)
      const keys = [
        'sms.provider','sms.accessKeyId','sms.accessKeySecret','sms.signName','sms.templateCode','sms.enabled', 'settings',
        'sms.auth.signName', 'sms.auth.templateCode',
        'sms.interview.signName', 'sms.interview.templateCode',
        'sms.reminder.signName', 'sms.reminder.templateCode'
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
        if (r.key==='sms.enabled') cfg.enabled = val === 'true'
        
        // Scenario specific
        if (r.key==='sms.auth.signName' && val) cfg.scenarios.auth.signName = val
        if (r.key==='sms.auth.templateCode' && val) cfg.scenarios.auth.templateCode = val
        if (r.key==='sms.interview.signName' && val) cfg.scenarios.interview.signName = val
        if (r.key==='sms.interview.templateCode' && val) cfg.scenarios.interview.templateCode = val
        if (r.key==='sms.reminder.signName' && val) cfg.scenarios.reminder.signName = val
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
  let sign = signName
  let tpl = templateCode
  
  if (scenario && cfg.scenarios[scenario]) {
    if (!sign) sign = cfg.scenarios[scenario].signName
    if (!tpl) tpl = cfg.scenarios[scenario].templateCode
  }
  
  // Fallback to global defaults
  if (!sign) sign = cfg.signName
  if (!tpl) tpl = cfg.templateCode
  
  if (!id || !secret) {
    console.warn('[SMS] Config missing (AccessKeyId/Secret). Using MOCK mode.');
    console.log(`[SMS MOCK] To: ${phone}`);
    console.log(`[SMS MOCK] Template: ${tpl || 'DEFAULT'}`);
    console.log(`[SMS MOCK] Params: ${JSON.stringify(templateParam)}`);
    return { success: true, mock: true };
  }
  if (!cfg.enabled) {
    console.warn('[SMS] Service is DISABLED in settings.');
    return { success: false, error: 'DISABLED', message: '短信服务未开启' };
  }
  if (!sign) return { success:false, error:'CONFIG_MISSING_SIGN' }
  
  // Try to create template if missing
  if (!tpl) {
    try {
      console.log('[SMS] Template code missing, attempting to create default template...')
      const init = await createAliyunTemplate('登录/注册验证码', '您的验证码为：${code}，5分钟内有效。若非本人操作请忽略。', 0, '系统自动创建')
      if (init && init.success && init.data && init.data.TemplateCode) {
        tpl = init.data.TemplateCode
        console.log('[SMS] Created default template:', tpl)
        try {
          const SystemConfig = sequelize.models.SystemConfig
          if (SystemConfig) {
            const row = await SystemConfig.findOne({ where: { key: 'sms.templateCode' } })
            if (row) await row.update({ value: String(tpl) })
            else await SystemConfig.create({ key: 'sms.templateCode', value: String(tpl) })
          }
        } catch(_){}
      } else {
        console.error('[SMS] Failed to create default template:', init)
        return { success:false, error:'CONFIG_MISSING_TEMPLATE' }
      }
    } catch(e) {
      console.error('[SMS] Error creating default template:', e)
      return { success:false, error:'CONFIG_MISSING_TEMPLATE' }
    }
  }
  
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
    PhoneNumbers:phone,
    SignName:sign,
    TemplateCode:tpl,
    TemplateParam:typeof templateParam==='string'? templateParam : JSON.stringify(templateParam||{})
  }
  const ks = Object.keys(p).sort()
  const q = ks.map(k=>`${enc(k)}=${enc(p[k])}`).join('&')
  const s = 'GET&%2F&'+enc(q)
  const sig = crypto.createHmac('sha1', secret+'&').update(s).digest('base64')
  const url = 'https://dysmsapi.aliyuncs.com/?Signature='+enc(sig)+'&'+q
  try{
    console.log(`[SMS] Sending to ${phone} with template ${tpl} sign ${sign}`)
    const res = await axios.get(url, { timeout:10000 })
    const ok = res.data && res.data.Code === 'OK'
    console.log('[SMS] Aliyun response:', JSON.stringify(res.data));
    return ok? { success:true, data:res.data } : { success:false, error:res.data && res.data.Message || 'SEND_FAILED', data:res.data }
  }catch(e){
    console.error('[SMS] Aliyun error:', e.message, e.response && e.response.data);
    return { success:false, error:e.message }
  }
}

async function sendVerificationCode(phone, code, ip = null){
  console.log(`[SMS] sendVerificationCode phone=${phone} code=${code}`);
  
  try {
    const VerificationCode = sequelize.models.VerificationCode;
    if (VerificationCode) {
      // 1. Check rate limit (1 minute)
      const lastCode = await VerificationCode.findOne({
        where: { phone },
        order: [['created_at', 'DESC']]
      });
      
      if (lastCode) {
        const diff = Date.now() - new Date(lastCode.created_at).getTime();
        if (diff < 60 * 1000) {
          return { success: false, error: 'RATE_LIMIT_EXCEEDED', message: '请勿频繁发送验证码' };
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
      
      if (count >= 10) {
        return { success: false, error: 'DAILY_LIMIT_EXCEEDED', message: '今日验证码发送次数已达上限' };
      }
      
      // 3. Save to DB
      await VerificationCode.create({
        phone,
        code,
        type: 'login',
        status: 'sent',
        ip,
        expires_at: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes validity
      });
    }
  } catch (err) {
    console.error('[SMS] Rate limit check failed:', err);
  }

  // Try to cover common template variable names
  return sendAliyunSms(phone, null, null, { code, number: code, verifyCode: code, content: code }, SCENARIOS.AUTH)
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

module.exports = { SCENARIOS, getConfig, sendVerificationCode, sendText, createAliyunTemplate }
