const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const textract = require('textract');

const officeParser = require('officeparser');

function resolvePath(p) {
  if (!p) return '';
  const isAbsolute = path.isAbsolute(p);
  if (isAbsolute && !p.startsWith('/uploads')) return p;
  if (p.startsWith('/uploads')) return path.join(process.cwd(), p.replace(/^\//, ''));
  return path.join(process.cwd(), p);
}

function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/[\r\n]+/g, '\n')
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9 \-\+\(\)\[\]\{\}\.\,\:\;\?\!@#\$%\^&\*_=\/\\：\n|'"<>~]/g, '')
    .trim();
}

async function extractTextFromFile(filePath) {
  try {
    const fullPath = resolvePath(filePath);
    const ext = path.extname(fullPath).toLowerCase();
    
    if (!fs.existsSync(fullPath)) {
      console.error('文件不存在:', fullPath);
      return '';
    }

    if (ext === '.txt' || ext === '.log') {
      const content = await fs.promises.readFile(fullPath, 'utf8');
      return cleanText(content);
    }
    
    if (ext === '.pdf') {
      const data = await fs.promises.readFile(fullPath);
      const res = await pdfParse(data);
      let text = res ? res.text : '';
      if (text) {
        text = cleanText(text);
      }
      return text;
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
      return new Promise((resolve, reject) => {
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
