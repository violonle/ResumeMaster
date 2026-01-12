import React, {useEffect, useState} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {interviewApi} from './interview-api';
import ConfirmDialog from './components/ConfirmDialog';
import InterviewChatPanel from './components/InterviewChatPanel';
import type {InterviewQuestion, InterviewSession} from './types';

interface Message {
  type: 'interviewer' | 'user';
  content: string;
  category?: string;
  questionIndex?: number;
}

export interface InterviewRunnerProps {
  resumeText: string;
  resumeId?: number;
  resumeJobId?: number;
  sessionId?: string; // 新增：支持直接传入会话ID
  onBack: () => void;
  onComplete: () => void;
}

export default function InterviewRunner({ resumeText, resumeId, resumeJobId, sessionId: initialSessionId, onBack, onComplete }: InterviewRunnerProps) {
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<InterviewQuestion | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [answer, setAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  
  // 组件挂载时自动初始化面试
  useEffect(() => {
    // 如果 main.tsx 已经传来了 sessionId，且我们还没有 session 数据，或者 session 数据不匹配
    if (initialSessionId && (!session || session.sessionId !== initialSessionId)) {
      initBySessionId(initialSessionId);
    } else if (!initialSessionId && (resumeId || resumeJobId)) {
      startInterview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSessionId, resumeId, resumeJobId]);

  const initBySessionId = async (sid: string) => {
    setIsLoading(true);
    try {
      const sessionData = await interviewApi.getSession(sid);
      restoreSession(sessionData);
    } catch (err: any) {
      setError(err.message || '获取面试信息失败');
    } finally {
      setIsLoading(false);
    }
  };
  
  const restoreSession = (sessionToRestore: InterviewSession) => {
    if (!sessionToRestore || !sessionToRestore.questions) {
      console.error('Invalid session to restore:', sessionToRestore);
      return;
    }
    setSession(sessionToRestore);
    
    // 恢复当前问题
    const currentIndex = sessionToRestore.currentQuestionIndex || 0;
    const currentQ = sessionToRestore.questions[currentIndex];
    
    if (currentQ) {
      setCurrentQuestion(currentQ);
      
      // 如果当前问题已有答案，显示在输入框中
      if (currentQ.userAnswer) {
        setAnswer(currentQ.userAnswer);
      }
      
      // 恢复消息历史：严格按照 提问-回答 的顺序构建
      const restoredMessages: Message[] = [];
      const questionsToRestore = sessionToRestore.questions || [];
      
      for (let i = 0; i <= currentIndex; i++) {
        const q = questionsToRestore[i];
        if (!q) continue;

        // 添加面试官提问
        restoredMessages.push({
          type: 'interviewer',
          content: q.question,
          category: q.category,
          questionIndex: i
        });

        // 如果该题已有答案，添加面试者回答
        if (q.userAnswer && q.userAnswer.trim()) {
          restoredMessages.push({
            type: 'user',
            content: q.userAnswer
          });
        }
      }
      setMessages(restoredMessages);
    }
  };
  
  const startInterview = async () => {
    setIsLoading(true);
    setError('');
    try {
      console.log('Starting interview for resume:', resumeId, 'job:', resumeJobId);
      const newSession = await interviewApi.createSession({
        resumeId,
        resumeJobId,
        forceCreate: false
      });
      console.log('Session created/retrieved:', newSession);

      if (!newSession || !newSession.sessionId) {
        throw new Error('服务器返回的会话数据不完整');
      }

      // 如果返回的是已有的会话（currentQuestionIndex > 0 或已有答案），恢复它
      const questions = newSession.questions || [];
      const hasProgress = (newSession.currentQuestionIndex || 0) > 0 || 
                          questions.some(q => q.userAnswer) ||
                          newSession.status === 'IN_PROGRESS';
      
      if (hasProgress) {
        restoreSession(newSession);
      } else {
        setSession(newSession);
        
        if (questions.length > 0) {
          const firstQuestion = questions[0];
          setCurrentQuestion(firstQuestion);
          setMessages([{
            type: 'interviewer',
            content: firstQuestion.question,
            category: firstQuestion.category,
            questionIndex: 0
          }]);
        } else {
          throw new Error('未生成面试题目，请刷新重试');
        }
      }
    } catch (err: any) {
      console.error('Failed to start interview:', err);
      setError(err.response?.data?.error || err.message || '无法开始面试，请检查网络或重试');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSubmitAnswer = async () => {
    if (!answer.trim() || !session || !currentQuestion || isSubmitting) return;

    setIsSubmitting(true);
    const submittedAnswer = answer.trim();
    setAnswer(''); // 立即清空输入框，提升交互体验

    const userMessage: Message = {
      type: 'user',
      content: submittedAnswer
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      const response = await interviewApi.submitAnswer({
        sessionId: session.sessionId,
        questionIndex: session.currentQuestionIndex, // 使用 session 中的 0-based 索引
        answer: submittedAnswer
      });

      if (response.hasNextQuestion && response.nextQuestion) {
        setCurrentQuestion(response.nextQuestion);
        setMessages(prev => [...prev, {
          type: 'interviewer',
          content: response.nextQuestion!.question,
          category: response.nextQuestion!.category,
          questionIndex: response.nextQuestion!.questionIndex
        }]);
        
        // 更新 session 中的当前索引，使用后端返回的 currentIndex
        setSession(prev => prev ? {
          ...prev,
          currentQuestionIndex: response.currentIndex
        } : null);
      } else {
        // 面试已完成，评估将在后台进行，跳转到面试记录页
        onComplete();
      }
    } catch (err) {
      setError('提交答案失败，请重试');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteEarly = async () => {
    if (!session) return;

    setIsSubmitting(true);
    try {
      await interviewApi.completeInterview(session.sessionId);
      setShowCompleteConfirm(false);
      // 面试已完成，评估将在后台进行，跳转到面试记录页
      onComplete();
    } catch (err) {
      setError('提前交卷失败，请重试');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="max-w-4xl mx-auto min-h-screen sm:min-h-0 sm:py-8 px-0 sm:px-4">
      <AnimatePresence mode="wait">
        <motion.div
          key="interview"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="bg-white min-h-screen sm:min-h-[600px] sm:rounded-2xl shadow-xl overflow-hidden flex flex-col border border-gray-100"
        >
          {/* Header */}
          <div className="px-4 py-3 sm:px-8 sm:py-6 border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button 
                  onClick={onBack}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors sm:hidden"
                >
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div>
                  <h1 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    AI 模拟面试
                  </h1>
                  {session && (
                    <div className="flex items-center gap-3 mt-1">
                      <div className="w-24 sm:w-32 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${((session.currentQuestionIndex + 1) / session.questions.length) * 100}%` }}
                          className="h-full bg-gradient-to-r from-blue-500 to-indigo-500"
                        />
                      </div>
                      <p className="text-[10px] sm:text-xs text-gray-500 font-medium">
                        第 {session.currentQuestionIndex + 1} / {session.questions.length} 题
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              {session && (
                <div className="hidden sm:flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-600">面试进度</span>
                  <span className="text-sm font-bold text-blue-600">{Math.round(((session.currentQuestionIndex + 1) / session.questions.length) * 100)}%</span>
                </div>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
              <button onClick={startInterview} className="ml-auto underline font-medium">重试</button>
            </div>
          )}

          {/* Chat Panel */}
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
              <h3 className="text-lg font-medium text-gray-900">正在生成面试题目</h3>
              <p className="text-sm text-gray-500 mt-2">基于您的简历，我们正在为您量身定制面试方案...</p>
            </div>
          ) : session ? (
            <InterviewChatPanel
              session={session}
              currentQuestion={currentQuestion}
              messages={messages}
              answer={answer}
              onAnswerChange={setAnswer}
              onSubmit={handleSubmitAnswer}
              onCompleteEarly={() => setShowCompleteConfirm(true)}
              isSubmitting={isSubmitting}
              showCompleteConfirm={showCompleteConfirm}
              onShowCompleteConfirm={setShowCompleteConfirm}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="text-gray-400 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 9.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900">无法开始面试</h3>
              <p className="text-sm text-gray-500 mt-2">{error || '请刷新页面或检查您的网络连接'}</p>
              {error && (
                <button 
                  onClick={startInterview} 
                  className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 transition-colors"
                >
                  重新尝试
                </button>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <ConfirmDialog
        open={showCompleteConfirm}
        onConfirm={handleCompleteEarly}
        onCancel={() => setShowCompleteConfirm(false)}
        title="确认结束面试？"
        message="您还有题目未完成，现在结束将直接生成面试评估报告。"
        confirmText="确认交卷"
        cancelText="继续答题"
        confirmVariant="warning"
      />
    </div>
  );
}
