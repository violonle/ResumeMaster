const { Resume, ResumeJob, Job, InterviewSession } = require('../backend/models');
const DomesticAIService = require('../backend/services/domesticAIService');
const aiService = new DomesticAIService();

async function generateTestLink() {
  try {
    // 1. 获取简历 ID (从命令行参数获取或默认为 4)
    const resumeId = parseInt(process.argv[2]) || 4;
    const resume = await Resume.findByPk(resumeId);
    if (!resume) {
      console.error(`Resume with ID ${resumeId} not found.`);
      process.exit(1);
    }

    const resumeText = resume.raw_text || resume.parsed_data?.resume_text || "这是一份测试简历内容。";
    
    // 查找关联的职位
    const rj = await ResumeJob.findOne({
      where: { resume_id: resumeId },
      include: [{ model: Job }],
      order: [['applied_at', 'DESC']]
    });

    let jobDescription = '';
    let rjId = null;
    if (rj) {
      rjId = rj.id;
      if (rj.Job) {
        jobDescription = rj.Job.description || rj.Job.requirements || '';
      }
    }

    console.log(`正在为简历 (ID: ${resumeId}) 生成 AI 面试题...`);
    
    // 2. 调用 AI 生成面试题
    const aiResult = await aiService.analyzeResume(
      resumeText,
      jobDescription,
      null,
      'interview_question_generation',
      5
    );

    if (!aiResult.success) {
      throw new Error(aiResult.error || 'AI 生成面试题失败');
    }

    const questionsData = aiResult.data?.questions || [];
    const formattedQuestions = questionsData.map(q => ({
      ...q,
      userAnswer: null,
      score: null,
      feedback: null
    }));

    // 3. 创建面试会话
    const session = await InterviewSession.create({
      resume_id: resumeId,
      resume_job_id: rjId,
      resume_text: resumeText,
      total_questions: formattedQuestions.length,
      current_question_index: 0,
      questions: formattedQuestions,
      status: 'CREATED'
    });

    console.log('\n=========================================');
    console.log(`✅ 测试 AI 面试会话已成功生成！`);
    console.log(`简历: ${resume.file_name} (ID: ${resumeId})`);
    console.log(`会话 ID: ${session.id}`);
    console.log('-----------------------------------------');
    console.log(`1. UUID 加载链接 (推荐):`);
    console.log(`   http://localhost:3000/pages/Interview/?id=${session.id}`);
    console.log(`2. 简历 ID 加载链接 (自动创建/获取):`);
    console.log(`   http://localhost:3000/pages/Interview/?resumeId=${resumeId}`);
    console.log('=========================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Error generating test link:', error);
    process.exit(1);
  }
}

generateTestLink();

