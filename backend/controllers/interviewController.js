const { InterviewSession, Resume, ResumeJob, sequelize } = require('../models');
const DomesticAIService = require('../services/domesticAIService');
const aiService = new DomesticAIService();
const logger = require('../utils/logger');

/**
 * 面试控制器
 */
class InterviewController {
  /**
   * 创建面试会话
   */
  async createSession(req, res) {
    try {
      const { resumeText, questionCount, resumeId, resumeJobId, forceCreate = false } = req.body;

      let finalResumeText = resumeText;
      let rjId = resumeJobId;
      let finalResumeId = resumeId;
      let finalQuestionCount = questionCount || 8;

      // 如果提供了 resumeJobId，优先使用它来获取简历和题目数量
      if (rjId) {
        const rj = await ResumeJob.findByPk(rjId, {
          include: [{ model: Resume }]
        });
        if (rj) {
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
            finalResumeText = rj.Resume.raw_text || rj.Resume.parsed_data?.resume_text || rj.Resume.parsed_data?.text || finalResumeText;
          }
        }
      } else if (finalResumeId) {
        // 如果只提供了 resumeId，尝试获取简历文本和关联的申请记录
        const resume = await Resume.findByPk(finalResumeId);
        if (resume) {
          finalResumeText = resume.raw_text || resume.parsed_data?.resume_text || resume.parsed_data?.text || finalResumeText;
          
          const rj = await ResumeJob.findOne({
            where: { resume_id: finalResumeId },
            order: [['applied_at', 'DESC']]
          });
          if (rj) rjId = rj.id;
        }
      }

      if (!finalResumeText) {
        return res.status(400).json({ success: false, error: '简历内容不能为空' });
      }

      // 检查是否存在未完成的会话
      if (!forceCreate && rjId) {
        const existingSession = await InterviewSession.findOne({
          where: { 
            resume_job_id: rjId,
            status: ['CREATED', 'IN_PROGRESS']
          },
          order: [['created_at', 'DESC']]
        });

        if (existingSession) {
          return res.json({
            success: true,
            data: {
              sessionId: existingSession.id,
              resumeId: existingSession.resume_id,
              resumeJobId: existingSession.resume_job_id,
              resumeText: existingSession.resume_text,
              totalQuestions: existingSession.total_questions,
              currentQuestionIndex: existingSession.current_question_index,
              questions: existingSession.questions,
              status: existingSession.status
            }
          });
        }
      }

      // 调用 AI 生成面试题
      const aiResult = await aiService.analyzeResume(
        finalResumeText,
        `请生成 ${finalQuestionCount} 道面试题`,
        null,
        'interview_question_generation'
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

      return res.json({
        success: true,
        data: {
          sessionId: session.id,
          resumeId: session.resume_id,
          resumeJobId: session.resume_job_id,
          resumeText: session.resume_text,
          totalQuestions: session.total_questions,
          currentQuestionIndex: session.current_question_index,
          questions: session.questions,
          status: session.status
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

      const questions = [...session.questions];
      if (questionIndex < 0 || questionIndex >= questions.length) {
        return res.status(400).json({ success: false, error: '无效的题目索引' });
      }

      // 更新当前题目答案
      questions[questionIndex].userAnswer = answer;
      
      // 调用 AI 进行实时评估（可选，也可以最后统一评估）
      // 这里我们先只保存答案，提高响应速度
      
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
          hasNextQuestion: !isLastQuestion,
          nextQuestion: isLastQuestion ? null : questions[nextIndex],
          currentIndex: nextIndex,
          totalQuestions: session.total_questions
        }
      });

    } catch (error) {
      logger.error('提交面试回答失败:', error);
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

      return res.json({
        success: true,
        data: {
          sessionId: session.id,
          resumeId: session.resume_id,
          resumeJobId: session.resume_job_id,
          resumeText: session.resume_text,
          totalQuestions: session.total_questions,
          currentQuestionIndex: session.current_question_index,
          questions: session.questions,
          status: session.status
        }
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
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
