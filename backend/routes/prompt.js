const express = require('express');
const router = express.Router();
const promptController = require('../controllers/promptController');
const { authenticate } = require('../middleware/auth');
const Permission = require('../middleware/permission');

// Prompt management routes - Restricted to Admin/AI Admins
// Assuming 'ai_models.view' and 'ai_models.manage' permissions cover this as it's part of "Large Model Management"

router.get('/', authenticate, Permission.requirePermission('ai_models.view'), promptController.list);
router.get('/:key', authenticate, Permission.requirePermission('ai_models.view'), promptController.get);
router.put('/:key', authenticate, Permission.requirePermission('ai_models.manage'), promptController.update);
router.post('/', authenticate, Permission.requirePermission('ai_models.manage'), promptController.create);

module.exports = router;