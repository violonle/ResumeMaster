const { simpleParser } = require('mailparser')
const { ImapFlow } = require('imapflow')
const path = require('path')
const fs = require('fs')
const { Resume, sequelize } = require('../models')
const { extractTextFromFile } = require('./textExtractor')
const OptimizedResumeParseService = require('./optimizedResumeParseService')

const optimizedResumeParseService = new OptimizedResumeParseService()

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
  const logBuffer = [];
  const client = new ImapFlow({
    host,
    port,
    secure,
    auth,
    // Custom logger to capture debug info for "Command failed" errors
    logger: {
        debug: (obj) => { if(logBuffer.length > 20) logBuffer.shift(); logBuffer.push(`DEBUG: ${obj.msg}`); },
        info: (obj) => { if(logBuffer.length > 20) logBuffer.shift(); logBuffer.push(`INFO: ${obj.msg}`); },
        warn: (obj) => { if(logBuffer.length > 20) logBuffer.shift(); logBuffer.push(`WARN: ${obj.msg}`); },
        error: (obj) => { if(logBuffer.length > 20) logBuffer.shift(); logBuffer.push(`ERROR: ${obj.msg}`); }
    },
    tls: { rejectUnauthorized: false },
    emitLogs: true
  })
  
  const imported = []
  const stats = { importedCount: 0, skippedTooLarge: 0, skippedUnsupported: 0, duplicates: 0 }
  
  // Set a max execution time (e.g., 50 seconds) to avoid HTTP timeouts
  const startTime = Date.now();
  const MAX_EXECUTION_TIME = 50000; 

  try{
    await client.connect()
    
    // Check if INBOX exists, some servers might have different names or require specific handling
    let lock = null;
    try {
      lock = await client.getMailboxLock('INBOX');
    } catch (err) {
      console.error('Failed to lock INBOX:', err);
      // Try to list mailboxes to see available ones if INBOX fails
      const list = await client.list();
      console.log('Available mailboxes:', list.map(m => m.path));
      throw new Error(`无法打开收件箱 (INBOX): ${err.message}`);
    }

    try {
      // Use client.fetch directly without mailbox() call which is not standard ImapFlow usage with lock
      // ImapFlow uses locks. Once locked, we can operate on the mailbox.
      
      // Fetch unseen messages (metadata only first)
      const messages = client.fetch({ seen: false }, { envelope: true, uid: true, size: true });
      
      let count = 0
      for await (const msg of messages){
        if (count >= limit) break
        if (Date.now() - startTime > MAX_EXECUTION_TIME) {
            console.warn('Email import time limit reached, stopping early.');
            break;
        }

        // Check size before downloading (Skip if > 15MB)
        if (msg.size > 15 * 1024 * 1024) {
            stats.skippedTooLarge++;
            continue;
        }

        count++
        
        try {
          // Fetch the full content for this specific message
          const fullMsg = await client.fetchOne(msg.seq, { source: true });
          const parsed = await simpleParser(fullMsg.source)
          const attachments = Array.isArray(parsed.attachments) ? parsed.attachments : []
          
          for (const a of attachments){
            // Process attachment...
            const fp = await saveAttachment(a.content, a.filename||('mail-'+Date.now()))
            const ext = normalizeExt(a.filename||'')
            const fileName = path.basename(fp)
            const allowed = ['pdf','docx','doc','txt']
            
            if (!allowed.includes(ext)) { stats.skippedUnsupported++; continue }
            if (typeof a.size==='number' && a.size > 10*1024*1024) { stats.skippedTooLarge++; continue }
            
            const dup = await Resume.findOne({ where:{ user_id: userId, file_name: fileName } })
            if (dup) { stats.duplicates++; continue }
            
            let text = null
            try{ text = await extractTextFromFile(fp) }catch(_){ }
            
            let parsedData = null
            let rawText = text || ''
            
            if (text) {
              try {
                parsedData = await optimizedResumeParseService.parseResumeContent(text, ext)
              } catch (parseError) {
                console.warn('简历解析失败:', parseError.message)
                parsedData = { rawText: text, parseError: parseError.message }
              }
            }
            
            const resumeData = {
              user_id: userId,
              file_name: fileName,
              file_size: a.size||0,
              file_type: ext,
              file_path: fp,
              status: parsedData ? 'analyzed' : 'uploaded',
              parsed_data: parsedData,
              raw_text: rawText,
              source: 'email',
              is_talent_pool: true,
              recruitment_status: '投递'
            }
            
            if (parsedData) {
              resumeData.name = parsedData.name || null
              resumeData.phone = parsedData.phone || null
              resumeData.email = parsedData.email || null
              resumeData.location = parsedData.location || parsedData.city || parsedData.expectCity || null
              resumeData.job_title = parsedData.job_title || null
              resumeData.experience_years = parsedData.experience_years || null
              resumeData.highest_education = parsedData.highest_education || null
              resumeData.job_status = parsedData.job_status || null
              resumeData.expected_salary = parsedData.expected_salary || null
              resumeData.work_experience = parsedData.work_experience || null
              resumeData.education = parsedData.education || null
              resumeData.skills = parsedData.skills || null
              resumeData.summary = parsedData.summary || null
              resumeData.projects = parsedData.projects || null
            }
            
            const resume = await Resume.create(resumeData)
            imported.push({ id: resume.id, file_name: fileName })
            stats.importedCount++
          }
          
          if (!attachments.length && parsed.text){
            // Process body as resume if no attachments
            const name = 'mail-'+Date.now()+'.txt'
            const fp = await saveAttachment(Buffer.from(parsed.text, 'utf8'), name)
            const resume = await Resume.create({ user_id: userId, file_name: name, file_size: Buffer.byteLength(parsed.text||'', 'utf8'), file_type: 'txt', file_path: fp, status:'uploaded', source:'email', is_talent_pool: true })
            imported.push({ id: resume.id, file_name: name })
            stats.importedCount++
          }
          
          if (markSeen && msg.uid){ 
            try{ 
              await client.messageFlagsAdd(msg.uid, ['\\Seen']) 
            }catch(e){
              console.warn('Failed to mark as seen:', e.message);
            } 
          }
        } catch (msgError) {
          console.error('Error processing message:', msgError);
          // Continue to next message
        }
      }
    } finally {
      if (lock) lock.release();
    }
  } catch(err) {
    console.error('Email import failed:', err);
    let errorMsg = err.message || '未知错误';
    
    // 优化常见错误提示
    if (errorMsg.includes('Authentication failed') || errorMsg.includes('auth') || errorMsg.includes('Login fail') || errorMsg.includes('Account is abnormal')) {
      errorMsg = '认证失败：请检查邮箱账号或密码。注意：如果是QQ/163等邮箱，必须使用“授权码”而非登录密码；同时请确认IMAP服务已开启。';
    } else if (errorMsg.includes('ETIMEDOUT') || errorMsg.includes('timeout')) {
      errorMsg = '连接超时：请检查服务器地址和端口，或尝试关闭SSL';
    } else if (errorMsg.includes('ENOTFOUND') || errorMsg.includes('getaddrinfo')) {
      errorMsg = '无法解析服务器地址：请检查IMAP服务器地址是否正确';
    } else if (errorMsg.includes('Connection refused')) {
      errorMsg = '连接被拒绝：请检查端口是否正确';
    } else if (errorMsg.includes('unable to get local issuer certificate') || errorMsg.includes('certificate')) {
      errorMsg = 'SSL证书错误：服务器证书不受信任';
    } else if (errorMsg.includes('INBOX')) {
      // 保持原有的 INBOX 错误
    } else {
      // 如果是 Command failed，尝试从日志中获取更多信息
      if (errorMsg.includes('Command failed') && logBuffer.length > 0) {
          const lastLogs = logBuffer.slice(-3).join('; ');
          
          if (lastLogs.includes('Login fail') || lastLogs.includes('Account is abnormal')) {
             errorMsg = '认证失败：请检查邮箱账号或密码。注意：如果是QQ/163等邮箱，必须使用“授权码”而非登录密码；同时请确认IMAP服务已开启。';
          } else {
             errorMsg = `邮件服务器指令错误: ${lastLogs}`;
          }
      } else {
          errorMsg = `邮件服务器连接失败: ${errorMsg}`;
      }
    }
    
    throw new Error(errorMsg);
  } finally {
    try{ await client.logout() }catch(_){ }
  }
  return { imported, ...stats }
}

module.exports = { importFromEmail, scanEmails, importSelectedEmails }

// Helper for wildcard matching
function matchWildcard(str, pattern) {
    if (!pattern) return true;
    // Escape regex characters except *
    const rule = pattern.split("*").map(s => s.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1")).join(".*");
    return new RegExp("^" + rule + "$", 'i').test(str);
}

// Helper to check for attachments in BodyStructure
function hasAttachmentsInStructure(structure) {
    if (!structure) return false;
    // Check if current part is attachment
    if (structure.disposition && structure.disposition.toLowerCase() === 'attachment') return true;
    // Some clients send attachments as inline but with filename
    if (structure.parameters && (structure.parameters.filename || structure.parameters.name)) return true;
    
    // Check children
    if (structure.childNodes && Array.isArray(structure.childNodes)) {
        return structure.childNodes.some(hasAttachmentsInStructure);
    }
    return false;
}

async function scanEmails({ host, port=993, secure=true, auth, limit=20, senderFilter, onlyAttachments, onlyUnseen=true }) {
  const client = new ImapFlow({ host, port, secure, auth, tls: { rejectUnauthorized: false }, logger: false });
  const list = [];
  
  try {
    await client.connect();
    let lock = await client.getMailboxLock('INBOX');
    try {
      // If we need to check attachments, we must fetch bodyStructure
      const fetchOptions = { envelope: true, uid: true, size: true };
      if (onlyAttachments) {
          fetchOptions.bodyStructure = true;
      }
      
      let fetchRange = { seen: false }; // Default: Unseen only
      if (!onlyUnseen) {
           // Scan All (Recent first strategy)
           // We want to scan recent messages, but ImapFlow fetch with '1:*' scans all.
           // To optimize, we can try to fetch the last N messages using sequence numbers.
           // But sequence numbers change.
           // Let's use '1:*' but realize we are iterating.
           // ImapFlow fetch iterator order depends on server, usually ascending UID.
           // So we get oldest first.
           // If we want newest first, we should get total count and request a range.
           const status = await client.status('INBOX', { messages: true });
           const total = status.messages;
           const start = Math.max(1, total - 200 + 1); // Scan last 200
           fetchRange = `${start}:*`;
      }

      // Use the determined range/search
      const messages = client.fetch(fetchRange, fetchOptions);
      
      // We need to collect them and process in reverse order if we fetched by range (oldest to newest)
      // because we want to show newest emails first.
      // However, the iterator yields them as they come.
      // Let's collect up to MAX_SCAN_LIMIT into a buffer array, then reverse and filter.
      // Or just filter as we go (but we might miss the newest if we stop early on old ones).
      // If we fetch 'start:*', we get oldest in that range first.
      
      // Better strategy for "All": Read all metadata into memory (it's fast for 200 items), then reverse and filter.
      const rawMessages = [];
      const MAX_SCAN_LIMIT = 200;
      
      for await (const msg of messages) {
          rawMessages.push(msg);
          if (rawMessages.length >= MAX_SCAN_LIMIT) break;
      }
      
      // Reverse to process newest first
      rawMessages.reverse();
      
      for (const msg of rawMessages) {
        // Filter by Sender
        const fromAddress = msg.envelope.from.map(f => f.address).join(', ');
        if (senderFilter) {
            // Check if any sender address matches ANY of the wildcard patterns
            // Split by semicolon or comma
            const patterns = senderFilter.split(/[;,]/).map(s => s.trim()).filter(Boolean);
            const match = patterns.some(pattern => {
                return msg.envelope.from.some(f => matchWildcard(f.address, pattern));
            });
            if (!match) continue;
        }

        // Filter by Attachments
        let hasAttachments = true; // Default assumption if not checked
        if (onlyAttachments) {
            hasAttachments = hasAttachmentsInStructure(msg.bodyStructure);
            if (!hasAttachments) continue;
        }

        // Found a match
        list.push({
            uid: msg.uid,
            seq: msg.seq,
            subject: msg.envelope.subject,
            from: fromAddress,
            date: msg.envelope.date,
            size: msg.size,
            hasAttachments: hasAttachments 
        });

        // Limit the number of returned matches
        if (list.length >= limit) break;
      }
    } finally {
      lock.release();
    }
  } catch (err) {
      console.error('Email scan failed:', err);
      throw new Error(`邮件扫描失败: ${err.message}`);
  } finally {
    await client.logout();
  }
  return list;
}

async function importSelectedEmails({ host, port=993, secure=true, auth, uids, userId }) {
  // 复用 importFromEmail 的逻辑，但通过 UID 过滤
  // 为了简单起见，这里可以稍微修改 importFromEmail 支持 uid 列表过滤，或者重写一个简化的版本
  // 这里选择重写一个针对 UID 的版本，复用核心解析逻辑
  
  const client = new ImapFlow({ host, port, secure, auth, tls: { rejectUnauthorized: false }, logger: false });
  const imported = [];
  const stats = { importedCount: 0, skippedTooLarge: 0, skippedUnsupported: 0, duplicates: 0 };
  
  try {
    await client.connect();
    let lock = await client.getMailboxLock('INBOX');
    try {
        // 使用 uid 字符串 (例如 "1,2,3") 或者 Search
        // ImapFlow fetch 第一个参数可以是 sequence set string. 如果是 uid 模式，需要在 option 中指定 uid: true 吗？
        // 查阅文档：client.fetch(range, options). Range can be '1:5' or '1,3,5'. 
        // 如果要用 UID fetch，range 应该是 UID set，并且 options 中必须包含 uid: true ? 
        // 不，fetch 的 range 默认是 Sequence Number。如果要用 UID，需要先 search 或者转换。
        // 或者 fetchOne(uid, {uid: true})? 
        // ImapFlow: fetch(range, options). If options.uid is true, range is treated as UIDs.
        
        const uidSet = uids.join(',');
        const messages = client.fetch(uidSet, { source: true, envelope: true, uid: true }); // range is UID set because we will use logic to match? No, wait.
        // Correct usage: client.fetch(uidSet, { uid: true, ... }) -> range is treated as UIDs.
        
        for await (const msg of messages) {
            // Process message (Same logic as importFromEmail)
             try {
                const parsed = await simpleParser(msg.source)
                const attachments = Array.isArray(parsed.attachments) ? parsed.attachments : []
                
                // ... (Copy-paste attachment processing logic) ...
                for (const a of attachments){
                    const fp = await saveAttachment(a.content, a.filename||('mail-'+Date.now()))
                    const ext = normalizeExt(a.filename||'')
                    const fileName = path.basename(fp)
                    const allowed = ['pdf','docx','doc','txt']
                    
                    if (!allowed.includes(ext)) { stats.skippedUnsupported++; continue }
                    
                    const dup = await Resume.findOne({ where:{ user_id: userId, file_name: fileName } })
                    if (dup) { stats.duplicates++; continue }
                    
                    let text = null;
                    try{ text = await extractTextFromFile(fp) }catch(_){ }
                    
                    let parsedData = null
                    let rawText = text || ''
                    if (text) {
                        try {
                            parsedData = await optimizedResumeParseService.parseResumeContent(text, ext)
                        } catch (e) { parsedData = { rawText: text, parseError: e.message } }
                    }
                    
                    const resumeData = {
                        user_id: userId,
                        file_name: fileName,
                        file_size: a.size||0,
                        file_type: ext,
                        file_path: fp,
                        status: parsedData ? 'analyzed' : 'uploaded',
                        parsed_data: parsedData,
                        raw_text: rawText,
                        source: 'email',
                        is_talent_pool: true,
                        recruitment_status: '投递'
                    };
                     if (parsedData) {
                        resumeData.name = parsedData.name || null
                        resumeData.phone = parsedData.phone || null
                        resumeData.email = parsedData.email || null
                        resumeData.location = parsedData.location || parsedData.city || parsedData.expectCity || null
                        resumeData.job_title = parsedData.job_title || null
                        resumeData.experience_years = parsedData.experience_years || null
                        resumeData.highest_education = parsedData.highest_education || null
                        resumeData.job_status = parsedData.job_status || null
                        resumeData.expected_salary = parsedData.expected_salary || null
                        resumeData.work_experience = parsedData.work_experience || null
                        resumeData.education = parsedData.education || null
                        resumeData.skills = parsedData.skills || null
                        resumeData.summary = parsedData.summary || null
                        resumeData.projects = parsedData.projects || null
                    }
                    
                    const resume = await Resume.create(resumeData)
                    imported.push({ id: resume.id, file_name: fileName })
                    stats.importedCount++
                }
                
                // Mark as seen
                await client.messageFlagsAdd(msg.uid, ['\\Seen']);
                
             } catch (e) {
                 console.error('Error processing message ' + msg.uid, e);
             }
        }
        
    } finally {
      lock.release();
    }
  } catch(err) {
      throw new Error(`导入选中邮件失败: ${err.message}`);
  } finally {
    await client.logout();
  }
  return { imported, ...stats };
}
