import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../css/design-system.css';
import './style.css'; 
import '../../js/user-auth.js'; 
import InterviewRunner from './index';
import { interviewApi } from './interview-api';
import { AlertTriangle, CheckCircle, ArrowRight, Building2, User, Phone, FileText } from 'lucide-react';

console.log('🚀 CSS Imports:', { style: './style.css', design: '../../css/design-system.css' });

const App = () => {
  console.log('🚀 App component rendering...');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resumeData, setResumeData] = useState<{ 
    text: string; 
    id?: number; 
    rjId?: number; 
    sessionId?: string;
    candidateName?: string;
    candidatePhone?: string;
    companyName?: string;
  } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    console.log('🚀 App useEffect init...');
    const init = async () => {
      try {
        // 1. 解析参数 (兼容 search 和 hash)
        const urlParams = new URLSearchParams(window.location.search);
        
        // 兼容某些路由模式下参数在 hash 里的情况
        let hashParams = new URLSearchParams();
        if (window.location.hash.includes('?')) {
          hashParams = new URLSearchParams(window.location.hash.split('?')[1]);
        }

        const idParam = urlParams.get('id') || urlParams.get('sessionId') || hashParams.get('id') || hashParams.get('sessionId');
        const rjIdParam = urlParams.get('resumeJobId') || hashParams.get('resumeJobId');
        const resumeIdParam = urlParams.get('resumeId') || hashParams.get('resumeId');

        console.log('🔍 URL Params parsed:', { idParam, rjIdParam, resumeIdParam });

        if (!idParam && !rjIdParam && !resumeIdParam) {
          console.error('❌ No valid params found in URL. URL:', window.location.href);
          setError('未找到面试信息，请检查链接是否正确');
          setLoading(false);
          return;
        }

        let session;
        // 如果提供了 sessionId (UUID 格式，通常长度 > 10)
        if (idParam && idParam.length > 10) {
          console.log('📡 Fetching session by sessionId:', idParam);
          session = await interviewApi.getSession(idParam);
        } else {
          // 否则认为是 resumeId 或 resumeJobId
          const rId = parseInt(resumeIdParam || (idParam && idParam.length <= 10 ? idParam : '0'));
          const rjId = parseInt(rjIdParam || '0');
          
          console.log('📡 Creating/Fetching session for:', { rId, rjId });
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

        console.log('✅ Session data received:', session);

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
          candidatePhone: session.candidatePhone,
          companyName: session.companyName
        });
        setLoading(false);
      } catch (err: any) {
        console.error('❌ Failed to init interview:', err);
        const message = err.message || '初始化面试失败，请稍后重试';
        setError(message);
        setLoading(false);
      }
    };

    init();
  }, []);

  if (loading) {
    console.log('⏳ Rendering loading state...');
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
    console.log('❌ Rendering error state:', error);
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
    console.log('📝 Rendering confirmation state...');
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
              <div className="flex items-center gap-2 text-gray-400 font-medium min-w-[8rem]">
                <Building2 className="w-4 h-4" />
                <span>面试单位</span>
              </div>
              <span className="text-xl font-bold text-gray-900">{resumeData.companyName || '某公司'}</span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 pb-6 border-b border-gray-200/60">
              <div className="flex items-center gap-2 text-gray-400 font-medium min-w-[8rem]">
                <User className="w-4 h-4" />
                <span>候选人姓名</span>
              </div>
              <span className="text-xl font-bold text-gray-900">{resumeData.candidateName || '未填写'}</span>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 pb-6 border-b border-gray-200/60">
              <div className="flex items-center gap-2 text-gray-400 font-medium min-w-[8rem]">
                <Phone className="w-4 h-4" />
                <span>联系电话</span>
              </div>
              <span className="text-xl font-bold text-gray-900">{resumeData.candidatePhone || '未填写'}</span>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-gray-400 font-medium">
                <FileText className="w-4 h-4" />
                <span>简历核心内容</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-gray-200 text-gray-600 text-sm leading-relaxed max-h-48 overflow-y-auto custom-scrollbar shadow-inner whitespace-pre-wrap">
                {resumeData.text}
              </div>
            </div>
          </div>

          <div className="mb-10 p-6 bg-blue-50/50 rounded-2xl border border-blue-100/50">
            <h3 className="text-blue-900 font-bold mb-3 flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
              面试说明
            </h3>
            <ul className="text-blue-800/70 text-sm space-y-2 font-medium">
              <li>• 本次面试由 AI 面试官主持，将围绕您的工作经历进行提问</li>
              <li>• 面试大约需要 15-20 分钟，请确保您有安静的环境</li>
              <li>• 您的回答将被实时记录并生成评估报告供 HR 参考</li>
              <li>• 点击下方按钮即表示您同意开始本次 AI 智能面试</li>
            </ul>
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

  return (
    <>
      <InterviewRunner 
        resumeText={resumeData.text} 
        sessionId={resumeData.sessionId!} 
        onBack={() => window.history.back()}
        onComplete={() => setIsCompleted(true)}
      />

      {/* Completion Modal */}
      {isCompleted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2rem] shadow-2xl p-8 sm:p-12 max-w-md w-full text-center border border-gray-100 transform scale-100 animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-green-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6 text-green-500 shadow-sm">
              <CheckCircle className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-black text-gray-900 mb-4 tracking-tight">面试结束</h2>
            <p className="text-gray-500 font-medium leading-relaxed text-lg">
              您已经回答完毕，谢谢您的参与。<br/>稍后我们会与您联系。
            </p>
          </div>
        </div>
      )}
    </>
  );
};

const container = document.getElementById('root');
if (container) {
  console.log('🚀 Initializing React root with version:', React.version);
  const root = createRoot(container);
  root.render(<App />);
}
