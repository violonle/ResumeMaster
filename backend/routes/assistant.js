const express = require('express')
const { chat, status, parseFile } = require('../controllers/assistantController')
const { authenticate } = require('../middleware/auth')
const router = express.Router()
router.get('/status', status)
router.post('/chat', chat)
router.post('/parse-file', authenticate, parseFile)
module.exports = router
