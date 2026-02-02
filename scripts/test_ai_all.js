
const DomesticAIService = require('../backend/services/domesticAIService');
const domesticAIService = new DomesticAIService();
const resumeText = '张三，五年 Java 开发经验...';

async function test() {
    console.log('--- Testing Interview Question Generation ---');
    try {
        const genRes = await domesticAIService.analyzeResume(resumeText, 'Java Developer', null, 'interview_question_generation');
        console.log('Gen Result (Summary):', genRes.success ? 'Success' : 'Failed');
        console.log('Service Used:', genRes.service);
        if (genRes.data) {
            console.log('Data Type:', typeof genRes.data);
            console.log('Questions Count:', genRes.data.questions ? genRes.data.questions.length : 0);
        }
    } catch (e) {
        console.error('Gen Error:', e.message);
    }

    console.log('\n--- Testing Interview Answer Evaluation ---');
    try {
        const evalRes = await domesticAIService.analyzeResume('题目: Java 内存模型是什么？\n回答: JMM 定义了 Java 虚拟机如何与计算机内存工作。', '', null, 'interview_answer_evaluation');
        console.log('Eval Result (Summary):', evalRes.success ? 'Success' : 'Failed');
        console.log('Service Used:', evalRes.service);
        if (evalRes.data) {
            console.log('Score:', evalRes.data.score);
            console.log('Feedback:', evalRes.data.feedback ? evalRes.data.feedback.substring(0, 50) + '...' : 'None');
        }
    } catch (e) {
        console.error('Eval Error:', e.message);
    }
}

test().then(() => process.exit(0)).catch(err => {
    console.error('Overall Test Error:', err);
    process.exit(1);
});
