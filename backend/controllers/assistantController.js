const rateMap = new Map()
function ok(ip){ const now=Date.now(); const it=rateMap.get(ip)||{count:0,reset:now+60000}; if(now>it.reset){ it.count=0; it.reset=now+60000 } if(it.count>=60) return false; it.count++; rateMap.set(ip,it); return true }
const DomesticAIService = require('../services/domesticAIService')
const { Resume } = require('../models')
const { extractTextFromFile } = require('../services/textExtractor')
const aiService = new DomesticAIService()

async function parseFile(req, res) {
    try {
        const { resumeId } = req.body
        if (!resumeId) return res.status(400).json({ success: false, error: '缺少 resumeId' })
        
        const resume = await Resume.findByPk(resumeId)
        if (!resume) return res.status(404).json({ success: false, error: '简历不存在' })
        
        const text = await extractTextFromFile(resume.file_path)
        if (!text) return res.status(400).json({ success: false, error: '无法提取文本内容' })
        
        return res.json({ success: true, data: { text } })
    } catch (e) {
        return res.status(500).json({ success: false, error: e.message })
    }
}

async function chat(req,res){ try{ const ip=req.headers['x-forwarded-for']||req.ip||'local'; if(!ok(ip)) return res.status(429).json({ success:false, error:{ code:'RATE_LIMIT', message:'请求过于频繁' } }); const { messages } = req.body||{}; if(!Array.isArray(messages) || messages.length===0) return res.status(400).json({ success:false, error:{ code:'INVALID_INPUT', message:'缺少messages' } }); const result = await aiService.chat(messages); if(!result.success){ return res.status(500).json({ success:false, error:{ code:'AI_ERROR', message: result.error||'AI服务不可用' } }) } const suggestions=[ '生成岗位JD要点', '优化候选人简历', '根据JD提取关键词' ]; return res.json({ success:true, data:{ reply: result.data, suggestions, service:result.service, model:result.model, cost:result.cost, responseTime:result.responseTime } }) } catch(e){ return res.status(500).json({ success:false, error:{ code:'ASSISTANT_ERROR', message:e.message } }) } }
async function status(req, res) { return res.json({ success: true, status: 'online', message: 'AI Assistant Service is running' }) }
module.exports = { chat, status, parseFile }
