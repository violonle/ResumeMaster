const express = require('express');
const { getAllResumes, getResumeById, createResume, updateResume, deleteResume } = require('../controllers/resumeController');
const { authenticate } = require('../middleware/auth');
const Permission = require('../middleware/permission');

const router = express.Router();

// 所有简历相关路由都需要认证
router.get('/', authenticate, Permission.rateLimit(500, 60*60*1000), getAllResumes);
router.get('/:id', authenticate, Permission.rateLimit(500, 60*60*1000), getResumeById);
router.post('/', authenticate, Permission.requireSubscription, Permission.checkApiLimit('resumeUpload'), Permission.rateLimit(300, 60*60*1000), createResume);
router.put('/:id', authenticate, Permission.requireSubscription, Permission.rateLimit(300, 60*60*1000), updateResume);
router.delete('/:id', authenticate, Permission.requireSubscription, Permission.rateLimit(200, 60*60*1000), deleteResume);

module.exports = router;
