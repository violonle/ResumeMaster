const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const textract = require('textract');

const officeParser = require('officeparser');
const tikaService = require('./tikaService');

function resolvePath(p) {
  if (!p) return '';
  const isAbsolute = path.isAbsolute(p);
  if (isAbsolute && !p.startsWith('/uploads')) return p;
  if (p.startsWith('/uploads')) return path.join(process.cwd(), p.replace(/^\//, ''));
  return path.join(process.cwd(), p);
}

function cleanText(text) {
  if (!text) return '';
  
  // 1. 基础清理：替换特殊空格、制表符、多余换行
  let cleaned = text
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/[\r\n]+/g, '\n');
    
  // 2. 移除乱码字符（保留汉字、字母、数字和常用标点，包括中括号）
  cleaned = cleaned.replace(/[^\u4e00-\u9fa5a-zA-Z0-9 \-\+\(\)\[\]\{\}\.\,\:\;\?\!@#\$%\^&\*_=\/\\：\n|'"<>~]/g, '');

  // 3. 过滤高熵噪声字符串（如 Base64 遗留或 Tika 解析错误的二进制片段）
  // 逻辑：如果一个单词长度超过 30 且包含大量混杂的字符，则视其为噪声
  const lines = cleaned.split('\n');
  const filteredLines = lines.map(line => {
    return line.split(' ').filter(word => {
      // 如果单词超长（通常是乱码）
      if (word.length > 35) {
        // 检查字符多样性，乱码通常包含数字和字母的无规律混合
        const hasNumbers = /[0-9]/.test(word);
        const hasLower = /[a-z]/.test(word);
        const hasUpper = /[A-Z]/.test(word);
        // 如果同时包含大小写和数字，极有可能是乱码或 ID
        if ((hasNumbers && hasLower && hasUpper) || word.length > 60) {
          return false;
        }
      }
      return true;
    }).join(' ');
  });

  return filteredLines.join('\n').trim();
}

const { Worker } = require('worker_threads');

async function extractTextFromFile(filePath) {
  const fullPath = resolvePath(filePath);
  const ext = path.extname(fullPath).toLowerCase();
  
  // 对于大文件或 PDF/DOCX，使用 Worker 线程
  if (['.pdf', '.docx'].includes(ext)) {
    return new Promise((resolve, reject) => {
      const worker = new Worker(path.join(__dirname, '../workers/extractorWorker.js'), {
        workerData: { filePath: fullPath }
      });
      
      const timeout = setTimeout(() => {
        worker.terminate();
        console.warn(`[TextExtractor] Worker timed out for ${filePath}`);
        resolve(''); // 超时返回空字符串，避免阻塞
      }, 25000);

      worker.on('message', (msg) => {
        clearTimeout(timeout);
        if (msg.success) {
          resolve(msg.text);
        } else {
          console.warn(`[TextExtractor] Worker failed: ${msg.error}`);
          resolve(''); // 失败返回空，尝试其他方法或返回空
        }
      });

      worker.on('error', (err) => {
        clearTimeout(timeout);
        console.error(`[TextExtractor] Worker error: ${err.message}`);
        resolve('');
      });

      worker.on('exit', (code) => {
        if (code !== 0) {
           console.warn(`[TextExtractor] Worker stopped with exit code ${code}`);
        }
      });
    });
  }

  // 其他类型保持原有逻辑
  const timeout = 25000; // 25秒超时
  
  const extractPromise = (async () => {
    try {
      const fullPath = resolvePath(filePath);
      const ext = path.extname(fullPath).toLowerCase();
      
      if (!fs.existsSync(fullPath)) {
        console.error('文件不存在:', fullPath);
        return '';
      }

      // 针对 PDF, DOC, DOCX, MD 等格式，优先使用 Apache Tika
      const tikaSupportedExts = ['.pdf', '.doc', '.docx', '.md', '.rtf', '.html', '.htm'];
      if (tikaSupportedExts.includes(ext)) {
        try {
          console.log(`[TextExtractor] 正在尝试使用 Apache Tika 解析: ${path.basename(fullPath)}`);
          const text = await tikaService.extractText(fullPath);
          if (text && text.trim().length > 10) {
            console.log('[TextExtractor] Apache Tika 解析成功');
            return cleanText(text);
          }
          console.warn('[TextExtractor] Apache Tika 返回内容过少，将尝试备选方案');
        } catch (tikaError) {
          console.warn(`[TextExtractor] Apache Tika 解析失败 (可能是服务未启动)，将尝试备选方案: ${tikaError.message}`);
        }
      }

      if (ext === '.txt' || ext === '.log') {
        const content = await fs.promises.readFile(fullPath, 'utf8');
        return cleanText(content);
      }
      
      if (ext === '.pdf') {
        try {
          const data = await fs.promises.readFile(fullPath);
          const res = await pdfParse(data);
          let text = res ? res.text : '';
          if (text) {
            text = cleanText(text);
          }
          return text;
        } catch (err) {
          console.error('[TextExtractor] pdf-parse 失败:', err.message);
          return '';
        }
      }
      
      if (ext === '.docx') {
        try {
          const res = await mammoth.extractRawText({ path: fullPath });
          let text = res ? res.value : '';
          if (text && text.trim().length > 50) {
            return cleanText(text);
          }
          console.warn('Mammoth提取内容过少，尝试使用OfficeParser...');
        } catch (mammothError) {
          console.warn('Mammoth解析失败，尝试使用OfficeParser:', mammothError);
        }

        // Fallback to officeparser
        try {
          const text = await officeParser.parseOfficeAsync(fullPath);
          if (text) {
            return cleanText(text);
          }
        } catch (officeError) {
          console.error('OfficeParser解析失败:', officeError);
        }
        
        return '';
      }
      
      if (ext === '.doc') {
        return new Promise((resolve) => {
          textract.fromUrlWithPath(fullPath, (error, text) => {
            if (error) {
              console.error('DOC文件提取失败:', error);
              resolve('');
            } else {
              resolve(cleanText(text || ''));
            }
          });
        });
      }
      
      return '';
    } catch (error) {
      console.error('提取文件文本失败:', error);
      return '';
    }
  })();

  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => {
      console.warn(`[TextExtractor] 解析文件超时 (${timeout}ms): ${filePath}`);
      resolve('');
    }, timeout);
  });

  return Promise.race([extractPromise, timeoutPromise]);
}

function buildFallbackTextFromParsed(parsed) {
  try {
    if (!parsed) return '';
    const lines = [];
    if (parsed.name) lines.push(`姓名：${parsed.name}`);
    if (parsed.jobTitle) lines.push(`期望岗位：${parsed.jobTitle}`);
    if (Array.isArray(parsed.skills)) lines.push(`技能：${parsed.skills.join(', ')}`);
    if (Array.isArray(parsed.education)) {
      parsed.education.forEach(e => lines.push(`教育：${[e.school,e.degree,e.major].filter(Boolean).join(' / ')}`));
    }
    return lines.join('\n');
  } catch (_) {
    return '';
  }
}

module.exports = { extractTextFromFile, buildFallbackTextFromParsed, cleanText };
