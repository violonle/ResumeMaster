const express = require('express');
const router = express.Router();
const promptController = require('../controllers/promptController');
const { authenticateToken, requireAdmin } = require('../middleware/adminAuth');

// Prompt management routes - Restricted to Admin/AI Admins
// Assuming 'ai_models.view' and 'ai_models.manage' permissions cover this as it's part of "Large Model Management"

router.get('/', authenticateToken, requireAdmin, promptController.list);
router.get('/:key', authenticateToken, requireAdmin, promptController.get);
router.put('/:key', authenticateToken, requireAdmin, promptController.update);
router.post('/', authenticateToken, requireAdmin, promptController.create);

module.exports = router;