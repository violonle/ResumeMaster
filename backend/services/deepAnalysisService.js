const { ResumeJob, Job, Resume, User, AnalysisResult, sequelize } = require('../models');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

/**
 * 深度解析服务
 * 负责处理自动深度解析的即时触发与定期轮询
 */
class DeepAnalysisService {
  constructor() {
    this.isPolling = false;
    this.intervalId = null;
    this.maxConcurrent = 3; // 最大并发数
    this.maxRetries = 3;    // 最大重试次数
    this.activeTasks = 0;   // 当前活跃任务数
  }

  /**
   * 启动轮询机制
   * @param {number} intervalMs 轮询间隔，默认10分钟
   */
  start(intervalMs = 10 * 60 * 1000) {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    
    logger.info(`[DeepAnalysisService] Started polling every ${intervalMs / 60000} minutes`);
    this.intervalId = setInterval(() => this.processPolling(), intervalMs);
    
    // 启动时延迟 30 秒执行第一次扫描，避开启动高峰
    setTimeout(() => this.processPolling(), 30000);
  }

  /**
   * 停止轮询
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('[DeepAnalysisService] Polling stopped');
    }
  }

  /**
   * 轮询处理逻辑
   */
  async processPolling() {
    if (this.isPolling) {
      logger.warn('[DeepAnalysisService] Polling already in progress, skipping this round');
      return;
    }
    this.isPolling = true;

    try {
      logger.info('[DeepAnalysisService] Scanning for pending deep analysis tasks...');
      
      // 1. 查找所有开启了自动深度解析的活跃职位
      const activeJobs = await Job.findAll({
        where: {
          status: 'active',
          enable_deep_analysis: true
        }
      });

      if (activeJobs.length === 0) {
        logger.info('[DeepAnalysisService] No active jobs with deep analysis enabled');
        return;
      }

      for (const job of activeJobs) {
        // 2. 查找该职位下符合条件的简历：
        // - 快评通过（分数 >= 自动淘汰分）
        // - 状态为 'none' 或 'failed' (且重试次数未超限)
        // - 招聘状态不是 '淘汰'
        const pendingResumes = await ResumeJob.findAll({
          where: {
            job_id: job.id,
            [Op.and]: [
              {
                [Op.or]: [
                  { deep_analysis_status: { [Op.in]: ['none', 'failed'] } },
                  { deep_analysis_status: { [Op.is]: null } }
                ]
              },
              {
                [Op.or]: [
                  { deep_analysis_retry_count: { [Op.lt]: this.maxRetries } },
                  { deep_analysis_retry_count: { [Op.is]: null } }
                ]
              }
            ],
            match_score: { [Op.gte]: job.auto_reject_score || 0 }
          },
          include: [{ model: Resume, as: 'Resume' }],
          limit: 10 // 每次每个职位最多处理10个，防止单次轮询时间过长
        });

        if (pendingResumes.length > 0) {
          logger.info(`[DeepAnalysisService] Found ${pendingResumes.length} pending resumes for Job ID ${job.id}`);
          
          for (const rj of pendingResumes) {
            // 控制并发
            while (this.activeTasks >= this.maxConcurrent) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            // 异步触发，不等待完成，由 triggerAnalysis 内部处理并发计数
            this.triggerAnalysis(rj, job, 'auto_polling').catch(err => {
              logger.error(`[DeepAnalysisService] Background task error: ${err.message}`);
            });

            // 在提交下一个任务前稍微停顿一下，避免瞬间压力过大
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }
    } catch (error) {
      logger.error(`[DeepAnalysisService] Polling error: ${error.stack}`);
    } finally {
      this.isPolling = false;
    }
  }

  /**
   * 即时触发深度解析
   * @param {number} resumeId 简历ID
   * @param {number} jobId 职位ID
   */
  async triggerImmediate(resumeId, jobId) {
    try {
      const job = await Job.findByPk(jobId);
      if (!job || !job.enable_deep_analysis) return;

      const rj = await ResumeJob.findOne({
        where: { resume_id: resumeId, job_id: jobId },
        include: [{ model: Resume, as: 'Resume' }]
      });

      if (rj && (!rj.deep_analysis_status || rj.deep_analysis_status === 'none' || rj.deep_analysis_status === 'failed')) {
        await this.triggerAnalysis(rj, job, 'auto_immediate');
      }
    } catch (error) {
      logger.error(`[DeepAnalysisService] Immediate trigger error: ${error.message}`);
    }
  }

  /**
   * 执行解析任务
   * @param {Object} rj ResumeJob 实例
   * @param {Object} job Job 实例
   * @param {string} triggerSource 触发来源
   */
  async triggerAnalysis(rj, job, triggerSource) {
    if (this.activeTasks >= this.maxConcurrent) {
      logger.warn(`[DeepAnalysisService] Max concurrent tasks reached (${this.maxConcurrent}). Task for Resume ${rj.resume_id} deferred.`);
      return;
    }

    this.activeTasks++;
    
    try {
      // 检查简历是否存在
      const resume = rj.Resume;
      if (!resume) {
        throw new Error(`Resume record missing for ID ${rj.resume_id}`);
      }

      // 更新状态为 processing
      await rj.update({
        deep_analysis_status: 'processing',
        deep_analysis_trigger: triggerSource,
        deep_analysis_error: null
      });

      logger.info(`[DeepAnalysisService][Task-${rj.resume_id}] START: Delegating to AIController for Resume ${rj.resume_id} (Trigger: ${triggerSource})`);

      // 统一调用 aiController.processAnalysisBackground
      const aiController = require('../controllers/aiController');
      const user = await User.findByPk(rj.user_id);
      
      if (!user) {
        throw new Error(`User record missing for ID ${rj.user_id}`);
      }

      const userCtx = { id: user.id, company_id: user.company_id, role: user.role };
      const jobDesc = {
        id: job.id,
        title: job.title,
        description: job.description,
        requirements: job.requirements
      };

      // 调用后台分析逻辑，强制 scene 为 deep_analysis
      await aiController.processAnalysisBackground(
        resume.id,
        resume.raw_text || '',
        jobDesc,
        userCtx,
        { 
          scene: 'deep_analysis', 
          jobId: job.id,
          isDeepAnalysis: true 
        }
      );

      // 注意：aiController.processAnalysisBackground 会自己处理 ResumeJob 的状态更新
      logger.info(`[DeepAnalysisService][Task-${rj.resume_id}] SUCCESS: Delegation to AIController completed`);

    } catch (error) {
      const newRetryCount = (rj.deep_analysis_retry_count || 0) + 1;
      logger.error(`[DeepAnalysisService][Task-${rj.resume_id}] FAILED: ${error.message} (Retry: ${newRetryCount}/${this.maxRetries})`);
      
      await rj.update({ 
        deep_analysis_status: 'failed',
        deep_analysis_retry_count: newRetryCount,
        deep_analysis_error: error.message
      });
    } finally {
      this.activeTasks--;
    }
  }
}

module.exports = new DeepAnalysisService();
