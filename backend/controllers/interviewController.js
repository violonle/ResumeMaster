const { InterviewSession, Resume, ResumeJob, Job, sequelize } = require('../models');
const DomesticAIService = require('../services/domesticAIService');
const aiService = new DomesticAIService();
const logger = require('../utils/logger');

/**
 * 面试控制器
 */
class InterviewController {
  /**
   * 从简历对象中重建或提取文本内容
   */
  _extractResumeText(resume) {
    if (!resume) return '';
    
    // 1. 优先使用原始文本
    if (resume.raw_text && resume.raw_text.trim() !== '') {
      return resume.raw_text;
    }

    // 2. 尝试从解析数据中提取预设的文本字段
    const data = resume.parsed_data || {};
    if (data.resume_text && data.resume_text.trim() !== '') return data.resume_text;
    if (data.text && data.text.trim() !== '') return data.text;

    // 3. 如果都没有，则根据结构化字段重建文本
    const textParts = [];
    
    // 基本信息
    const name = resume.name || data.name;
    const title = resume.job_title || data.job_title;
    if (name) textParts.push(`姓名: ${name}`);
    if (title) textParts.push(`意向职位: ${title}`);
    if (resume.experience_years || data.experience_years) {
      textParts.push(`工作经验: ${resume.experience_years || data.experience_years}年`);
    }

    // 核心技能
    const skills = resume.skills || data.skills;
    if (skills) {
      const skillsStr = Array.isArray(skills) ? skills.join(', ') : skills;
      textParts.push(`核心技能: ${skillsStr}`);
    }

    // 工作经历
    const workExp = resume.work_experience || data.work_experience || data.experience;
    if (workExp && Array.isArray(workExp) && workExp.length > 0) {
      textParts.push('\n【工作经历】');
      workExp.forEach(exp => {
        textParts.push(`- ${exp.company || '未知公司'} | ${exp.position || '职位未标注'} | ${exp.duration || ''}`);
        if (exp.description) textParts.push(`  职责描述: ${exp.description}`);
      });
    }

    // 项目经验
    const projects = resume.projects || data.projects;
    if (projects && Array.isArray(projects) && projects.length > 0) {
      textParts.push('\n【项目经验】');
      projects.forEach(p => {
        textParts.push(`- ${p.name || '项目名称'} | ${p.role || ''} | ${p.duration || ''}`);
        if (p.description) textParts.push(`  项目描述: ${p.description}`);
      });
    }

    // 教育背景
    const edu = resume.education || data.education;
    if (edu && Array.isArray(edu) && edu.length > 0) {
      textParts.push('\n【教育背景】');
      edu.forEach(e => {
        textParts.push(`- ${e.school || '院校'} | ${e.degree || ''} | ${e.major || ''} | ${e.duration || ''}`);
      });
    }

    return textParts.join('\n').trim();
  }

  /**
   * 创建面试会话
   */
  async createSession(req, res) {
    try {
      const { resumeText, questionCount, resumeId, resumeJobId, forceCreate = false } = req.body;
      logger.info(`开始创建面试会话: resumeId=${resumeId}, resumeJobId=${resumeJobId}, hasResumeText=${!!resumeText}`);

      let finalResumeText = resumeText;
      let rjId = resumeJobId;
      let finalResumeId = resumeId;
      let finalQuestionCount = questionCount || 8;
      let finalJobDescription = '';

      // 如果提供了 resumeJobId，优先使用它来获取简历和题目数量
      if (rjId) {
        const rj = await ResumeJob.findByPk(rjId, {
          include: [
            { model: Resume },
            { model: Job }
          ]
        });
        if (rj) {
          logger.info(`找到关联的 ResumeJob: ${rj.id}`);
          
          // 获取职位描述
          if (rj.Job) {
            finalJobDescription = rj.Job.description || rj.Job.requirements || '';
            logger.info(`从关联职位获取到描述，长度: ${finalJobDescription.length}`);
          }

          // 尝试从 recruiter_notes 中获取预设的题目数量
          if (rj.recruiter_notes) {
            try {
              const notes = typeof rj.recruiter_notes === 'string' ? JSON.parse(rj.recruiter_notes) : rj.recruiter_notes;
              if (notes.interview && notes.interview.aiQuestionCount) {
                finalQuestionCount = parseInt(notes.interview.aiQuestionCount);
                logger.info(`使用预设的 AI 面试题目数量: ${finalQuestionCount}`);
              }
            } catch (e) {
              logger.warn('解析 recruiter_notes 失败:', e);
            }
          }

          if (rj.Resume) {
            finalResumeId = rj.resume_id;
            finalResumeText = this._extractResumeText(rj.Resume);
            logger.info(`从 ResumeJob 关联的 Resume 获取到文本，长度: ${finalResumeText?.length || 0}`);
          } else {
            logger.warn(`ResumeJob ${rjId} 关联的 Resume 不存在`);
          }
        } else {
          logger.warn(`未找到 ResumeJob: ${rjId}`);
        }
      } else if (finalResumeId) {
        // 如果只提供了 resumeId，尝试获取简历文本和关联的申请记录
        const resume = await Resume.findByPk(finalResumeId);
        if (resume) {
          logger.info(`找到 Resume: ${resume.id}`);
          finalResumeText = this._extractResumeText(resume);
          logger.info(`获取到 Resume 文本，长度: ${finalResumeText?.length || 0}`);
          
          const rj = await ResumeJob.findOne({
            where: { resume_id: finalResumeId },
            include: [{ model: Job }],
            order: [['applied_at', 'DESC']]
          });
          if (rj) {
            rjId = rj.id;
            logger.info(`找到该简历关联的最新申请记录: ${rjId}`);
            if (rj.Job) {
              finalJobDescription = rj.Job.description || rj.Job.requirements || '';
              logger.info(`从关联职位获取到描述，长度: ${finalJobDescription.length}`);
            }
          }
        } else {
          logger.warn(`未找到 Resume: ${finalResumeId}`);
        }
      }

      // 检查简历内容
      if (!finalResumeText || finalResumeText.trim() === '') {
        logger.warn(`创建面试失败: 简历内容为空. resumeId=${finalResumeId}, resumeJobId=${rjId}`);
        return res.status(400).json({ success: false, error: '简历内容不能为空，请先在简历库中完善简历文本' });
      }

      // 查找该简历是否已有活跃会话
      if (!forceCreate) {
        const { Op } = require('sequelize');
        const existingSession = await InterviewSession.findOne({
          where: {
            resume_id: finalResumeId,
            status: { [Op.ne]: 'COMPLETED' }
          },
          order: [['created_at', 'DESC']]
        });

        if (existingSession) {
          logger.info(`找到已有活跃会话: ${existingSession.id}`);
          
          // 获取简历详情用于返回
          let candidateName = '';
          let candidatePhone = '';
          try {
            const resume = await Resume.findByPk(existingSession.resume_id);
            if (resume) {
              const data = resume.parsed_data || {};
              candidateName = resume.name || data.name || '';
              candidatePhone = resume.phone || data.phone || '';
            }
          } catch (e) {
            logger.warn('获取候选人信息失败:', e);
          }

          return res.json({
            success: true,
            data: {
              sessionId: existingSession.id,
              id: existingSession.id,
              resumeText: existingSession.resume_text,
              resumeId: existingSession.resume_id,
              resumeJobId: existingSession.resume_job_id,
              totalQuestions: existingSession.total_questions,
              currentQuestionIndex: existingSession.current_question_index,
              questions: existingSession.questions,
              status: existingSession.status,
              report: existingSession.report,
              createdAt: existingSession.created_at,
              updatedAt: existingSession.updated_at,
              candidateName,
              candidatePhone
            }
          });
        }
      }

      // 调用 AI 生成面试题
      const aiResult = await aiService.analyzeResume(
        finalResumeText,
        finalJobDescription, // 直接传递 JD，让 aiService 和 promptService 处理格式
        null,
        'interview_question_generation',
        finalQuestionCount
      );

      if (!aiResult.success) {
        throw new Error(aiResult.error || '生成面试题失败');
      }

      const questionsData = aiResult.data?.questions || [];
      if (questionsData.length === 0) {
        throw new Error('AI 未能生成有效的面试题');
      }

      // 预处理题目格式，添加用户答案等字段
      const formattedQuestions = questionsData.map(q => ({
        ...q,
        userAnswer: null,
        score: null,
        feedback: null
      }));

      // 创建会话
      const session = await InterviewSession.create({
        resume_job_id: rjId,
        resume_id: finalResumeId,
        resume_text: finalResumeText,
        total_questions: formattedQuestions.length,
        current_question_index: 0,
        questions: formattedQuestions,
        status: 'CREATED'
      });

      // 成功返回
      const sessionData = session.toJSON();
      
      // 获取简历详情用于返回
      let candidateName = '';
      let candidatePhone = '';
      try {
        const resume = await Resume.findByPk(finalResumeId);
        if (resume) {
          const data = resume.parsed_data || {};
          candidateName = resume.name || data.name || '';
          candidatePhone = resume.phone || data.phone || '';
        }
      } catch (e) {
        logger.warn('获取候选人信息失败:', e);
      }

      return res.json({
        success: true,
        data: {
          sessionId: session.id,
          id: session.id,
          resumeText: session.resume_text,
          resumeId: session.resume_id,
          resumeJobId: session.resume_job_id,
          totalQuestions: session.total_questions,
          currentQuestionIndex: session.current_question_index,
          questions: session.questions,
          status: session.status,
          report: session.report,
          createdAt: session.created_at,
          updatedAt: session.updated_at,
          candidateName,
          candidatePhone
        }
      });

    } catch (error) {
      logger.error('创建面试会话失败:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * 提交面试回答
   */
  async submitAnswer(req, res) {
    try {
      const { sessionId, questionIndex, answer } = req.body;
      const id = req.params.sessionId || sessionId;

      const session = await InterviewSession.findByPk(id);
      if (!session) {
        return res.status(404).json({ success: false, error: `面试会话不存在 (ID: ${id})` });
      }

      if (session.status === 'COMPLETED' || session.status === 'EVALUATED') {
        return res.status(400).json({ success: false, error: '面试已结束' });
      }

      // 更新当前题目答案
      const questions = JSON.parse(JSON.stringify(session.questions));
      
      // 鲁棒性校验：确保索引在有效范围内
      if (questionIndex < 0 || questionIndex >= questions.length) {
        logger.error(`无效的问题索引提交: sessionId=${id}, index=${questionIndex}, total=${questions.length}`);
        return res.status(400).json({ 
          success: false, 
          error: `无效的问题索引: ${questionIndex}。当前面试共有 ${questions.length} 道题。` 
        });
      }

      questions[questionIndex].userAnswer = answer;
      
      const isLastQuestion = questionIndex === questions.length - 1;
      const nextIndex = isLastQuestion ? questionIndex : questionIndex + 1;
      const nextStatus = isLastQuestion ? 'COMPLETED' : 'IN_PROGRESS';

      await session.update({
        questions,
        current_question_index: nextIndex,
        status: nextStatus
      });

      // 如果面试结束，异步生成评估报告
      if (isLastQuestion) {
        this.generateReportBackground(session.id).catch(err => {
          logger.error('异步生成面试报告失败:', err);
        });
      }

      return res.json({
        success: true,
        data: {
          sessionId: session.id,
          id: session.id,
          hasNextQuestion: !isLastQuestion,
          nextQuestion: isLastQuestion ? null : questions[nextIndex],
          currentIndex: nextIndex,
          currentQuestionIndex: nextIndex,
          totalQuestions: session.total_questions,
          status: session.status
        }
      });

    } catch (error) {
      logger.error('提交面试回答失败:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * 获取面试会话详情
   */
  async getSession(req, res) {
    try {
      const { sessionId } = req.params;
      const session = await InterviewSession.findByPk(sessionId);

      if (!session) {
        return res.status(404).json({ success: false, error: '面试会话不存在' });
      }

      // 获取简历详情用于返回
      let candidateName = '';
      let candidatePhone = '';
      try {
        const resume = await Resume.findByPk(session.resume_id);
        if (resume) {
          const data = resume.parsed_data || {};
          candidateName = resume.name || data.name || '';
          candidatePhone = resume.phone || data.phone || '';
        }
      } catch (e) {
        logger.warn('获取候选人信息失败:', e);
      }

      return res.json({
        success: true,
        data: {
          sessionId: session.id,
          id: session.id,
          resumeText: session.resume_text,
          resumeId: session.resume_id,
          resumeJobId: session.resume_job_id,
          totalQuestions: session.total_questions,
          currentQuestionIndex: session.current_question_index,
          questions: session.questions,
          status: session.status,
          report: session.report,
          createdAt: session.created_at,
          updatedAt: session.updated_at,
          candidateName,
          candidatePhone
        }
      });
    } catch (error) {
      logger.error('获取面试会话失败:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * 获取当前题目
   */
  async getCurrentQuestion(req, res) {
    try {
      const { sessionId } = req.params;
      const session = await InterviewSession.findByPk(sessionId);
      if (!session) {
        return res.status(404).json({ success: false, error: '面试会话不存在' });
      }

      if (session.status === 'COMPLETED' || session.status === 'EVALUATED') {
        return res.json({
          success: true,
          data: { completed: true, message: '面试已结束' }
        });
      }

      const currentQuestion = session.questions[session.current_question_index];
      return res.json({
        success: true,
        data: {
          completed: false,
          sessionId: session.id,
          id: session.id,
          resumeText: session.resume_text,
          resumeId: session.resume_id,
          resumeJobId: session.resume_job_id,
          totalQuestions: session.total_questions,
          currentQuestionIndex: session.current_question_index,
          questions: session.questions,
          status: session.status,
          question: currentQuestion
        }
      });

    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * 获取面试报告
   */
  async getReport(req, res) {
    try {
      const { sessionId } = req.params;
      const session = await InterviewSession.findByPk(sessionId);
      if (!session) {
        return res.status(404).json({ success: false, error: '面试会话不存在' });
      }

      if (session.status !== 'EVALUATED' && session.status !== 'COMPLETED') {
        return res.status(400).json({ success: false, error: '面试尚未完成' });
      }

      // 如果还没有报告，尝试生成
      if (!session.report) {
        await this.generateReportBackground(session.id);
        const updatedSession = await InterviewSession.findByPk(sessionId);
        return res.json({ success: true, data: updatedSession.report });
      }

      return res.json({ success: true, data: session.report });

    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * 查找未完成的面试会话
   */
  async findUnfinishedSession(req, res) {
    try {
      const { resumeId } = req.params;
      const session = await InterviewSession.findOne({
        where: {
          resume_id: resumeId,
          status: ['CREATED', 'IN_PROGRESS']
        },
        order: [['created_at', 'DESC']]
      });

      if (!session) {
        return res.json({ success: true, data: null });
      }

      // 获取简历详情用于返回
      let candidateName = '';
      let candidatePhone = '';
      try {
        const resume = await Resume.findByPk(session.resume_id);
        if (resume) {
          const data = resume.parsed_data || {};
          candidateName = resume.name || data.name || '';
          candidatePhone = resume.phone || data.phone || '';
        }
      } catch (e) {
        logger.warn('获取候选人信息失败:', e);
      }

      return res.json({
        success: true,
        data: {
          sessionId: session.id,
          id: session.id,
          resumeText: session.resume_text,
          resumeId: session.resume_id,
          resumeJobId: session.resume_job_id,
          totalQuestions: session.total_questions,
          currentQuestionIndex: session.current_question_index,
          questions: session.questions,
          status: session.status,
          report: session.report,
          createdAt: session.created_at,
          updatedAt: session.updated_at,
          candidateName,
          candidatePhone
        }
      });
    } catch (error) {
      logger.error('查找未完成面试会话失败:', error);
      res.status(500).json({ success: false, error: '查找未完成面试会话失败' });
    }
  }

  /**
   * 暂存回答（不进入下一题）
   */
  async saveAnswer(req, res) {
    try {
      const id = req.params.sessionId;
      const { questionIndex, answer } = req.body;

      const session = await InterviewSession.findByPk(id);
      if (!session) {
        return res.status(404).json({ success: false, error: `面试会话不存在 (ID: ${id})` });
      }

      const questions = [...session.questions];
      if (questionIndex < 0 || questionIndex >= questions.length) {
        return res.status(400).json({ success: false, error: '无效的题目索引' });
      }

      questions[questionIndex].userAnswer = answer;
      
      await session.update({
        questions,
        status: 'IN_PROGRESS'
      });

      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * 提前交卷
   */
  async completeInterview(req, res) {
    try {
      const id = req.params.sessionId;
      const session = await InterviewSession.findByPk(id);
      if (!session) {
        return res.status(404).json({ success: false, error: `面试会话不存在 (ID: ${id})` });
      }

      await session.update({ status: 'COMPLETED' });
      
      // 异步生成报告
      this.generateReportBackground(session.id).catch(err => {
        logger.error('异步生成面试报告失败:', err);
      });

      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * 后台生成评估报告
   */
  async generateReportBackground(sessionId) {
    try {
      const session = await InterviewSession.findByPk(sessionId);
      if (!session || session.questions.some(q => q.userAnswer === null)) return;

      const questions = [...session.questions];
      const evaluations = [];
      
      // 逐个评估题目
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const result = await aiService.analyzeResume(
          `题目: ${q.question}\n回答: ${q.userAnswer}`,
          '',
          null,
          'interview_answer_evaluation'
        );

        if (result.success && result.data) {
          questions[i].score = result.data.score;
          questions[i].feedback = result.data.feedback;
          evaluations.push({
            questionIndex: q.questionIndex,
            question: q.question,
            category: q.category,
            userAnswer: q.userAnswer,
            score: result.data.score,
            feedback: result.data.feedback,
            referenceAnswer: result.data.referenceAnswer,
            keyPoints: result.data.keyPoints
          });
        }
      }

      // 计算总分和各类别分数
      const overallScore = Math.round(evaluations.reduce((sum, e) => sum + e.score, 0) / evaluations.length);
      const categoryMap = {};
      evaluations.forEach(e => {
        if (!categoryMap[e.category]) {
          categoryMap[e.category] = { scoreSum: 0, count: 0 };
        }
        categoryMap[e.category].scoreSum += e.score;
        categoryMap[e.category].count += 1;
      });

      const categoryScores = Object.keys(categoryMap).map(cat => ({
        category: cat,
        score: Math.round(categoryMap[cat].scoreSum / categoryMap[cat].count),
        questionCount: categoryMap[cat].count
      }));

      // 生成总体反馈（再调用一次 AI 汇总）
      const summaryResult = await aiService.analyzeResume(
        JSON.stringify(evaluations),
        '请基于以上面试表现生成总结报告',
        null,
        'chat' // 暂时使用 chat 场景
      );

      const report = {
        sessionId: session.id,
        totalQuestions: session.total_questions,
        overallScore,
        categoryScores,
        questionDetails: evaluations,
        overallFeedback: summaryResult.success ? summaryResult.data : '面试评估完成。',
        strengths: [], // 可以从汇总 AI 结果中提取
        improvements: [],
        referenceAnswers: evaluations.map(e => ({
          questionIndex: e.questionIndex,
          question: e.question,
          referenceAnswer: e.referenceAnswer,
          keyPoints: e.keyPoints
        }))
      };

      await session.update({
        questions,
        report,
        status: 'EVALUATED'
      });

      logger.info(`面试报告生成成功: ${sessionId}`);

    } catch (error) {
      logger.error('生成面试报告后台任务失败:', error);
    }
  }
}

module.exports = new InterviewController();
