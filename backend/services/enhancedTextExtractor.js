const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

function cleanText(text) {
  if (!text) return '';
  
  // 先处理换行，保留段落结构
  text = text.replace(/[\r\n]+/g, '\n');
  
  // 移除行首行尾的多余空格
  text = text.split('\n').map(line => line.trim()).join('\n');
  
  // 移除空行
  text = text.replace(/\n{3,}/g, '\n\n');
  
  // 处理中文标点符号
  text = text.replace(/[，。！？；：""''（）]/g, match => {
    const punctuationMap = {
      '，': ', ', '。': '. ', '！': '! ', '？': '? ',
      '；': '; ', '：': ': ', '"': '"', "'": "'",
      '（': '( ', '）': ') '
    };
    return punctuationMap[match] || match;
  });
  
  // 移除特殊控制字符，但保留有用的标点
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // 只移除连续的空格，但保留换行符
  text = text.replace(/[ \t]+/g, ' ');
  
  return text.trim();
}

class EnhancedTextExtractor {
  constructor() {
    this.pdfToTextPath = path.join(__dirname, 'lib', 'pdftotext');
  }

  async extractText(filePath, fileType) {
    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error('文件不存在');
    }

    try {
      switch (fileType.toLowerCase()) {
        case '.txt':
          return this.extractFromTXT(filePath);
        case '.pdf':
          return this.extractFromPDF(filePath);
        default:
          throw new Error('不支持的文件类型');
      }
    } catch (error) {
      console.error('文本提取失败:', error);
      throw error;
    }
  }

  async extractFromTXT(filePath) {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
          reject(err);
        } else {
          const cleanedText = cleanText(data);
          resolve(cleanedText);
        }
      });
    });
  }

  async extractFromPDF(filePath) {
    return new Promise((resolve, reject) => {
      // 检查pdftotext是否存在
      if (!fs.existsSync(this.pdfToTextPath)) {
        // 如果不存在，尝试使用系统的pdftotext
        this.pdfToTextPath = 'pdftotext';
      }

      const args = ['-enc', 'UTF-8', filePath, '-'];
      const pdftotext = spawn(this.pdfToTextPath, args);

      let text = '';
      let errorOutput = '';

      pdftotext.stdout.on('data', (data) => {
        text += data.toString('utf8');
      });

      pdftotext.stderr.on('data', (data) => {
        errorOutput += data.toString('utf8');
      });

      pdftotext.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`pdftotext执行失败: ${errorOutput}`));
        } else {
          const cleanedText = cleanText(text);
          resolve(cleanedText);
        }
      });

      pdftotext.on('error', (error) => {
        reject(new Error(`执行pdftotext时发生错误: ${error.message}`));
      });
    });
  }
}

module.exports = { EnhancedTextExtractor, cleanText };