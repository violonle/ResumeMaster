const { parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const officeParser = require('officeparser');

/**
 * 清理文本 (复制自 textExtractor.js 以保持独立)
 */
function cleanText(text) {
  if (!text) return '';
  let cleaned = text
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/[\r\n]+/g, '\n');
  cleaned = cleaned.replace(/[^\u4e00-\u9fa5a-zA-Z0-9 \-\+\(\)\[\]\{\}\.\,\:\;\?\!@#\$%\^&\*_=\/\\：\n|'"<>~]/g, '');
  return cleaned.trim();
}

async function run() {
  const { filePath } = workerData;
  const ext = path.extname(filePath).toLowerCase();

  try {
    if (ext === '.pdf') {
      const data = fs.readFileSync(filePath);
      const res = await pdfParse(data);
      parentPort.postMessage({ success: true, text: cleanText(res ? res.text : '') });
    } else if (ext === '.docx') {
      const res = await mammoth.extractRawText({ path: filePath });
      parentPort.postMessage({ success: true, text: cleanText(res ? res.value : '') });
    } else if (ext === '.txt' || ext === '.log') {
      const content = fs.readFileSync(filePath, 'utf8');
      parentPort.postMessage({ success: true, text: cleanText(content) });
    } else {
      parentPort.postMessage({ success: false, error: 'Unsupported file type in worker' });
    }
  } catch (error) {
    parentPort.postMessage({ success: false, error: error.message });
  }
}

run();
