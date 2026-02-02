const { Queue } = require('bullmq');
const { redis } = require('../utils/redis');
const logger = require('../utils/logger');

// 创建深度解析队列
const deepAnalysisQueue = new Queue('deep-analysis', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  }
});

/**
 * 添加解析任务到队列
 * @param {Object} data 任务数据
 * @returns {Promise<Job>}
 */
async function addAnalysisJob(data) {
  try {
    const { resumeId, scene = 'deep_analysis' } = data;
    const jobId = `analysis:${resumeId}:${scene}`;
    
    const job = await deepAnalysisQueue.add(jobId, data, {
      jobId: jobId // 确保同一个简历在同一个场景下不会重复添加未完成的任务
    });
    
    logger.info(`[QueueService] Job added: ${job.id}`);
    return job;
  } catch (error) {
    logger.error('[QueueService] Add job error:', error);
    throw error;
  }
}

module.exports = {
  deepAnalysisQueue,
  addAnalysisJob
};
