const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

function resolvePath(p) {
  if (!p) return '';
  const isAbsolute = path.isAbsolute(p);
  if (isAbsolute && !p.startsWith('/uploads')) return p;
  if (p.startsWith('/uploads')) return path.join(process.cwd(), p.replace(/^\//, ''));
  return path.join(process.cwd(), p);
}

async function extractTextFromFile(filePath) {
  try {
    const fullPath = resolvePath(filePath);
    const ext = path.extname(fullPath).toLowerCase();
    if (ext === '.txt' || ext === '.log') {
      return await fs.promises.readFile(fullPath, 'utf8');
    }
    if (ext === '.pdf') {
      const data = await fs.promises.readFile(fullPath);
      const res = await pdfParse(data);
      return (res && res.text) ? res.text : '';
    }
    if (ext === '.docx') {
      const res = await mammoth.extractRawText({ path: fullPath });
      return (res && res.value) ? res.value : '';
    }
    return '';
  } catch (_) {
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

module.exports = { extractTextFromFile, buildFallbackTextFromParsed };
