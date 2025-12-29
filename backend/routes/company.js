const express = require('express');
const { authenticate } = require('../middleware/auth');
const Permission = require('../middleware/permission');
const { getCompanyTeam, getRecruitmentStats, getFunnelStats, getCompanyProfile, upsertCompanyProfile, getCompanyResumeStats, getCompanyAnalysisStats, getTopRoles, getRecentActivity, getCompanyProcesses, createCompanyProcess, updateCompanyProcess, deleteCompanyProcess, submitCertification, getMembers, addMember, removeMember, getEfficiencyStats } = require('../controllers/companyController');

const router = express.Router();

// 公司相关路由均需认证
router.get('/team', authenticate, Permission.rateLimit(500, 60*60*1000), getCompanyTeam);
router.get('/members', authenticate, Permission.rateLimit(500, 60*60*1000), getMembers);
router.post('/members', authenticate, Permission.rateLimit(200, 60*60*1000), addMember);
router.delete('/members/:member_id', authenticate, Permission.rateLimit(200, 60*60*1000), removeMember);
router.post('/certify', authenticate, Permission.rateLimit(50, 60*60*1000), submitCertification);
router.get('/recruitment-stats', authenticate, Permission.rateLimit(500, 60*60*1000), getRecruitmentStats);
router.get('/funnel-stats', authenticate, Permission.rateLimit(500, 60*60*1000), getFunnelStats);
router.get('/resume-stats', authenticate, Permission.rateLimit(500, 60*60*1000), getCompanyResumeStats);
router.get('/analysis-stats', authenticate, Permission.rateLimit(500, 60*60*1000), getCompanyAnalysisStats);
router.get('/efficiency-stats', authenticate, Permission.rateLimit(500, 60*60*1000), getEfficiencyStats);
router.get('/top-roles', authenticate, Permission.rateLimit(500, 60*60*1000), getTopRoles);
router.get('/recent-activity', authenticate, Permission.rateLimit(500, 60*60*1000), getRecentActivity);
router.get('/profile', authenticate, Permission.rateLimit(500, 60*60*1000), getCompanyProfile);
router.post('/profile', authenticate, Permission.rateLimit(200, 60*60*1000), upsertCompanyProfile);
router.put('/profile', authenticate, Permission.rateLimit(200, 60*60*1000), upsertCompanyProfile);

// 招聘流程 CRUD
router.get('/processes', authenticate, Permission.rateLimit(500, 60*60*1000), getCompanyProcesses);
router.post('/processes', authenticate, Permission.requireSubscription, Permission.rateLimit(200, 60*60*1000), createCompanyProcess);
router.put('/processes/:id', authenticate, Permission.requireSubscription, Permission.rateLimit(200, 60*60*1000), updateCompanyProcess);
router.delete('/processes/:id', authenticate, Permission.requireSubscription, Permission.rateLimit(200, 60*60*1000), deleteCompanyProcess);

module.exports = router;
