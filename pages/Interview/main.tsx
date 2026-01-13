import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import InterviewRunner from './index';
import { interviewApi } from './interview-api';
import './style.css'; // 我们稍后创建

const App = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resumeData, setResumeData] = useState<{ text: string; id?: number; rjId?: number; sessionId?: string } | null>(null);

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
          sessionId: session.sessionId
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
            <i className="fas fa-exclamation-triangle text-4xl"></i>
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
            <button 
              onClick={() => window.history.back()}
              className="w-full bg-white text-gray-600 py-4 px-6 rounded-2xl font-black border-2 border-gray-100 hover:bg-gray-50 transition-all"
            >
              返回上一页
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <InterviewRunner
        resumeText={resumeData.text}
        resumeId={resumeData.id}
        resumeJobId={resumeData.rjId}
        sessionId={resumeData.sessionId}
        onBack={() => window.history.back()}
        onComplete={() => {
          console.log('面试结束');
          // 可以在这里跳转到完成页面或显示成功提示
        }}
      />
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
