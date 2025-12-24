const express = require('express');
const { getAllAnalysisResults, getAnalysisResultsByResume, createAnalysisResult, getLatestAnalysisResult } = require('../controllers/analysisController');
const { authenticate } = require('../middleware/auth');
const Permission = require('../middleware/permission');

const router = express.Router();

// 所有分析结果相关路由都需要认证
router.get('/', authenticate, Permission.rateLimit(500, 60*60*1000), getAllAnalysisResults);
router.get('/resume/:resumeId', authenticate, Permission.rateLimit(500, 60*60*1000), getAnalysisResultsByResume);
router.post('/', authenticate, Permission.requireSubscription, Permission.rateLimit(200, 24*60*60*1000), createAnalysisResult);
router.get('/latest/:resumeId', authenticate, Permission.rateLimit(500, 60*60*1000), getLatestAnalysisResult);

module.exports = router;
