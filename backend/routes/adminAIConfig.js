const express=require('express')
const { authenticateToken, requireAdmin } = require('../middleware/adminAuth')
const { getConfig, updateConfig, listModels, testProvider } = require('../controllers/adminAIConfigController')
const router=express.Router()
router.get('/ai-config', authenticateToken, requireAdmin, getConfig)
router.put('/ai-config', authenticateToken, requireAdmin, updateConfig)
router.post('/ai-config/test', authenticateToken, requireAdmin, testProvider)
router.get('/ai-providers/models', authenticateToken, requireAdmin, listModels)
module.exports=router
