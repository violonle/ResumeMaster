const express = require('express')
const { authenticate } = require('../middleware/auth')
const Permission = require('../middleware/permission')
const { getTalentPoolResumes, uploadToLibrary, importEmailToLibrary } = require('../controllers/libraryController')

const router = express.Router()

router.get('/resumes', authenticate, Permission.rateLimit(500, 60*60*1000), getTalentPoolResumes)
router.post('/upload', authenticate, Permission.rateLimit(200, 60*60*1000), uploadToLibrary)
router.post('/email-import', authenticate, Permission.requireSubscription, Permission.rateLimit(200, 60*60*1000), importEmailToLibrary)

module.exports = router
