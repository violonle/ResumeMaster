const express = require('express');
const router = express.Router();
const interviewController = require('../controllers/interviewController');

// 创建面试会话
router.post('/sessions', interviewController.createSession.bind(interviewController));

// 查找未完成的会话
router.get('/sessions/unfinished/:resumeId', interviewController.findUnfinishedSession.bind(interviewController));

// 获取会话详情
router.get('/sessions/:sessionId', interviewController.getCurrentQuestion.bind(interviewController));

// 获取当前题目 (前端 api.ts 中使用 /sessions/:sessionId/question)
router.get('/sessions/:sessionId/question', interviewController.getCurrentQuestion.bind(interviewController));

// 提交面试回答 (前端 api.ts 中使用 /sessions/:sessionId/answers)
router.post('/sessions/:sessionId/answers', interviewController.submitAnswer.bind(interviewController));

// 暂存回答 (前端 api.ts 中使用 PUT /sessions/:sessionId/answers)
router.put('/sessions/:sessionId/answers', interviewController.saveAnswer.bind(interviewController));

// 提前交卷
router.post('/sessions/:sessionId/complete', interviewController.completeInterview.bind(interviewController));

// 获取面试报告
router.get('/sessions/:sessionId/report', interviewController.getReport.bind(interviewController));

module.exports = router;
