const { simpleParser } = require('mailparser')
const { ImapFlow } = require('imapflow')
const path = require('path')
const fs = require('fs')
const { Resume, sequelize } = require('../models')
const extract = require('./textExtractor')

async function saveAttachment(buffer, filename){
  const base = path.resolve(__dirname, '..', 'uploads', 'resumes')
  if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true })
  const safe = filename || ('mail-'+Date.now()+'.bin')
  const p = path.join(base, safe)
  await fs.promises.writeFile(p, buffer)
  return p
}

function normalizeExt(name){
  const n = String(name||'').toLowerCase()
  if (n.endsWith('.pdf')) return 'pdf'
  if (n.endsWith('.docx')) return 'docx'
  if (n.endsWith('.doc')) return 'doc'
  if (n.endsWith('.txt')) return 'txt'
  return 'txt'
}

async function importFromEmail({ host, port=993, secure=true, auth, limit=20, userId, markSeen=false }){
  const client = new ImapFlow({ host, port, secure, auth })
  const imported = []
  const stats = { importedCount: 0, skippedTooLarge: 0, skippedUnsupported: 0, duplicates: 0 }
  try{
    await client.connect()
    await client.mailbox('INBOX')
    const iter = client.fetch({ seen:false }, { source:true, envelope:true, uid:true })
    let count = 0
    for await (const msg of iter){
      if (count>=limit) break
      count++
      const parsed = await simpleParser(msg.source)
      const attachments = Array.isArray(parsed.attachments)? parsed.attachments: []
      for (const a of attachments){
        const fp = await saveAttachment(a.content, a.filename||('mail-'+Date.now()))
        const ext = normalizeExt(a.filename||'')
        const fileName = path.basename(fp)
        const allowed = ['pdf','docx','doc','txt']
        if (!allowed.includes(ext)) { stats.skippedUnsupported++; continue }
        if (typeof a.size==='number' && a.size > 10*1024*1024) { stats.skippedTooLarge++; continue }
        const dup = await Resume.findOne({ where:{ user_id: userId, file_name: fileName } })
        if (dup) { stats.duplicates++; continue }
        let text = null
        try{ text = await extract.extractTextFromFile(fp) }catch(_){ }
        const resume = await Resume.create({ user_id: userId, file_name: fileName, file_size: a.size||0, file_type: ext, file_path: fp, status: text? 'analyzed':'uploaded', parsed_data: text? { rawText:text } : null, source: 'email', is_talent_pool: true })
        imported.push({ id: resume.id, file_name: fileName })
        stats.importedCount++
      }
      if (!attachments.length && parsed.text){
        const name = 'mail-'+Date.now()+'.txt'
        const fp = await saveAttachment(Buffer.from(parsed.text, 'utf8'), name)
        const resume = await Resume.create({ user_id: userId, file_name: name, file_size: Buffer.byteLength(parsed.text||'', 'utf8'), file_type: 'txt', file_path: fp, status:'uploaded', source:'email', is_talent_pool: true })
        imported.push({ id: resume.id, file_name: name })
        stats.importedCount++
      }
      if (markSeen && msg.uid){ try{ await client.messageFlagsAdd(msg.uid, ['\\Seen']) }catch(_){ } }
    }
  } finally {
    try{ await client.logout() }catch(_){ }
  }
  return { imported, ...stats }
}

module.exports = { importFromEmail }
