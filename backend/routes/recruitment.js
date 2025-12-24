const express = require('express')
const { authenticate } = require('../middleware/auth')
const ctrl = require('../controllers/recruitmentController')

const router = express.Router()

router.post('/candidates/:id/status', authenticate, ctrl.updateStatus)
router.post('/candidates/:id/schedule-interview', authenticate, ctrl.scheduleInterview)
router.post('/candidates/:id/interview-result', authenticate, ctrl.setInterviewResult)
router.post('/candidates/:id/send-offer', authenticate, ctrl.sendOffer)
router.post('/candidates/:id/hired', authenticate, ctrl.markHired)
router.post('/screen', authenticate, ctrl.screenCandidates)
router.post('/email/import-and-screen', authenticate, ctrl.importEmailAndScreen)
router.get('/pipeline', authenticate, ctrl.getPipeline)
router.post('/link', authenticate, ctrl.linkResumes)
router.get('/stats', authenticate, ctrl.getStats)

module.exports = router
