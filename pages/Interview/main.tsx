import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import InterviewRunner from './index';
import { interviewApi } from './interview-api';
import { AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react';
import './style.css'; 
import '@css/design-system.css';
import '@js/user-auth.js';

const App = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resumeData, setResumeData] = useState<{ 
    text: string; 
    id?: number; 
    rjId?: number; 
    sessionId?: string;
    candidateName?: string;
    candidatePhone?: string;
  } | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const idParam = urlParams.get('id');
        const rjIdParam = urlParams.get('resumeJobId');
        const resumeIdParam = urlParams.get('resumeId');

        if (!idParam && !rjIdParam && !resumeIdParam) {
          setError('未找到面试信息，请检查链接是否正确');
          setLoading(false);
          return;
        }

        let session;
        if (idParam && idParam.length > 10) {
          // 如果 idParam 长度较长，认为是 sessionId (UUID)
          session = await interviewApi.getSession(idParam);
        } else {
          // 否则可能是 resumeId 或 resumeJobId
          const rId = parseInt(resumeIdParam || (idParam && idParam.length <= 10 ? idParam : '0'));
          const rjId = parseInt(rjIdParam || '0');
          
          if (rId > 0) {
            session = await interviewApi.createSession({
              resumeId: rId,
              forceCreate: false
            });
          } else if (rjId > 0) {
            session = await interviewApi.createSession({
              resumeJobId: rjId,
              forceCreate: false
            });
          }
        }

        if (!session) {
          setError('未找到面试会话，请检查链接是否正确');
          setLoading(false);
          return;
        }

        setResumeData({
          text: session.resumeText,
          id: session.resumeId,
          rjId: session.resumeJobId,
          sessionId: session.sessionId,
          candidateName: session.candidateName,
          candidatePhone: session.candidatePhone
        });
        setLoading(false);
      } catch (err: any) {
        console.error('Failed to init interview:', err);
        // 优先使用 request.ts 统一处理后的错误消息
        const message = err.message || '初始化面试失败，请稍后重试';
        setError(message);
        setLoading(false);
      }
    };

    init();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center p-10 bg-white/50 backdrop-blur-xl rounded-[2.5rem] shadow-2xl shadow-blue-500/5 border border-gray-100 max-w-sm w-full">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <h2 className="text-xl font-black text-gray-900 mb-2 tracking-tight">准备中...</h2>
          <p className="text-gray-500 font-medium">正在为您量身定制面试方案</p>
        </div>
      </div>
    );
  }

  if (error || !resumeData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl p-10 text-center border border-gray-100">
          <div className="w-20 h-20 bg-red-50 rounded-[2rem] flex items-center justify-center mx-auto mb-8 text-red-500">
            <AlertTriangle className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-3 tracking-tight">初始化失败</h2>
          <p className="text-gray-500 mb-10 font-medium leading-relaxed">{error || '无法加载简历数据'}</p>
          <div className="space-y-4">
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 text-white py-4 px-6 rounded-2xl font-black shadow-xl shadow-blue-600/20 hover:bg-blue-700 hover:translate-y-[-2px] transition-all active:translate-y-[1px]"
            >
              重试一次
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 确认信息页面
  if (!confirmed) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
        <div className="max-w-2xl w-full bg-white rounded-[2.5rem] shadow-2xl p-8 sm:p-12 border border-gray-100">
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-blue-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6 text-blue-600">
              <CheckCircle className="w-10 h-10" />
            </div>
            <h1 className="text-3xl font-black text-gray-900 mb-3 tracking-tight">请确认您的信息</h1>
            <p className="text-gray-500 font-medium">开始面试前，请核对以下信息是否准确</p>
          </div>

          <div className="bg-gray-50 rounded-3xl p-8 mb-10 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 pb-6 border-b border-gray-200/60">
              <span className="text-gray-400 font-medium min-w-[5rem]">姓名</span>
              <span className="text-xl font-bold text-gray-900">{resumeData.candidateName || '未填写'}</span>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 pb-6 border-b border-gray-200/60">
              <span className="text-gray-400 font-medium min-w-[5rem]">联系电话</span>
              <span className="text-xl font-bold text-gray-900">{resumeData.candidatePhone || '未填写'}</span>
            </div>

            <div className="flex flex-col gap-3">
              <span className="text-gray-400 font-medium">简历摘要</span>
              <div className="bg-white p-4 rounded-2xl border border-gray-200 text-gray-600 text-sm leading-relaxed max-h-40 overflow-y-auto">
                {resumeData.text.slice(0, 300)}...
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <button 
              onClick={() => setConfirmed(true)}
              className="w-full bg-blue-600 text-white py-5 px-6 rounded-2xl font-black text-lg shadow-xl shadow-blue-600/20 hover:bg-blue-700 hover:translate-y-[-2px] transition-all active:translate-y-[1px] flex items-center justify-center gap-2"
            >
              <span>确认无误，开始面试</span>
              <ArrowRight className="w-5 h-5" />
            </button>
            <p className="text-center text-sm text-gray-400 font-medium">
              如信息有误，请联系招聘负责人更新简历
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <InterviewRunner 
    resumeText={resumeData.text} 
    sessionId={resumeData.sessionId!} 
    onBack={() => window.history.back()}
    onComplete={() => console.log('面试结束')}
  />;
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
