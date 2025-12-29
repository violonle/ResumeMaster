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
const aiAnalysisController = require('../controllers/aiAnalysisController');
const multer = require('multer');
const ResumeWebScraper = require('../services/resumeWebScraper');
const OptimizedResumeParseService = require('../services/optimizedResumeParseService');

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

    // 使用网页抓取服务获取简历数据
    const scraper = new ResumeWebScraper();
    const scrapeResult = await scraper.scrapeResume(url);

    if (!scrapeResult.success) {
      return res.status(400).json({ 
        success: false, 
        error: { message: '抓取简历失败: ' + scrapeResult.error } 
      });
    }

    // 将抓取的数据转换为文本格式
    const resumeText = scraper.convertScrapedDataToText(scrapeResult.data);

    // 使用统一的解析服务解析简历
    const parseService = new OptimizedResumeParseService();
    const parsedData = await parseService.parseResumeContent(resumeText, 'txt');

    // 创建简历记录
    const resumeData = {
      user_id: req.user.id,
      file_name: fileName,
      file_size: 0,
      file_type: 'link',
      file_path: url,
      status: 'uploaded',
      upload_date: new Date(),
      parsed_data: parsedData,
      raw_text: resumeText,
      source: 'link_import'
    };

    // 从解析数据中提取各个字段
    if (parsedData) {
      resumeData.name = parsedData.name || null;
      resumeData.phone = parsedData.phone || null;
      resumeData.email = parsedData.email || null;
      resumeData.location = parsedData.location || parsedData.city || parsedData.expectCity || null;
      resumeData.job_title = parsedData.job_title || null;
      resumeData.experience_years = parsedData.experience_years || null;
      resumeData.highest_education = parsedData.highest_education || null;
      resumeData.job_status = parsedData.job_status || null;
      resumeData.expected_salary = parsedData.expected_salary || null;
      resumeData.work_experience = parsedData.work_experience || null;
      resumeData.education = parsedData.education || null;
      resumeData.skills = parsedData.skills || null;
      resumeData.summary = parsedData.summary || null;
      resumeData.projects = parsedData.projects || null;
    }

    const resume = await Resume.create(resumeData);

    // 记录用户活动
    try {
      await UserActivity.create({
        user_id: req.user.id,
        action: 'resume_import_link',
        details: { resumeId: resume.id, url: url, platform: scrapeResult.platform },
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
        file_type: 'link',
        platform: scrapeResult.platform,
        parsed: parsedData
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
router.post('/upload', authenticate, Permission.requireSubscription, Permission.checkApiLimit('resumeUpload'), Permission.rateLimit(300, 60*60*1000), aiAnalysisController.upload.single('file'), aiAnalysisController.uploadAndParseDocument);

// 网址读取并分析
router.post('/read-url', authenticate, Permission.requireSubscription, Permission.checkApiLimit('aiAnalysis'), Permission.rateLimit(200, 60*60*1000), aiController.readResumeFromUrl.bind(aiController));

module.exports = router;
