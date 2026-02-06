const { SystemConfig } = require('../models')
const axios = require('axios')
function mask(k){ if(!k) return ''; if(k.length<=8) return '****'; return k.slice(0,3)+'****'+k.slice(-4) }
function parse(v){ try{ return JSON.parse(v||'{}') }catch(_){ return {} } }
function stringify(o){ return JSON.stringify(o||{}) }
function ensureDefault(cfg){ const d={ defaultProvider:'SILICONFLOW', providers:{ SILICONFLOW:{ enabled:false, apiKey:'', baseUrl:'https://api.siliconflow.cn/v1', model:'deepseek-ai/DeepSeek-V3' }, GLM:{ enabled:false, apiKey:'', baseUrl:'https://open.bigmodel.cn/api/paas/v4', model:'glm-4-flash' }, QWEN:{ enabled:false, apiKey:'', baseUrl:'https://dashscope.aliyuncs.com/api/v1', model:'qwen-plus' }, DEEPSEEK:{ enabled:false, apiKey:'', baseUrl:'https://api.deepseek.com', model:'deepseek-chat' }, MODELSCOPE:{ enabled:false, apiKey:'', baseUrl:'https://api-inference.modelscope.cn/api/v1/inference', model:'' } }, taskMapping:{} }; return Object.assign(d,cfg||{}) }
async function getConfig(req,res){ const row=await SystemConfig.findOne({ where:{ key:'ai_config' } }); const cfg=ensureDefault(parse(row?.value)); const m=JSON.parse(JSON.stringify(cfg));
  // 规范化：确保每个提供商都有 models 列表
  Object.keys(m.providers).forEach(p=>{
    const prov = m.providers[p] || {}
    prov.apiKey = mask(prov.apiKey)
    if (!Array.isArray(prov.models)) prov.models = prov.model ? [prov.model] : []
    m.providers[p] = prov
  })
  // 过滤：隐藏未启用且无配置的默认占位提供商
  const filtered = {}
  Object.keys(m.providers).forEach(p=>{
    const pr = m.providers[p]
    const meaningful = !!pr.enabled || (pr.apiKey && pr.apiKey !== '') || (Array.isArray(pr.models) && pr.models.length > 0)
    if (meaningful) filtered[p] = pr
  })
  m.providers = filtered
  res.json({ success:true, data:m }) }
function normalizeKey(p){
  const s = String(p||'').trim().toUpperCase()
  const map = {
    'QWEN':'QWEN','通义千问':'QWEN','QIANWEN':'QWEN','千问':'QWEN','阿里云百炼':'QWEN','阿里云':'QWEN',
    'GLM':'GLM','ZHIPUAI':'GLM','智谱':'GLM','CHATGLM':'GLM','智谱AI':'GLM','智谱AI开放平台':'GLM',
    'SILICONFLOW':'SILICONFLOW','硅基流动':'SILICONFLOW',
    'DEEPSEEK':'DEEPSEEK',
    'MODELSCOPE':'MODELSCOPE','魔搭':'MODELSCOPE','MS':'MODELSCOPE'
  }
  return map[s] || s
}
async function updateConfig(req,res){
  const body=req.body||{}
  const row=await SystemConfig.findOne({ where:{ key:'ai_config' } })
  const current=ensureDefault(parse(row?.value))
  const incoming=body
  const merged={}
  merged.defaultProvider = incoming.defaultProvider || current.defaultProvider
  merged.providers = Object.assign({}, current.providers)
  Object.keys(incoming.providers||{}).forEach(p=>{
    const key = normalizeKey(p)
    const inc = incoming.providers[p] || {}
    const cur = merged.providers[key] || {}
    const next = Object.assign({}, cur)
    if ('enabled' in inc) next.enabled = !!inc.enabled
    if ('apiKey' in inc) {
      const v = inc.apiKey
      if (v === null) next.apiKey = ''
      else if (v && typeof v === 'string' && !v.includes('*') && v.trim() !== '') next.apiKey = v
    }
    if ('model' in inc) {
      const v = inc.model
      if (v === null) next.model = ''
      else if (typeof v === 'string' && v.trim() !== '') next.model = v
    }
    if ('models' in inc) {
      const arr = Array.isArray(inc.models) ? inc.models.filter(x => typeof x === 'string' && x.trim() !== '') : []
      next.models = arr
      next.model = arr.length ? arr[0] : (next.model || '')
    }
    if ('baseUrl' in inc) {
      const v = inc.baseUrl
      if (v === null) next.baseUrl = ''
      else if (typeof v === 'string' && v.trim() !== '') next.baseUrl = v
    }
    merged.providers[key] = next
  })
  merged.taskMapping = Object.assign({}, current.taskMapping, incoming.taskMapping||{})
  merged.strategies = Object.assign({}, current.strategies, incoming.strategies||{})
  merged.planPolicies = Object.assign({}, current.planPolicies||{}, incoming.planPolicies||{})
  merged.companyPolicies = Object.assign({}, current.companyPolicies||{}, incoming.companyPolicies||{})
  if(row){ await row.update({ value:stringify(merged), type:'json', updated_at:new Date() }) }
  else { await SystemConfig.create({ key:'ai_config', value:stringify(merged), type:'json', is_public:false, updated_at:new Date() }) }
  res.json({ success:true })
}
const STATIC_MODELS={ 
  QWEN:['qwen-turbo','qwen-plus','qwen-max','qwen-long'], 
  GLM:['glm-4-flash','glm-4','glm-4v','GLM-4.5-Flash'], 
  SILICONFLOW:['deepseek-ai/DeepSeek-V3','deepseek-ai/DeepSeek-R1','deepseek-ai/deepseek-llm-67b-chat','01-ai/Yi-34B-Chat'],
  DEEPSEEK:['deepseek-chat','deepseek-reasoner'],
  MODELSCOPE:['Qwen/Qwen2.5-7B-Instruct','Qwen/Qwen2.5-14B-Instruct','Qwen/Qwen2.5-32B-Instruct','Qwen/Qwen2-VL-7B-Instruct','baichuan-inc/Baichuan2-13B-Chat','THUDM/chatglm3-6b','01ai/Yi-34B-Chat-200K','Meta-Llama-3.1-8B-Instruct','Meta-Llama-3.1-70B-Instruct']
}
async function listModels(req,res){ const provider=String(req.query.provider||'').toUpperCase(); const row=await SystemConfig.findOne({ where:{ key:'ai_config' } }); const cfg=ensureDefault(parse(row?.value)); const out=STATIC_MODELS[provider]||[]; res.json({ success:true, data: out }) }
async function testProvider(req,res){ 
  const { provider } = req.body||{}; 
  const p=String(provider||'').toUpperCase(); 
  const row=await SystemConfig.findOne({ where:{ key:'ai_config' } }); 
  const cfg=ensureDefault(parse(row?.value)); 
  const conf=cfg.providers[p]; 
  if(!conf||!conf.enabled) return res.json({ success:true, data:{ available:false, message:'未启用' } }); 
  const start=Date.now(); 
  try{ 
    const url = conf.baseUrl + '/chat/completions';
    const headers = { 
      Authorization: 'Bearer ' + conf.apiKey, 
      'Content-Type': 'application/json' 
    }; 
    const r = await axios.post(url, { 
      model: conf.model, 
      messages: [{ role: 'user', content: 'ping' }], 
      max_tokens: 1 
    }, { headers, timeout: 8000 }); 
    return res.json({ success: true, data: { available: true, latency: Date.now() - start } });
  } catch(e) { 
    return res.json({ success: true, data: { available: false, latency: Date.now() - start, message: '不可用: ' + (e.response?.data?.error?.message || e.message) } });
  } 
}
module.exports={ getConfig, updateConfig, listModels, testProvider }
