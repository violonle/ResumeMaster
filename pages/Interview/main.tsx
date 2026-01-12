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
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">正在为您准备面试题目...</p>
        </div>
      </div>
    );
  }

  if (error || !resumeData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-sm p-8 text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">出错了</h2>
          <p className="text-gray-600 mb-6">{error || '无法加载简历数据'}</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
          >
            重试
          </button>
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
