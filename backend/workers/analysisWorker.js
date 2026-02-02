const { Worker } = require('bullmq');
const { redis } = require('../utils/redis');
const logger = require('../utils/logger');
const aiAnalysisCoreService = require('../services/aiAnalysisCoreService');
const socketService = require('../services/socketService');

// 创建 Worker
const worker = new Worker('deep-analysis', async (job) => {
  const { resumeId, text, jobDescription, user, options, force } = job.data;
  
  logger.info(`[Worker] Processing job ${job.id} for resume ${resumeId}`);
  
  try {
    // 设置硬超时告警
    const timeout = setTimeout(() => {
      logger.warn(`[Worker] Job ${job.id} is taking too long (over 150s)!`);
      socketService.emitToRoom(`resume_${resumeId}`, 'analysis_progress', {
        status: 'slow',
        message: '解析耗时较长，请稍候...'
      });
    }, 150000);

    const result = await aiAnalysisCoreService.processAnalysis(
      resumeId, 
      text, 
      jobDescription, 
      user, 
      options, 
      null, 
      null, 
      force
    );
    
    clearTimeout(timeout);
    logger.info(`[Worker] Job ${job.id} completed successfully`);
    
    // 发送 WebSocket 通知前端
    socketService.emitToRoom(`resume_${resumeId}`, 'analysis_completed', {
      success: true,
      resumeId: resumeId,
      data: result
    });
    
    return result;
  } catch (error) {
    logger.error(`[Worker] Job ${job.id} failed:`, error);
    
    // 发送 WebSocket 失败通知
    socketService.emitToRoom(`resume_${resumeId}`, 'analysis_failed', {
      success: false,
      resumeId: resumeId,
      error: error.message
    });
    
    throw error;
  }
}, {
  connection: redis,
  concurrency: 4, // 对应用户要求的“最大并发 4”
  lockDuration: 180000 // 180s 锁定时间，对应用户要求的硬超时
});

worker.on('failed', (job, err) => {
  logger.error(`[Worker] Job ${job.id} failed with ${err.message}`);
});

module.exports = worker;
