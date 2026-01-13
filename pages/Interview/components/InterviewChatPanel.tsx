import React, {useEffect, useMemo, useRef} from 'react';
import {motion} from 'framer-motion';
import type {InterviewQuestion, InterviewSession} from '../types';
import {
  Send,
  User,
  Bot,
  Info
} from 'lucide-react';

interface Message {
  type: 'interviewer' | 'user';
  content: string;
  category?: string;
  questionIndex?: number;
}

interface InterviewChatPanelProps {
  session: InterviewSession;
  currentQuestion: InterviewQuestion | null;
  messages: Message[];
  answer: string;
  onAnswerChange: (answer: string) => void;
  onSubmit: () => void;
  onCompleteEarly: () => void;
  isSubmitting: boolean;
  showCompleteConfirm: boolean;
  onShowCompleteConfirm: (show: boolean) => void;
}

/**
 * 面试聊天面板组件
 */
export default function InterviewChatPanel({
  session,
  currentQuestion,
  messages,
  answer,
  onAnswerChange,
  onSubmit,
  // onCompleteEarly, // 暂时未使用
  isSubmitting,
  // showCompleteConfirm, // 暂时未使用
  onShowCompleteConfirm
}: InterviewChatPanelProps) {
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const progress = useMemo(() => {
    if (!session) return 0;
    return ((session.currentQuestionIndex + 1) / session.questions.length) * 100;
  }, [session]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      onSubmit();
    }
  };

  return (
    <div className="flex flex-col flex-1 h-full w-full overflow-hidden">
      {/* 聊天区域 */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-10 space-y-8 scroll-smooth custom-scrollbar" ref={chatContainerRef}>
        {messages.map((msg, idx) => (
          <MessageBubble key={idx} message={msg} />
        ))}
        {isSubmitting && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex justify-start"
          >
            <div className="flex gap-4 flex-row">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white border border-gray-100 text-blue-600 flex items-center justify-center shadow-sm">
                <Bot className="w-5 h-5" />
              </div>
              <div className="p-5 bg-white border border-gray-100 rounded-[1.5rem] rounded-tl-none shadow-sm">
                <div className="flex gap-1.5">
                  <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="w-2 h-2 rounded-full bg-blue-400" />
                  <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-2 h-2 rounded-full bg-blue-400" />
                  <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-2 h-2 rounded-full bg-blue-400" />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* 输入区域 */}
      <div className="p-6 sm:p-10 border-t border-gray-100 bg-gray-50/30">
        <div className="max-w-3xl mx-auto flex flex-col gap-4">
          <div className="relative group">
            <textarea
              value={answer}
              onChange={(e) => onAnswerChange(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="请输入您的回答... (Ctrl/Cmd + Enter 发送)"
              className="w-full pl-6 pr-32 py-5 bg-white border-2 border-transparent rounded-[1.5rem] shadow-sm transition-all focus:border-blue-600 focus:ring-4 focus:ring-blue-600/5 focus:bg-white resize-none text-gray-800 placeholder:text-gray-400 font-medium"
              rows={2}
              disabled={isSubmitting}
            />
            <button
              onClick={onSubmit}
              disabled={!answer.trim() || isSubmitting}
              className={`absolute right-3 top-1/2 -translate-y-1/2 h-11 px-6 flex items-center justify-center gap-2 rounded-xl transition-all font-bold tracking-wide ${
                answer.trim() && !isSubmitting
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:scale-105 active:scale-95'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {isSubmitting ? (
                <motion.div 
                  className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
              ) : (
                <>
                  <span>发送</span>
                  <Send className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
          
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
              <Info className="w-3 h-3" />
              Ctrl/Cmd + Enter 发送
            </p>
            <button
              onClick={() => onShowCompleteConfirm(true)}
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-black text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all disabled:opacity-50"
            >
              提前交卷
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 消息气泡组件
function MessageBubble({ message }: { message: Message }) {
  const isInterviewer = message.type === 'interviewer';

  return (
    <motion.div
      initial={{ opacity: 0, x: isInterviewer ? -20 : 20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`flex ${isInterviewer ? 'justify-start' : 'justify-end'}`}
    >
      <div className={`flex gap-4 max-w-[85%] sm:max-w-[75%] ${isInterviewer ? 'flex-row' : 'flex-row-reverse'}`}>
        <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${
          isInterviewer 
            ? 'bg-white border border-gray-100 text-blue-600' 
            : 'bg-blue-600 text-white'
        }`}>
          {isInterviewer ? <Bot className="w-5 h-5" /> : <User className="w-5 h-5" />}
        </div>
        <div className={`group relative p-5 sm:p-6 rounded-[1.5rem] shadow-sm transition-all hover:shadow-md ${
          isInterviewer
            ? 'bg-white border border-gray-100 text-gray-800 rounded-tl-none'
            : 'bg-blue-600 text-white rounded-tr-none'
        }`}>
          {isInterviewer && message.category && (
            <div className="mb-2">
              <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-wider rounded-lg">
                {message.category}
              </span>
            </div>
          )}
          <div className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap font-medium">
            {message.content}
          </div>
          <div className={`mt-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest ${
            isInterviewer ? 'text-gray-400' : 'text-blue-100/70'
          }`}>
            <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            {isInterviewer && (
              <div className="flex gap-1">
                <span className="w-1 h-1 rounded-full bg-current opacity-30"></span>
                <span>AI Interviewer</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
