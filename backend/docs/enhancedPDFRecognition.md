# 增强PDF识别系统文档

## 概述

本系统通过集成pdf2pic库和Tesseract OCR引擎，实现了对PDF文件的增强识别功能。特别适用于扫描版PDF或文本内容较少的PDF文件。

## 核心功能

### 1. PDF-to-Image转换
- 使用pdf2pic库将PDF页面转换为高质量PNG图片
- 支持300 DPI分辨率，确保OCR识别精度
- 自动处理多页PDF，逐页转换和识别

### 2. OCR文本识别
- 集成Tesseract OCR引擎
- 支持中英文混合识别（chi_sim+eng）
- 智能字符白名单过滤，提高识别准确率

### 3. 智能判断机制
- 先使用pdf-parse进行常规文本提取
- 当提取文本长度小于50字符时，自动触发OCR识别
- 支持回退机制，确保识别稳定性

## 技术实现

### 主要依赖
```json
{
  "pdf2pic": "^x.x.x",
  "node-tesseract-ocr": "^x.x.x",
  "pdf-parse": "^x.x.x"
}
```

### 核心代码结构

#### PDF-to-Image转换函数
```javascript
async function convertPDFToImages(pdfPath, outputDir) {
  const options = {
    density: 300,
    savename: 'page',
    savedir: outputDir,
    format: 'png',
    width: 2480,
    height: 3508
  };
  
  const convert = fromPath(pdfPath, options);
  return await convert.bulk(-1); // 转换所有页面
}
```

#### 增强PDF文本提取
```javascript
async function extractTextFromPDF(pdfPath) {
  // 1. 常规PDF解析
  const text = await pdfParse(data);
  
  // 2. 智能判断是否需要OCR
  if (!text || text.trim().length < 50) {
    // 3. PDF转图片
    const imagePaths = await convertPDFToImages(pdfPath, tempDir);
    
    // 4. 逐页OCR识别
    for (const imagePath of imagePaths) {
      const pageText = await performOCR(imagePath);
      ocrResults.push(pageText);
    }
  }
  
  return ocrResults.join('\n\n');
}
```

## 使用示例

### 基本使用
```javascript
const { extractTextFromFile } = require('./services/enhancedTextExtractor');

// 提取PDF文本
const text = await extractTextFromFile('/uploads/resume.pdf');
console.log('提取结果:', text);
```

### 测试功能
```bash
# 运行测试脚本
node backend/test/testEnhancedPDF.js
```

## 性能优化

### 1. 图片质量配置
- 300 DPI：高精度识别，适合正式文档
- 150 DPI：平衡速度和质量
- 72 DPI：快速预览，适合测试

### 2. 临时文件管理
- 自动创建和清理临时目录
- 防止磁盘空间占用
- 异常情况下也能清理资源

### 3. 并发控制
- 逐页处理，避免内存溢出
- 支持大文件处理
- 可扩展为异步批处理

## 错误处理

### 常见错误及解决方案

1. **PDF转换失败**
   - 检查文件是否损坏
   - 验证文件权限
   - 确保磁盘空间充足

2. **OCR识别失败**
   - 检查Tesseract安装
   - 验证语言包完整性
   - 调整图片质量参数

3. **内存不足**
   - 降低图片分辨率
   - 分批处理大文件
   - 增加系统内存

## 测试建议

### 测试用例设计
1. **文本型PDF**：包含可选中文本的PDF
2. **扫描型PDF**：图片形式的PDF文档
3. **混合型PDF**：部分文本，部分图片
4. **多语言PDF**：中英文混合内容
5. **低质量PDF**：模糊或倾斜的扫描件

### 性能测试
- 处理时间统计
- 内存使用情况
- 并发处理能力
- 大文件稳定性

## 扩展功能

### 未来改进方向
1. **智能预处理**：自动旋转、去噪、增强对比度
2. **表格识别**：识别PDF中的表格结构
3. **布局保持**：保持原始文档格式
4. **多线程处理**：提高处理速度
5. **云端OCR**：集成云端识别服务

## 集成指南

### 在控制器中使用
```javascript
const { extractTextFromFile } = require('../services/enhancedTextExtractor');

// 在文件上传处理中
const content = await extractTextFromFile(filePath);
if (!content) {
  throw new Error('无法提取文档内容');
}

// 传递给简历解析服务
const parsedData = await resumeParseService.parseResumeContent(content, 'pdf');
```

### 配置参数
```javascript
const ocrConfig = {
  lang: 'chi_sim+eng',
  density: 300,
  format: 'png',
  // 可根据需要调整
};
```

## 注意事项

1. **系统依赖**：确保系统已安装GraphicsMagick
2. **Tesseract语言包**：需要安装中文语言包
3. **临时目录权限**：确保有创建临时文件的权限
4. **大文件处理**：注意内存和磁盘空间限制
5. **并发安全**：多用户同时处理时的资源管理

## 监控和日志

### 关键日志点
- PDF转换开始和结束
- OCR识别进度
- 错误信息和堆栈
- 性能指标统计

### 监控指标
- 平均处理时间
- 成功率统计
- 错误类型分布
- 资源使用情况

通过这套增强的PDF识别系统，可以显著提高对扫描版PDF和低质量PDF文档的识别准确率，为用户提供更好的简历导入体验。