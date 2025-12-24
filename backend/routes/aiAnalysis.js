/**
 * AI分析路由
 * 处理国内AI服务的简历分析相关请求
 */
const express = require('express');
const { authenticate } = require('../middleware/auth');
const Permission = require('../middleware/permission');
const { Resume, UserActivity } = require('../models');
const path = require('path');
const fs = require('fs');

const aiController = require('../controllers/aiController');
const multer = require('multer');

const router = express.Router();

// Ensure upload directory exists
const uploadDir = path.join(process.cwd(), 'uploads', 'resumes');
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch (err) {
  console.error('Failed to create upload directory:', err);
}

// 文件上传配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'resume-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型'), false);
    }
  }
});

// 简历分析
router.post('/analyze', authenticate, Permission.requireSubscription, Permission.checkApiLimit('aiAnalysis'), Permission.rateLimit(200, 60*60*1000), aiController.analyzeResume.bind(aiController));

// 获取分析任务状态
router.get('/status/:resumeId', authenticate, aiController.getAnalysisStatus.bind(aiController));

// 获取分析任务结果
router.get('/result/:resumeId', authenticate, aiController.getAnalysisResult.bind(aiController));

// 职位匹配
router.post('/match-jobs', authenticate, Permission.requireSubscription, Permission.checkApiLimit('jobMatching'), Permission.rateLimit(200, 60*60*1000), aiController.matchJobs.bind(aiController));

// 内容生成
router.post('/generate-content', authenticate, Permission.requireSubscription, Permission.checkApiLimit('apiCalls'), Permission.rateLimit(150, 60*60*1000), aiController.generateContent);

// 快速分析
router.post('/quick-analyze', authenticate, Permission.requireSubscription, Permission.checkApiLimit('aiAnalysis'), Permission.rateLimit(200, 60*60*1000), aiController.quickAnalyze);

// 简历对比
router.post('/compare-resumes', authenticate, Permission.requireSubscription, Permission.checkApiLimit('aiAnalysis'), Permission.rateLimit(200, 60*60*1000), aiController.compareResumes);

// 批量分析
router.post('/batch-analyze', authenticate, Permission.requireSubscription, Permission.checkApiLimit('aiAnalysis'), Permission.rateLimit(100, 60*60*1000), aiController.batchAnalyzeResumes.bind(aiController));

// 获取AI服务状态
router.get('/status', authenticate, Permission.rateLimit(500, 60*60*1000), aiController.getServiceStatus);

// 重置服务统计（管理员）
router.post('/reset-stats', authenticate, aiController.resetServiceStats);

// 链接导入简历
router.post('/import-link', authenticate, Permission.requireSubscription, Permission.checkApiLimit('resumeUpload'), Permission.rateLimit(300, 60*60*1000), async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, error: { message: '请提供有效的链接' } });
    }

    // 简单的URL验证
    try {
      new URL(url);
    } catch (e) {
      return res.status(400).json({ success: false, error: { message: '链接格式不正确' } });
    }

    // 尝试从URL提取文件名或使用默认名称
    let fileName = '外部链接简历';
    try {
      const urlObj = new URL(url);
      const pathSegments = urlObj.pathname.split('/');
      const lastSegment = pathSegments[pathSegments.length - 1];
      if (lastSegment && (lastSegment.endsWith('.pdf') || lastSegment.endsWith('.doc') || lastSegment.endsWith('.docx'))) {
        fileName = decodeURIComponent(lastSegment);
      } else {
        fileName = 'Link: ' + (urlObj.hostname + urlObj.pathname).substring(0, 50);
      }
    } catch (e) {
      // ignore
    }

    // 创建简历记录
    const resume = await Resume.create({
      user_id: req.user.id,
      file_name: fileName,
      file_size: 0, // 链接导入暂时无法获取大小
      file_type: 'link',
      file_path: url, // 存储URL
      status: 'uploaded',
      upload_date: new Date()
    });

    // 记录用户活动
    try {
      await UserActivity.create({
        user_id: req.user.id,
        action: 'resume_import_link',
        details: { resumeId: resume.id, url: url },
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });
    } catch (err) {
      console.error('Failed to log user activity:', err);
    }

    res.json({
      success: true,
      message: '链接导入成功',
      data: {
        resumeId: resume.id,
        id: resume.id,
        file_name: resume.file_name,
        upload_date: resume.upload_date,
        file_type: 'link'
      }
    });
  } catch (error) {
    console.error('Import link error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'IMPORT_FAILED',
        message: '导入失败: ' + error.message
      }
    });
  }
});

// 文件上传解析
router.post('/upload', authenticate, Permission.requireSubscription, Permission.checkApiLimit('resumeUpload'), Permission.rateLimit(300, 60*60*1000), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { message: '未接收到文件' }
      });
    }

    // 尝试修复文件名编码 (解决乱码问题)
    let originalName = req.file.originalname;
    try {
      // 如果包含乱码字符或全是不可打印字符，尝试 latin1 -> utf8 转换
      // 这里简单尝试转换，如果转换后的名字看起来更合理（比如是有效的UTF8字符串），则使用
      // 对于中文乱码，通常表现为 ISO-8859-1 (latin1) 解码了 UTF-8 字节
      const decodedName = Buffer.from(originalName, 'latin1').toString('utf8');
      // 简单的启发式检查：如果转换后的字符串包含中文字符，而原始字符串不包含（或包含乱码），则采用转换后的
      // 或者直接采用转换后的，因为现代浏览器通常发送 UTF-8，而某些中间件可能误读为 latin1
      if (decodedName.length < originalName.length || /[\u4e00-\u9fa5]/.test(decodedName)) {
         originalName = decodedName;
      }
    } catch (e) {
      // ignore conversion errors
    }

    const fileType = path.extname(originalName).toLowerCase().substring(1) || 'txt';
    const relativePath = '/uploads/resumes/' + req.file.filename;

    // 创建简历记录
    const resume = await Resume.create({
      user_id: req.user.id,
      file_name: originalName,
      file_size: req.file.size,
      file_type: fileType,
      file_path: relativePath,
      status: 'uploaded',
      upload_date: new Date()
    });

    // 记录用户活动
    try {
      await UserActivity.create({
        user_id: req.user.id,
        action: 'resume_upload',
        details: { resumeId: resume.id, fileName: resume.file_name },
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });
    } catch (err) {
      console.error('Failed to log user activity:', err);
      // Don't block response
    }

    res.json({
      success: true,
      message: '文件上传成功',
      data: {
        resumeId: resume.id,
        id: resume.id,
        file_name: resume.file_name,
        upload_date: resume.upload_date
      },
      file: {
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        path: relativePath
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'UPLOAD_FAILED',
        message: '上传失败: ' + error.message
      }
    });
  }
});

// 网址读取并分析
router.post('/read-url', authenticate, Permission.requireSubscription, Permission.checkApiLimit('aiAnalysis'), Permission.rateLimit(200, 60*60*1000), aiController.readResumeFromUrl.bind(aiController));

module.exports = router;
