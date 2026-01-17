const express = require('express');
const router = express.Router();
const interviewController = require('../controllers/interviewController');
const { authenticate } = require('../middleware/auth');

// 辅助函数：根据是否有 sessionId 或 resumeJobId 决定是否需要认证
const authenticateIfNoSession = (req, res, next) => {
  const sessionId = req.params.sessionId || req.body.sessionId || req.query.sessionId;
  const resumeJobId = req.body.resumeJobId || req.query.resumeJobId;
  if (sessionId || resumeJobId) {
    return next();
  }
  return authenticate(req, res, next);
};

// 快速安排面试 (需要认证)
router.post('/quick-schedule', authenticate, interviewController.quickSchedule.bind(interviewController));

// 创建面试会话 (如果是候选人通过 resumeJobId 进入，不需要认证)
router.post('/sessions', authenticateIfNoSession, interviewController.createSession.bind(interviewController));

// 查找未完成的会话 (由 HR/管理员查看，需要认证)
router.get('/sessions/unfinished/:resumeId', authenticate, interviewController.findUnfinishedSession.bind(interviewController));

// 获取会话详情 (候选人使用 sessionId 访问，不需要登录)
router.get('/sessions/:sessionId', interviewController.getSession.bind(interviewController));

// 获取当前题目 (候选人使用 sessionId 访问，不需要登录)
router.get('/sessions/:sessionId/question', interviewController.getCurrentQuestion.bind(interviewController));

// 提交面试回答 (候选人使用 sessionId 访问，不需要登录)
router.post('/sessions/:sessionId/answers', interviewController.submitAnswer.bind(interviewController));

// 暂存回答 (候选人使用 sessionId 访问，不需要登录)
router.put('/sessions/:sessionId/answers', interviewController.saveAnswer.bind(interviewController));

// 提前交卷 (候选人使用 sessionId 访问，不需要登录)
router.post('/sessions/:sessionId/complete', interviewController.completeInterview.bind(interviewController));

// 获取面试报告 (面试报告可能需要认证，或者完成面试后候选人也可以看，暂时允许带 sessionId 访问)
router.get('/sessions/:sessionId/report', interviewController.getReport.bind(interviewController));

module.exports = router;
