const path = require('path')
const fs = require('fs')
const { Resume } = require('../models')
const emailImport = require('../services/emailImportService')

async function getTalentPoolResumes(req, res){
  try{
    const rows = await Resume.findAll({ where:{ user_id: req.user.id, is_talent_pool: true }, order:[['upload_date','DESC']] })
    res.json({ success:true, data: rows })
  }catch(e){
    res.status(500).json({ success:false, error:{ code:'LIBRARY_LIST_ERROR', message: e.message } })
  }
}

async function uploadToLibrary(req, res){
  try{
    const { file_name, file_base64 } = req.body || {}
    if (!file_name || !file_base64) return res.status(400).json({ success:false, error:{ code:'INVALID_FILE', message:'缺少文件名或内容' } })
    const baseDir = path.resolve(__dirname, '..', 'uploads', 'resumes')
    if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true })
    const safe = file_name.replace(/[^\w\-\.\u4e00-\u9fa5]/g,'_')
    const p = path.join(baseDir, safe)
    const m = file_base64.split(',')
    const b64 = m.length>1 ? m[1] : m[0]
    const buf = Buffer.from(b64, 'base64')
    await fs.promises.writeFile(p, buf)
    const ext = (safe.toLowerCase().split('.').pop()||'txt')
    const type = ['pdf','docx','doc','txt'].includes(ext)? ext : 'txt'
    const resume = await Resume.create({ user_id: req.user.id, file_name: safe, file_size: buf.length, file_type: type, file_path: p, status:'uploaded', source:'manual_pool', is_talent_pool: true })
    res.status(201).json({ success:true, data: resume, message:'已加入人才库' })
  }catch(e){
    res.status(500).json({ success:false, error:{ code:'LIBRARY_UPLOAD_ERROR', message: e.message } })
  }
}

module.exports = { getTalentPoolResumes, uploadToLibrary }
// 额外导出：邮箱导入到人才库
module.exports.importEmailToLibrary = async (req, res) => {
  try{
    const { host, port, secure, email, username, password, limit } = req.body || {}
    if (!host || !email || !password){
      return res.status(400).json({ success:false, error:{ code:'INVALID_INPUT', message:'缺少邮箱配置' } })
    }
    const lim = Math.max(1, Math.min(Number(limit||10), 200))
    const resp = await emailImport.importFromEmail({ host, port: port||993, secure: secure!==false, auth:{ user: (username||email), pass: password }, limit: lim, userId: req.user.id, markSeen: true })
    return res.json({ success:true, data: resp })
  }catch(e){
    return res.status(500).json({ success:false, error:{ code:'EMAIL_IMPORT_ERROR', message:e.message } })
  }
}
