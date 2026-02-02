const { Job, ResumeJob, Resume, User, sequelize } = require('../models');
const { Op } = require('sequelize');
const aiController = require('../controllers/aiController');
const logger = require('../utils/logger');

/**
 * 自动快评服务
 * 负责定期检查开启了自动快评的职位，并对新投递的简历进行自动评分
 */
class AutoScreeningService {
  constructor() {
    this.batchSize = 10; // 每次处理的简历数量，避免过度占用资源
    this.isProcessing = false;
  }

  /**
   * 启动服务
   */
  start(intervalMs = 10 * 60 * 1000) { // 默认 10 分钟执行一次，符合用户要求
    logger.info(`[AutoScreening] 自动快评服务已启动，执行间隔: ${intervalMs / 1000 / 60} 分钟`);
    
    // 立即运行一次
    this.runAutoScreening();
    
    // 设置定时器
    setInterval(() => {
      this.runAutoScreening();
    }, intervalMs);
  }

  /**
   * 清理卡在“解析中”状态太久的简历
   */
  async resetStuckResumes() {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const stuckResumes = await Resume.findAll({
        where: {
          status: 'parsing',
          updated_at: { [Op.lt]: fiveMinutesAgo }
        }
      });

      if (stuckResumes.length > 0) {
        logger.info(`[AutoScreening] 发现 ${stuckResumes.length} 份解析超时的简历，重置状态...`);
        for (const resume of stuckResumes) {
          await resume.update({ status: 'uploaded' });
        }
      }
    } catch (error) {
      logger.error('[AutoScreening] 重置超时简历失败:', error);
    }
  }

  /**
   * 运行自动快评任务
   */
  async runAutoScreening() {
    if (this.isProcessing) {
      logger.info('[AutoScreening] 任务正在运行中，跳过本次执行');
      return;
    }

    this.isProcessing = true;
    console.log('[AutoScreening] DEBUG: 开始执行自动快评计划任务...');
    logger.info('[AutoScreening] 开始执行自动快评计划任务...');

    try {
      // 0. 重置卡住的任务
      await this.resetStuckResumes();

      // 1. 获取活跃职位
      const activeJobs = await Job.findAll({
        where: {
          status: 'active'
        },
        attributes: [
          'id', 'title', 'description', 'requirements', 'auto_reject_score', 
          'user_id', 'company_id', 'enable_auto_screening',
          'notify_high_score', 'high_score_threshold', 'enable_deep_analysis'
        ]
      });

      console.log(`[AutoScreening] DEBUG: 发现活跃职位数量: ${activeJobs ? activeJobs.length : 0}`);

      // 如果没有活跃职位，我们仍然可以处理未关联职位的简历，所以不直接 return
      const jobIds = activeJobs ? activeJobs.map(job => job.id) : [];
      
      // 2. 查找这些职位下待处理的简历 
      // 逻辑优化：
      // - 支持 status 为 'applied' (新投递) 或 'screening' (初筛中但还没评分)
      // - match_score 为空或为 0
      // - 增加 logging 以便排查
      let pendingApplications = [];
      if (jobIds.length > 0) {
        pendingApplications = await ResumeJob.findAll({
          where: {
            job_id: { [Op.in]: jobIds },
            status: { [Op.in]: ['applied', 'screening'] },
            [Op.or]: [
              { match_score: null },
              { match_score: 0 }
            ]
          },
          include: [
            {
              model: Resume,
              as: 'Resume',
              where: {
                status: { [Op.notIn]: ['parsing', 'failed'] } // 排除正在解析或已失败的
              }
            }
          ],
          limit: this.batchSize,
          order: [['applied_at', 'ASC']]
        });
      }

      if (pendingApplications.length > 0) {
        logger.info(`[AutoScreening] 发现 ${pendingApplications.length} 份关联职位的待处理申请`);
      }

      // 3. 额外查找人才库中未关联任何职位且未评分的简历 (处理 "unassigned" 简历)
      const unassignedResumes = await Resume.findAll({
        where: {
          is_talent_pool: true,
          [Op.or]: [
            { score: null },
            { score: 0 }
          ],
          status: { [Op.notIn]: ['parsing', 'failed', 'analyzed'] } // 排除已分析的
        },
        include: [
          {
            model: Job,
            as: 'Jobs',
            required: false,
            through: { attributes: [] }
          }
        ],
        limit: 5 // 每次处理少量未关联简历
      });

      const filteredUnassigned = unassignedResumes.filter(r => !r.Jobs || r.Jobs.length === 0);
      
      if (filteredUnassigned.length > 0) {
        logger.info(`[AutoScreening] 发现 ${filteredUnassigned.length} 份人才库中未关联职位的待快评简历`);
      }

      if (pendingApplications.length === 0 && filteredUnassigned.length === 0) {
        // 降低日志级别，避免刷屏，但在 DEBUG 模式下保留
        console.log('[AutoScreening] DEBUG: 没有发现待处理简历');
        return;
      }

      logger.info(`[AutoScreening] 准备处理: 关联职位(${pendingApplications.length}) + 人才库未关联(${filteredUnassigned.length})`);

      // 4. 处理关联了职位的简历
      for (const application of pendingApplications) {
        try {
          const job = activeJobs.find(j => j.id === application.job_id);
          const resume = application.Resume;
          
          if (!job || !resume) {
            logger.warn(`[AutoScreening] 数据不完整，跳过: jobId=${application.job_id}, resumeId=${application.resume_id}`);
            continue;
          }

          // 逻辑优化：
          // 1. 如果职位开启了自动快评，必须处理
          // 2. 如果职位没开启自动快评：
          //    - 如果状态是 'applied'，跳过（符合用户手动触发的需求）
          //    - 如果状态是 'screening' 但没分数，说明进入了初筛流程但评分遗漏，应该补齐分数
          if (!job.enable_auto_screening && application.status === 'applied') {
            console.log(`[AutoScreening] 职位 ${job.title} (ID: ${job.id}) 未开启自动快评且状态为 'applied'，跳过简历 ${resume.file_name} (ID: ${resume.id})`);
            continue;
          }

          // 如果分数已经是有效值（防止极少数并发情况），跳过
          if (application.match_score > 0) {
            console.log(`[AutoScreening] 简历 ${resume.id} 已有分数 ${application.match_score}，跳过`);
            continue;
          }

          // 获取职位的创建者（HR/管理员）作为 AI 请求的上下文
          const hrUser = await User.findByPk(job.user_id);
          if (!hrUser) {
            logger.warn(`[AutoScreening] 找不到职位 ${job.id} 的创建者，跳过该简历`);
            continue;
          }

          const userContext = {
            id: hrUser.id,
            company_id: hrUser.company_id,
            role: hrUser.role
          };

          const jobDescription = {
            id: job.id,
            title: job.title,
            description: job.description,
            requirements: job.requirements
          };

          logger.info(`[AutoScreening] 正在处理简历: ${resume.id} (${resume.file_name}) -> 职位: ${job.title}`);

          // 更新简历状态为解析中，避免重复处理
          await resume.update({ status: 'parsing' });

          // 确定分析场景：统一先进行快速打分
          const scene = 'resume_quick_score';

          // 调用后台分析逻辑
          await aiController.processAnalysisBackground(
            resume.id,
            resume.raw_text || '',
            jobDescription,
            userContext,
            { 
              scene: scene, 
              jobId: job.id,
              isAutoScreening: true,
              notify_high_score: job.notify_high_score,
              high_score_threshold: job.high_score_threshold
            }
          );

          // 自动深度解析触发：在 aiController.processAnalysisBackground 内部，
          // 如果 scene 是 resume_quick_score 且快评通过，且 job.enable_deep_analysis 为 true，
          // 它会自动调用 deepAnalysisService.triggerImmediate(resumeId, jobId)。
          // 这样就实现了：自动快评 -> (若通过) -> 自动深度解析 的流水线。

        } catch (err) {
          logger.error(`[AutoScreening] 处理简历 ${application.resume_id} 时出错:`, err);
          const resume = await Resume.findByPk(application.resume_id);
          if (resume && resume.status === 'parsing') {
            await resume.update({ status: 'uploaded' });
          }
        }
      }

      // 5. 处理未关联职位的简历 (为它们分配一个默认职位或该公司的第一个活跃职位)
      for (const resume of filteredUnassigned) {
        try {
          // 找到该简历所属用户/公司的第一个活跃职位
          const fallbackJob = activeJobs.find(j => 
            (resume.company_id && j.company_id === resume.company_id) || 
            (j.user_id === resume.user_id)
          );

          if (!fallbackJob) {
            logger.warn(`[AutoScreening] 无法为未关联简历 ${resume.id} 找到合适的 fallback 职位`);
            continue;
          }

          logger.info(`[AutoScreening] 为未关联简历 ${resume.id} 分配 fallback 职位: ${fallbackJob.title}`);

          // 创建关联
          await ResumeJob.create({
            resume_id: resume.id,
            job_id: fallbackJob.id,
            user_id: resume.user_id, // 修复：增加 user_id
            status: 'applied',
            applied_at: new Date()
          });

          // 重新标记为 uploaded 以便下次循环或当前循环处理 (这里简单处理，标记后在日志中记录)
          // 实际上可以立即调用 processAnalysisBackground
          const hrUser = await User.findByPk(fallbackJob.user_id);
          if (hrUser) {
            await resume.update({ status: 'parsing' });
            await aiController.processAnalysisBackground(
              resume.id,
              resume.raw_text || '',
              {
                id: fallbackJob.id,
                title: fallbackJob.title,
                description: fallbackJob.description,
                requirements: fallbackJob.requirements
              },
              { id: hrUser.id, company_id: hrUser.company_id, role: hrUser.role },
              { scene: 'resume_quick_score', jobId: fallbackJob.id }
            );
          }
        } catch (err) {
          logger.error(`[AutoScreening] 处理未关联简历 ${resume.id} 时出错:`, err);
        }
      }

    } catch (error) {
      logger.error('[AutoScreening] 自动快评任务执行失败:', error);
    } finally {
      this.isProcessing = false;
      logger.info('[AutoScreening] 自动快评计划任务执行完毕');
    }
  }

  /**
   * 为单份简历立即触发自动快评
   * @param {number|string} resumeId 简历ID
   * @param {number|string} jobId 职位ID (可选, 'unassigned' 表示人才库未关联简历)
   */
  async triggerImmediateScreening(resumeId, jobId) {
    if (!resumeId) return;

    try {
      let job = null;
      let hrUser = null;
      let targetJobId = jobId;

      // 1. 获取简历信息
      const resume = await Resume.findByPk(resumeId);
      if (!resume || resume.status === 'parsing' || resume.status === 'failed') {
        logger.warn(`[AutoScreening] 简历 ${resumeId} 不存在或状态不符合自动快评要求`);
        return;
      }

      // 2. 确定职位和 HR 用户
      if (targetJobId && targetJobId !== 'unassigned') {
        job = await Job.findOne({
          where: {
            id: targetJobId,
            status: 'active'
          }
        });
        
        if (job) {
          hrUser = await User.findByPk(job.user_id);
        }
      }

      // 如果没有指定职位或职位无效，尝试寻找该用户的 fallback 职位
      if (!job) {
        // 查找该简历所属用户的第一个活跃职位
        job = await Job.findOne({
          where: {
            [Op.or]: [
              resume.company_id ? { company_id: resume.company_id } : null,
              { user_id: resume.user_id }
            ].filter(Boolean),
            status: 'active'
          }
        });

        if (job) {
          hrUser = await User.findByPk(job.user_id);
          targetJobId = job.id;
        }
      }

      if (!job || !hrUser) {
        logger.warn(`[AutoScreening] 无法为简历 ${resumeId} 找到合适的职位或 HR 上下文，跳过立即触发`);
        return;
      }

      const userContext = {
        id: hrUser.id,
        company_id: hrUser.company_id,
        role: hrUser.role
      };

      const jobDescription = {
        id: job.id,
        title: job.title,
        description: job.description,
        requirements: job.requirements
      };

      logger.info(`[AutoScreening] 正在立即触发自动快评: 简历 ${resumeId} -> 职位 ${job.title}`);

      // 3. 更新简历状态
      await resume.update({ status: 'parsing' });

      // 4. 调用后台分析逻辑
      aiController.processAnalysisBackground(
        resume.id,
        resume.raw_text || '',
        jobDescription,
        userContext,
        { 
          scene: 'resume_quick_score', 
          jobId: job.id 
        }
      ).catch(err => {
        logger.error(`[AutoScreening] 立即触发快评后台处理出错: ${resumeId}`, err);
        Resume.update({ status: 'uploaded' }, { where: { id: resumeId, status: 'parsing' } }).catch(() => {});
      });

    } catch (error) {
      logger.error(`[AutoScreening] 立即触发自动快评失败: ${resumeId}`, error);
    }
  }
}

module.exports = new AutoScreeningService();
