const express = require('express');
const { getAllJobs, getJobById, createJob, updateJob, deleteJob, importJobFromUrl } = require('../controllers/jobController');
const { authenticate } = require('../middleware/auth');
const Permission = require('../middleware/permission');

const router = express.Router();

// 所有职位相关路由都需要认证
router.get('/', authenticate, Permission.rateLimit(500, 60*60*1000), getAllJobs);
router.get('/:id', authenticate, Permission.rateLimit(500, 60*60*1000), getJobById);
router.post('/', authenticate, Permission.requireSubscription, Permission.rateLimit(300, 60*60*1000), createJob);
router.put('/:id', authenticate, Permission.requireSubscription, Permission.rateLimit(300, 60*60*1000), updateJob);
router.delete('/:id', authenticate, Permission.requireSubscription, Permission.rateLimit(200, 60*60*1000), deleteJob);

// URL一键导入职位
router.post('/import-url', authenticate, Permission.rateLimit(50, 60*60*1000), importJobFromUrl);

module.exports = router;
