/**
 * Resume Tools Controller V2
 * Implements the new layout and logic for Resume Analysis and Comparison
 */

(function() {
    // Shared State
    const state = {
        activeSidebarTab: 'library', // 'library' or 'upload'
        analysisMode: 'single',      // 'single' or 'multi'
        selectedResumes: [],         // Selected resume objects from library
        uploadedFiles: [],           // Files uploaded in the current session
        isAnalyzing: false,
        analysisResult: null,
        comparisonResult: null,
        talentPool: [],              // All resumes from the talent pool
        jobs: [],                    // All jobs from the database
        selectedJobId: 'all'         // Currently selected job for filtering
    };

    // DOM Elements Cache
    const dom = {
        // Sidebar
        sidebarTabs: document.querySelectorAll('.sidebar-left .tab-btn'),
        libraryContent: document.getElementById('library-content'),
        uploadContent: document.getElementById('upload-content'),
        candidateSearch: document.getElementById('candidate-search'),
        candidateList: document.getElementById('candidate-list'),
        sidebarJobSelect: document.getElementById('sidebar-job-select'),
        
        // Upload
        dropZone: document.getElementById('drop-zone'),
        fileInput: document.getElementById('file-input'),
        fileList: document.getElementById('file-list'),
        
        // Main Area Header
        analysisModeTabs: document.querySelectorAll('.main-content-area .tab-btn'),
        analyzeBtn: document.getElementById('analyze-btn'),
        
        // Content Sections
        emptyState: document.getElementById('empty-state'),
        singleResults: document.getElementById('single-analysis-results'),
        multiResults: document.getElementById('multi-analysis-results'),
        loadingOverlay: document.getElementById('loading-overlay'),
        
        // Result Elements (Single)
        resName: document.getElementById('res-name'),
        resInfo: document.getElementById('res-info'),
        resScore: document.getElementById('res-score'),
        radarContainer: document.getElementById('radar-container'),
        scoreCards: document.getElementById('score-cards'),
        aiReport: document.getElementById('ai-report')
    };

    async function init() {
        bindEvents();
        await Promise.all([
            loadTalentPool(),
            loadJobs()
        ]);
        renderJobSelect();
        renderCandidateList();
        
        // Initialize Header Profile
        if (typeof HeaderProfile !== 'undefined' && HeaderProfile.init) {
            HeaderProfile.init('#header-right-section');
        }
        
        // Initialize Sidebar
        if (window.Sidebar) {
            window.Sidebar.init({ mount: '#sidebar', active: 'resume-tools' });
        }
    }

    function bindEvents() {
        // Sidebar Tab Switching
        dom.sidebarTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const target = tab.dataset.tab;
                switchSidebarTab(target);
            });
        });

        // Job Filter in Sidebar
        if (dom.sidebarJobSelect) {
            dom.sidebarJobSelect.addEventListener('change', (e) => {
                state.selectedJobId = e.target.value;
                renderCandidateList();
            });
        }

        // Candidate Search
        dom.candidateSearch.addEventListener('input', debounce(() => {
            renderCandidateList();
        }, 300));

        // Analysis Mode Switching
        dom.analysisModeTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const mode = tab.dataset.mode;
                switchAnalysisMode(mode);
            });
        });

        // Upload Logic
        if (dom.dropZone) {
            dom.dropZone.addEventListener('click', () => dom.fileInput.click());
            dom.dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dom.dropZone.classList.add('border-blue-500', 'bg-blue-50');
            });
            dom.dropZone.addEventListener('dragleave', (e) => {
                e.preventDefault();
                dom.dropZone.classList.remove('border-blue-500', 'bg-blue-50');
            });
            dom.dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dom.dropZone.classList.remove('border-blue-500', 'bg-blue-50');
                handleFileUpload(e.dataTransfer.files);
            });
        }
        
        if (dom.fileInput) {
            dom.fileInput.addEventListener('change', (e) => handleFileUpload(e.target.files));
        }

        // Analyze Button
        dom.analyzeBtn.addEventListener('click', startAnalysis);
    }

    // --- State & UI Logic ---

    function switchSidebarTab(tab) {
        state.activeSidebarTab = tab;
        dom.sidebarTabs.forEach(t => {
            if (t.dataset.tab === tab) t.classList.add('active');
            else t.classList.remove('active');
        });

        if (tab === 'library') {
            dom.libraryContent.classList.remove('hidden');
            dom.uploadContent.classList.add('hidden');
        } else {
            dom.libraryContent.classList.add('hidden');
            dom.uploadContent.classList.remove('hidden');
        }
    }

    function switchAnalysisMode(mode) {
        state.analysisMode = mode;
        dom.analysisModeTabs.forEach(t => {
            if (t.dataset.mode === mode) t.classList.add('active');
            else t.classList.remove('active');
        });
        
        // Reset selection when switching modes to avoid confusion
        state.selectedResumes = [];
        state.uploadedFiles = [];
        renderCandidateList();
        renderUploadedFiles();
        updateAnalyzeBtn();
        
        // Show empty state
        showEmptyState();
    }

    async function loadTalentPool() {
        if (!window.resumeDataManager) return;
        try {
            state.talentPool = await window.resumeDataManager.getTalentPoolResumes(false, true); // Added silent=true
        } catch (e) {
            console.error('Failed to load talent pool:', e);
            state.talentPool = [];
        }
    }

    async function loadJobs() {
        if (!window.resumeDataManager) return;
        try {
            const result = await window.resumeDataManager.apiRequest('/jobs', 'GET', null, true, true); // Added silent=true
            state.jobs = result.data || [];
        } catch (e) {
            console.error('Failed to load jobs:', e);
            state.jobs = [];
        }
    }

    function renderJobSelect() {
        if (!dom.sidebarJobSelect) return;
        
        // Clear existing options except "All"
        const defaultOption = dom.sidebarJobSelect.options[0];
        dom.sidebarJobSelect.innerHTML = '';
        dom.sidebarJobSelect.appendChild(defaultOption);
        
        state.jobs.forEach(job => {
            const option = document.createElement('option');
            option.value = job.id;
            option.textContent = job.title;
            dom.sidebarJobSelect.appendChild(option);
        });
    }

    function renderCandidateList() {
        const query = dom.candidateSearch.value.toLowerCase();
        
        // Filter by search query AND selected job
        const filtered = state.talentPool.filter(c => {
            // Job filter
            if (state.selectedJobId !== 'all') {
                // Check if candidate is associated with the selected job
                // 1. Check direct job_id field (if exists)
                // 2. Check Jobs array (from library enrichment)
                // 3. Check ResumeJobs array (direct associations)
                const isMatch = (c.job_id == state.selectedJobId) || 
                               (c.Jobs && c.Jobs.some(j => j.id == state.selectedJobId)) ||
                               (c.ResumeJobs && c.ResumeJobs.some(rj => rj.job_id == state.selectedJobId));
                
                if (!isMatch) return false;
            }
            
            // Search query filter
            const name = (c.name || '未命名').toLowerCase();
            const pos = (c.job_title || c.position || c.associated_job_title || '').toLowerCase();
            const jobTitles = (c.Jobs || []).map(j => j.title.toLowerCase()).join(' ');
            return name.includes(query) || pos.includes(query) || jobTitles.includes(query);
        });

        dom.candidateList.innerHTML = '';
        if (filtered.length === 0) {
            dom.candidateList.innerHTML = '<div class="text-center py-8 text-gray-400 text-sm">暂无匹配候选人</div>';
            return;
        }

        filtered.forEach(c => {
            const isSelected = state.selectedResumes.some(r => r.id === c.id);
            const div = document.createElement('div');
            div.className = `candidate-item p-3 mb-3 rounded-xl border transition-all cursor-pointer ${isSelected ? 'selected' : 'border-gray-100 hover:border-blue-200 bg-gray-50/50 hover:bg-white hover:shadow-md'}`;
            
            // 获取职位名称
            let displayPosition = '未设置职位';
            if (c.associated_job_title) {
                displayPosition = c.associated_job_title;
            } else if (c.Jobs && c.Jobs.length > 0) {
                displayPosition = c.Jobs[0].title;
            } else if (c.job_title || c.position) {
                displayPosition = c.job_title || c.position;
            } else if (c.job_id) {
                const job = state.jobs.find(j => j.id == c.job_id);
                if (job) displayPosition = job.title;
            } else if (c.ResumeJobs && c.ResumeJobs.length > 0) {
                const job = state.jobs.find(j => j.id == c.ResumeJobs[0].job_id);
                if (job) displayPosition = job.title;
            }
            
            div.innerHTML = `
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 rounded-full bg-white border border-gray-100 flex items-center justify-center text-gray-400 shadow-sm">
                        <i class="fas fa-user"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="text-sm font-bold text-gray-900 truncate">${c.name || '未命名'}</div>
                        <div class="flex items-center mt-1">
                            <span class="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-md border border-blue-100 font-medium truncate max-w-full">
                                <i class="fas fa-briefcase mr-1 opacity-70"></i>${displayPosition}
                            </span>
                        </div>
                    </div>
                    <div class="flex items-center justify-center ml-2">
                        <input type="${state.analysisMode === 'single' ? 'radio' : 'checkbox'}" 
                               class="w-5 h-5 text-blue-600 accent-blue-600 bg-gray-50 border-gray-200 focus:ring-blue-500 focus:ring-2 checked:bg-blue-600 checked:border-transparent ${state.analysisMode === 'single' ? 'rounded-full' : 'rounded'} pointer-events-none transition-all"
                               ${isSelected ? 'checked' : ''}>
                    </div>
                </div>
            `;
            
            div.onclick = () => toggleCandidateSelection(c);
            dom.candidateList.appendChild(div);
        });
    }

    function toggleCandidateSelection(candidate) {
        const index = state.selectedResumes.findIndex(r => r.id === candidate.id);
        
        if (state.analysisMode === 'single') {
            // In single mode, only one can be selected
            state.selectedResumes = index === -1 ? [candidate] : [];
        } else {
            // In multi mode, multiple can be selected
            if (index === -1) {
                if (state.selectedResumes.length >= 5) {
                    ui.showNotification('最多只能对比5份简历', 'warning');
                    return;
                }
                state.selectedResumes.push(candidate);
            } else {
                state.selectedResumes.splice(index, 1);
            }
        }
        
        renderCandidateList();
        updateAnalyzeBtn();
    }

    function handleFileUpload(fileList) {
        const files = Array.from(fileList).filter(f => {
            const ext = f.name.split('.').pop().toLowerCase();
            return ['pdf', 'doc', 'docx', 'txt'].includes(ext) && f.size <= 10 * 1024 * 1024;
        });

        if (files.length === 0) {
            ui.showNotification('请上传10MB以内的PDF/DOC/DOCX/TXT文件', 'warning');
            return;
        }

        if (state.analysisMode === 'single') {
            state.uploadedFiles = [files[0]];
        } else {
            const total = state.uploadedFiles.length + files.length;
            if (total > 5) {
                ui.showNotification('最多只能同时对比5份简历', 'warning');
                state.uploadedFiles = [...state.uploadedFiles, ...files].slice(0, 5);
            } else {
                state.uploadedFiles = [...state.uploadedFiles, ...files];
            }
        }

        renderUploadedFiles();
        updateAnalyzeBtn();
    }

    function renderUploadedFiles() {
        dom.fileList.innerHTML = '';
        if (state.uploadedFiles.length === 0) {
            return;
        }

        state.uploadedFiles.forEach((file, idx) => {
            const div = document.createElement('div');
            div.className = 'flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 mb-2';
            div.innerHTML = `
                <div class="flex items-center space-x-3 truncate">
                    <div class="w-8 h-8 rounded bg-white flex items-center justify-center text-blue-500 border border-gray-100">
                        <i class="fas fa-file-pdf"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="text-sm font-medium text-gray-900 truncate">${file.name}</div>
                        <div class="text-xs text-gray-500">${(file.size / 1024 / 1024).toFixed(2)} MB</div>
                    </div>
                </div>
                <button class="text-gray-400 hover:text-red-500 transition-colors p-1">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            div.querySelector('button').onclick = (e) => {
                e.stopPropagation();
                state.uploadedFiles.splice(idx, 1);
                renderUploadedFiles();
                updateAnalyzeBtn();
            };
            
            dom.fileList.appendChild(div);
        });
    }

    function updateAnalyzeBtn() {
        const total = state.selectedResumes.length + state.uploadedFiles.length;
        if (state.analysisMode === 'single') {
            dom.analyzeBtn.disabled = total !== 1;
            dom.analyzeBtn.textContent = '开始解析';
        } else {
            dom.analyzeBtn.disabled = total < 2;
            dom.analyzeBtn.textContent = `开始对比 (${total})`;
        }
    }

    function showEmptyState() {
        dom.emptyState.classList.remove('hidden');
        dom.singleResults.classList.add('hidden');
        dom.multiResults.classList.add('hidden');
    }

    // --- Analysis Logic ---

    async function startAnalysis() {
        if (state.isAnalyzing) return;
        
        state.isAnalyzing = true;
        dom.analyzeBtn.disabled = true;
        dom.loadingOverlay.classList.remove('hidden');
        
        // 更新进度提示 (Initial)
        updateLoadingProgress('正在准备分析环境...', 10);
        
        try {
            if (state.analysisMode === 'single') {
                await performSingleAnalysis();
            } else {
                await performMultiAnalysis();
            }
            
            // 成功后滚动到结果区域
            setTimeout(() => {
                const targetId = state.analysisMode === 'single' ? 'single-analysis-results' : 'multi-analysis-results';
                document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 300);

        } catch (e) {
            console.error('Analysis failed:', e);
            // 遵循用户规则：UI上要有相应的 Loading 和 Error 状态反馈
            if (typeof ui !== 'undefined' && ui.showNotification) {
                ui.showNotification(e.message || '分析过程中出现错误，请检查网络或重试', 'error');
            } else {
                alert('分析失败: ' + (e.message || '未知错误'));
            }
        } finally {
            state.isAnalyzing = false;
            dom.loadingOverlay.classList.add('hidden');
            updateAnalyzeBtn();
        }
    }

    function updateLoadingProgress(message, progress) {
        const loadingText = dom.loadingOverlay.querySelector('.loading-text');
        const progressBar = dom.loadingOverlay.querySelector('.progress-bar-inner');
        if (loadingText) loadingText.textContent = message;
        if (progressBar) progressBar.style.width = `${progress}%`;
    }

    async function performSingleAnalysis() {
        let result;
        const target = state.selectedResumes[0] || state.uploadedFiles[0];
        
        // Find the selected job object if any
        const selectedJob = state.jobs.find(j => j.id == state.selectedJobId) || null;
        
        // 1. 优先检查是否已经存在深度解析结果 (不再仅依赖初筛分数)
        if (state.selectedResumes.length > 0 && target.id) {
            updateLoadingProgress('正在检索历史分析记录...', 15);
            const existingResult = await window.aiAnalyzer.checkExistingAnalysis(target.id);
            
            // 核心修复：只有当存在有效结果（总分大于0且有维度分数）时才跳过 AI 调用
            const normalized = normalizeResult(existingResult);
            const hasDimensions = normalized && normalized.dimensions && 
                                 Object.values(normalized.dimensions).some(v => v > 0);
            
            if (normalized && normalized.overallScore > 0 && hasDimensions) {
                console.log('[SingleAnalysis] Found existing valid result with dimensions, skipping AI call');
                updateLoadingProgress('发现历史记录，正在渲染...', 100);
                state.analysisResult = existingResult;
                renderSingleResults(existingResult);
                return;
            } else if (existingResult) {
                console.log('[SingleAnalysis] Existing result found but it is incomplete (no dimensions or 0 score), re-analyzing...');
            }
        }

        updateLoadingProgress('正在读取简历内容...', 30);
        
        if (state.selectedResumes.length > 0) {
            // Analyze existing resume
            result = await window.aiAnalyzer.analyzeExistingResume(target.id, selectedJob, (p) => {
                updateLoadingProgress(p.message || '正在分析中...', 30 + (p.progress * 0.6));
            });
        } else {
            // Analyze uploaded file
            result = await window.aiAnalyzer.analyzeFile(target, selectedJob, (p) => {
                updateLoadingProgress(p.message || '正在分析中...', 30 + (p.progress * 0.6));
            });
        }
        
        updateLoadingProgress('分析完成，正在渲染结果...', 100);
        state.analysisResult = result;
        renderSingleResults(result);
    }

    async function performMultiAnalysis() {
        // Prepare IDs and names for existing resumes and files for upload
        const resumesInfo = state.selectedResumes.map(r => ({ id: r.id, name: r.name }));
        
        // Find the selected job object if any
        const selectedJob = state.jobs.find(j => j.id == state.selectedJobId) || null;
        
        // For uploaded files, we need to upload them first to get IDs
        if (state.uploadedFiles.length > 0) {
            console.log('[MultiAnalysis] Uploading files:', state.uploadedFiles.length);
            let fileIdx = 0;
            for (const file of state.uploadedFiles) {
                fileIdx++;
                updateLoadingProgress(`正在上传第 ${fileIdx}/${state.uploadedFiles.length} 份简历...`, 10 + (fileIdx / state.uploadedFiles.length * 20));
                
                try {
                    const formData = new FormData();
                    formData.append('file', file);
                    
                    // Use resumeDataManager.apiRequest for better error handling and token management
                    const uploadRes = await window.resumeDataManager.apiRequest('/ai/upload', 'POST', formData, true, true);
                    
                    if (uploadRes.success && uploadRes.data && uploadRes.data.resumeId) {
                        resumesInfo.push({
                            id: uploadRes.data.resumeId,
                            name: file.name.replace(/\.[^/.]+$/, "") // Remove extension
                        });
                        console.log(`[MultiAnalysis] File uploaded: ${file.name} -> ${uploadRes.data.resumeId}`);
                    } else {
                        throw new Error(`文件 ${file.name} 上传失败`);
                    }
                } catch (err) {
                    console.error('[MultiAnalysis] File upload failed:', err);
                    throw new Error(`文件 ${file.name} 上传失败: ${err.message}`);
                }
            }
        }
        
        const resumeIds = resumesInfo.map(r => r.id);
        console.log('[MultiAnalysis] Starting comparison for IDs:', resumeIds);
        
        if (resumeIds.length < 2) {
            throw new Error('请至少选择或上传 2 份简历进行对比');
        }
        
        updateLoadingProgress('正在进行多份简历横向对比分析...', 40);
        
        // Pass a dummy progress callback to show it's working
        const result = await window.aiAnalyzer.compareResumes(resumeIds, selectedJob, (p) => {
            console.log(`[MultiAnalysis] Progress: ${p.progress}% - ${p.message}`);
            updateLoadingProgress(p.message || '正在对比分析...', 40 + (p.progress * 0.5));
        });
        
        updateLoadingProgress('对比分析完成，正在渲染报告...', 100);
        console.log('[MultiAnalysis] Comparison result received:', result);
        state.comparisonResult = result;
        window.lastComparisonResult = result; // Set global for debugging
        renderMultiResults(result, resumesInfo);
    }

    // --- Rendering Results ---

    /**
     * @typedef {Object} NormalizedResult
     * @property {Object} basicInfo - 基础信息
     * @property {string} basicInfo.name - 姓名
     * @property {string} basicInfo.experience - 工作经验
     * @property {string} basicInfo.education - 学历
     * @property {string} basicInfo.salary - 薪资
     * @property {number} overallScore - 综合得分 (0-100)
     * @property {Object} dimensions - 维度得分 (0-100)
     * @property {number} dimensions.skills - 技能
     * @property {number} dimensions.experience - 经验
     * @property {number} dimensions.education - 学历
     * @property {number} dimensions.stability - 稳定性
     * @property {number} dimensions.potential - 潜力
     * @property {number} dimensions.teamwork - 团队协作
     * @property {string|Object} report - AI 报告内容
     * @property {any} raw - 原始数据
     */

    /**
     * 数据归一化处理 (Data Normalization)
     * 将不同后端返回的结构统一为标准格式
     * @param {any} data - 原始后端返回数据
     * @returns {NormalizedResult|null}
     */
    function normalizeResult(data) {
        if (!data) return null;
        
        // 核心修复：多层次嗅探后端返回的数据结构
        const resultData = data.data || data.analysis || data.result || data;
        
        // 1. 基础信息归一化
        const info = resultData.basic_info || resultData.parsed_data?.basic_info || resultData.parsedData?.personalInfo || {};
        const basicInfo = {
            name: info.name || resultData.candidate_name || resultData.name || '候选人',
            experience: info.experience || info.work_years || resultData.work_years || resultData.experience_years || '多年',
            education: info.education || info.highest_education || resultData.education_level || resultData.degree || '本科',
            salary: info.expected_salary || resultData.salary || '面议'
        };

        // 2. 分数归一化 (0-100)
        const overallScore = parseInt(
            resultData.overall_score || 
            resultData.total_score || 
            resultData.score || 
            resultData.match_score || 
            resultData.match_percent || 
            0
        );

        // 3. 维度分数归一化 (Radar & Cards)
        const rawScores = resultData.scores_percent || 
                         resultData.radar_scores || 
                         resultData.dimensions || 
                         resultData.score_detail || 
                         resultData.match_details || 
                         {};
        
        const getVal = (keys) => {
            for (const key of keys) {
                if (rawScores[key] !== undefined) {
                    const val = typeof rawScores[key] === 'object' ? parseInt(rawScores[key].score || rawScores[key].value || 0) : parseInt(rawScores[key]);
                    if (!isNaN(val)) return val;
                }
            }
            return 0;
        };

        const dimensions = {
            skills: getVal(['skills', 'skill_match', 'professional', '专业技能', '技能评分', '技能匹配']),
            experience: getVal(['experience', 'experience_match', 'background', '工作经验', '经验契合', '经验评分']),
            education: getVal(['education', 'education_background', 'academic', '学历背景', '教育背景', '学历评分']),
            stability: getVal(['stability', 'work_stability', 'tenure', '稳定性', '离职风险', '职业稳定性']),
            potential: getVal(['potential', 'growth_potential', 'development', '发展潜力', '潜力评分', '成长性']),
            teamwork: getVal(['teamwork', 'collaboration', 'social', '团队协作', '协作能力', '团队精神'])
        };

        // 4. AI 报告归一化
        const report = resultData.evaluation_report || 
                      resultData.analysis_report || 
                      resultData.report || 
                      resultData.evaluation || 
                      resultData.feedback ||
                      resultData.advice || 
                      '暂无详细报告内容';

        return {
            basicInfo,
            overallScore,
            dimensions,
            report,
            raw: resultData // 保留原始数据以备不时之需
        };
    }

    function renderSingleResults(rawData) {
        try {
            const data = normalizeResult(rawData);
            if (!data) return;
            
            dom.emptyState.classList.add('hidden');
            dom.multiResults.classList.add('hidden');
            dom.singleResults.classList.remove('hidden');
            
            console.log('Rendering single results with normalized data:', data);
            
            // 1. 基础信息 (Basic Info)
            if (dom.resName) dom.resName.textContent = data.basicInfo.name;
            if (dom.resInfo) {
                dom.resInfo.textContent = `${data.basicInfo.experience}经验 | ${data.basicInfo.education} | ${data.basicInfo.salary}`;
            }
            
            // 2. 核心得分 (Overall Score)
            if (dom.resScore) {
                animateNumber(dom.resScore, 0, data.overallScore, 1000);
            }
            
            // 3. 雷达图维度 (Radar Chart)
            renderRadarChart(data.dimensions);
            
            // 4. 维度卡片 (Score Cards)
            renderScoreCards(data.dimensions);
            
            // 5. AI 报告内容 (AI Report)
            renderAIReport(data.report);
            
        } catch (err) {
            console.error('Error in renderSingleResults:', err);
            if (typeof ui !== 'undefined' && ui.showNotification) {
                ui.showNotification('渲染分析结果出错，请检查控制台', 'error');
            }
        }
    }

    let radarChart = null;

    function renderRadarChart(scores) {
        if (!dom.radarContainer) return;
        
        const ctx = document.getElementById('radarChart');
        if (!ctx) return;

        if (radarChart) {
            radarChart.destroy();
        }

        const labels = ['专业技能', '经验契合', '学历背景', '稳定性', '潜力', '团队协作'];
        const values = [
            scores.skills || 0,
            scores.experience || 0,
            scores.education || 0,
            scores.stability || 0,
            scores.potential || 0,
            scores.teamwork || 0
        ];

        radarChart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: labels,
                datasets: [{
                    label: '能力维度',
                    data: values,
                    backgroundColor: 'rgba(37, 99, 235, 0.2)',
                    borderColor: 'rgb(37, 99, 235)',
                    pointBackgroundColor: 'rgb(37, 99, 235)',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgb(37, 99, 235)'
                }]
            },
            options: {
                elements: {
                    line: {
                        borderWidth: 2
                    }
                },
                scales: {
                    r: {
                        angleLines: {
                            display: true
                        },
                        suggestedMin: 0,
                        suggestedMax: 100,
                        ticks: {
                            display: false,
                            stepSize: 20
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                },
                maintainAspectRatio: false
            }
        });
    }

    function renderScoreCards(scores) {
        dom.scoreCards.innerHTML = '';
        const dimensions = [
            { key: 'skills', label: '技能匹配', icon: 'fa-tools', bgColor: 'bg-blue-50', textColor: 'text-blue-600' },
            { key: 'experience', label: '经验契合', icon: 'fa-briefcase', bgColor: 'bg-blue-50', textColor: 'text-blue-600' },
            { key: 'education', label: '学历背景', icon: 'fa-graduation-cap', bgColor: 'bg-blue-50', textColor: 'text-blue-600' },
            { key: 'stability', label: '离职稳定性', icon: 'fa-anchor', bgColor: 'bg-blue-50', textColor: 'text-blue-600' },
            { key: 'potential', label: '发展潜力', icon: 'fa-rocket', bgColor: 'bg-blue-50', textColor: 'text-blue-600' },
            { key: 'teamwork', label: '团队协作', icon: 'fa-users', bgColor: 'bg-blue-50', textColor: 'text-blue-600' }
        ];

        dimensions.forEach(dim => {
            // 统一为 100 分制 (Unified to 100-point scale)
            let scoreValue = scores[dim.key] || 0;
            // 如果原始分值就是 0-5 (例如某些 AI 模型返回)，转换为 0-100
            if (scoreValue > 0 && scoreValue <= 5) {
                scoreValue = scoreValue * 20;
            }
            
            const displayScore = Math.round(scoreValue);
            const progressWidth = Math.min(100, Math.max(0, displayScore));
            
            const item = document.createElement('div');
            item.className = 'flex items-center justify-between py-3 border-b border-gray-50 last:border-0 group transition-all';
            item.innerHTML = `
                <div class="flex items-center space-x-3 flex-1">
                    <div class="w-9 h-9 rounded-lg bg-blue-50/50 text-blue-500 flex items-center justify-center text-xs group-hover:bg-blue-100/50 transition-colors">
                        <i class="fas ${dim.icon}"></i>
                    </div>
                    <div class="flex-1 pr-4">
                        <div class="flex justify-between items-center mb-1.5">
                            <div class="text-sm font-semibold text-gray-700 group-hover:text-blue-600 transition-colors">${dim.label}</div>
                            <div class="flex items-baseline space-x-0.5">
                                <span class="text-sm font-black text-blue-600">${displayScore}</span>
                                <span class="text-[10px] text-gray-400 font-bold">/ 100</span>
                            </div>
                        </div>
                        <div class="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                            <div class="h-full bg-blue-600 rounded-full transition-all duration-1000" style="width: 0%"></div>
                        </div>
                    </div>
                </div>
            `;
            dom.scoreCards.appendChild(item);
            
            // 延迟触发动画
            setTimeout(() => {
                const bar = item.querySelector('.bg-blue-600');
                if (bar) bar.style.width = `${progressWidth}%`;
            }, 100);
        });
    }

    function renderAIReport(report) {
        if (!dom.aiReport) {
            console.warn('AI Report container not found');
            return;
        }

        if (typeof report === 'string') {
            // Convert simple markdown-like content to HTML
            const html = report
                .replace(/### (.*)/g, '<h4 class="text-lg font-bold text-gray-900 mt-6 mb-3">$1</h4>')
                .replace(/## (.*)/g, '<h3 class="text-xl font-bold text-gray-900 mt-8 mb-4">$1</h3>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\n/g, '<br>');
            dom.aiReport.innerHTML = html;
        } else if (typeof report === 'object' && report !== null) {
            // If report is structured object
            let html = '';
            
            // 综合评价 (Summary) - 支持更多字段名
            const summary = report.summary || report.hiring_advice || report.overall_evaluation || report.content || '';
            if (summary) {
                html += `<div class="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 mb-8">
                    <h4 class="text-blue-900 font-bold mb-2 flex items-center">
                        <i class="fas fa-quote-left mr-2 text-blue-400"></i>
                        综合评价
                    </h4>
                    <p class="text-blue-800 leading-relaxed text-sm">${summary}</p>
                </div>`;
            }
            
            // 核心优势 (Strengths)
            const strengths = report.strengths || report.core_strengths || report.highlights || [];
            if (Array.isArray(strengths) && strengths.length > 0) {
                html += `<div class="mb-8">
                    <h4 class="text-gray-900 font-bold mb-4 flex items-center">
                        <i class="fas fa-check-circle mr-2 text-green-500"></i>
                        核心优势
                    </h4>
                    <ul class="space-y-3">
                        ${strengths.map(s => `<li class="flex items-start text-sm">
                            <span class="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 mr-3 flex-shrink-0"></span>
                            <span>${s}</span>
                        </li>`).join('')}
                    </ul>
                </div>`;
            }

            // 潜在风险 (Weaknesses/Risks)
            const weaknesses = report.weaknesses || report.potential_issues || report.risks || report.shortcomings || [];
            if (Array.isArray(weaknesses) && weaknesses.length > 0) {
                html += `<div class="mb-8">
                    <h4 class="text-gray-900 font-bold mb-4 flex items-center">
                        <i class="fas fa-exclamation-triangle mr-2 text-red-400"></i>
                        潜在风险
                    </h4>
                    <ul class="space-y-3">
                        ${weaknesses.map(w => `<li class="flex items-start text-sm">
                            <span class="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 mr-3 flex-shrink-0"></span>
                            <span>${w}</span>
                        </li>`).join('')}
                    </ul>
                </div>`;
            }
            
            // 改进建议 (Suggestions)
            const suggestions = report.suggestions || report.career_advice || report.improvement_suggestions || [];
            if (Array.isArray(suggestions) && suggestions.length > 0) {
                html += `<div class="mb-8">
                    <h4 class="text-gray-900 font-bold mb-4 flex items-center">
                        <i class="fas fa-lightbulb mr-2 text-yellow-500"></i>
                        改进建议
                    </h4>
                    <ul class="space-y-3">
                        ${suggestions.map(s => `<li class="flex items-start text-sm">
                            <span class="w-1.5 h-1.5 rounded-full bg-yellow-500 mt-1.5 mr-3 flex-shrink-0"></span>
                            <span>${s}</span>
                        </li>`).join('')}
                    </ul>
                </div>`;
            }
            
            if (!html) html = '<div class="text-center py-10 text-gray-400">报告内容解析中或为空</div>';
            dom.aiReport.innerHTML = html;
        } else {
            dom.aiReport.innerHTML = '<div class="text-center py-10 text-gray-400">暂无详细报告内容</div>';
        }
    }

    let multiRadarChart = null;

    function renderMultiRadarChart(people, colors) {
        const ctx = document.getElementById('multiRadarChart');
        if (!ctx) return;

        if (multiRadarChart) {
            multiRadarChart.destroy();
        }

        const labels = ['专业技能', '经验契合', '学历背景', '稳定性', '潜力', '团队协作'];
        const datasets = people.map((p, i) => ({
            label: p.name,
            data: [
                p.scores_percent.skills || 0,
                p.scores_percent.experience || 0,
                p.scores_percent.education || 0,
                p.scores_percent.stability || 0,
                p.scores_percent.potential || 0,
                p.scores_percent.teamwork || 0
            ],
            backgroundColor: colors[i % colors.length].bg,
            borderColor: colors[i % colors.length].border,
            pointBackgroundColor: colors[i % colors.length].border,
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: colors[i % colors.length].border,
            borderWidth: 2
        }));

        multiRadarChart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                scales: {
                    r: {
                        angleLines: { display: true },
                        suggestedMin: 0,
                        suggestedMax: 100,
                        ticks: { display: false, stepSize: 20 }
                    }
                },
                plugins: {
                    legend: { display: false }
                },
                maintainAspectRatio: false
            }
        });
    }

    /**
 * 渲染多人对比结果
 */
function renderMultiResults(data, selectedResumes = []) {
    try {
        console.log('[RenderMulti] Starting with data:', data, 'selectedResumes:', selectedResumes);
        
        dom.emptyState.classList.add('hidden');
        dom.singleResults.classList.add('hidden');
        dom.multiResults.classList.remove('hidden');
        
        // 提取数据
        let resultData = data.data || data.comparison || data.result || data;
        
        // 如果数据是字符串，尝试解析 (针对可能的解析残留)
        if (typeof resultData === 'string') {
            console.log('[RenderMulti] resultData is string, attempting to parse');
            try {
                // 尝试清理 Markdown 代码块
                let cleanData = resultData.replace(/```(?:json)?\s*([\s\S]*?)\s*```/i, '$1').trim();
                // 尝试提取 JSON 部分
                const firstBrace = cleanData.indexOf('{');
                const lastBrace = cleanData.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1) {
                    cleanData = cleanData.substring(firstBrace, lastBrace + 1);
                }
                resultData = JSON.parse(cleanData);
            } catch (e) {
                console.error('[RenderMulti] Failed to parse resultData string:', e);
            }
        }
        
        if (!resultData || (typeof resultData !== 'object') || Object.keys(resultData).length === 0) {
            dom.multiResults.innerHTML = `
                <div class="text-center py-20 bg-white rounded-xl border border-gray-100 shadow-sm">
                    <i class="fas fa-exclamation-triangle text-amber-500 text-4xl mb-4"></i>
                    <div class="text-gray-500 font-medium">未获取到有效的对比数据</div>
                    <div class="text-gray-400 text-xs mt-2">数据类型: ${typeof resultData}</div>
                    <div class="mt-6">
                        <button onclick="console.log('Raw data:', window.lastComparisonResult)" class="text-blue-600 text-xs hover:underline">在控制台查看原始数据</button>
                    </div>
                </div>
            `;
            return;
        }
        
        // 解析候选人列表
        let people = [];
        const candidates = resultData.candidates || resultData.people || resultData.results || resultData.candidate_list || [];
        
                if (Array.isArray(candidates) && candidates.length > 0) {
                    people = candidates.map((c, i) => {
                        const normalized = normalizeResult(c);
                        return {
                            name: normalized.basicInfo.name !== '未知' ? normalized.basicInfo.name : (selectedResumes[i] ? selectedResumes[i].name : `候选人 ${String.fromCharCode(65 + i)}`),
                            total_score: normalized.overallScore,
                            scores_percent: normalized.dimensions,
                            summary: normalized.report
                        };
                    });
                } else {
                    // 兜底逻辑：如果返回的是全局映射结构 (例如 { "A": { ... }, "B": { ... } })
                    console.warn('[RenderMulti] No candidates array found, attempting fallback mapping from keys');
                    
                    const possibleKeys = ['A', 'B', 'C', 'D', 'E', 'F'];
                    possibleKeys.forEach((key, i) => {
                        if (resultData[key] && typeof resultData[key] === 'object') {
                            const normalized = normalizeResult(resultData[key]);
                            people.push({
                                name: normalized.basicInfo.name !== '未知' ? normalized.basicInfo.name : (selectedResumes[i] ? selectedResumes[i].name : `候选人 ${key}`),
                                total_score: normalized.overallScore,
                                scores_percent: normalized.dimensions,
                                summary: normalized.report
                            });
                        }
                    });

                    // 进一步兜底：如果还是没找到，尝试遍历所有对象键，寻找看起来像候选人的数据
                    if (people.length === 0) {
                        Object.keys(resultData).forEach((key, i) => {
                            const val = resultData[key];
                            if (val && typeof val === 'object' && (val.overall_score || val.scores_percent || val.total_score)) {
                                const normalized = normalizeResult(val);
                                people.push({
                                    name: normalized.basicInfo.name !== '未知' ? normalized.basicInfo.name : `候选人 ${key}`,
                                    total_score: normalized.overallScore,
                                    scores_percent: normalized.dimensions,
                                    summary: normalized.report
                                });
                            }
                        });
                    }
                }
            
            if (people.length === 0) {
                console.error('[RenderMulti] Failed to map any candidates. resultData keys:', Object.keys(resultData));
                dom.multiResults.innerHTML = `
                    <div class="text-center py-20 bg-white rounded-xl border border-gray-100 shadow-sm">
                        <i class="fas fa-users-slash text-gray-300 text-4xl mb-4"></i>
                        <div class="text-gray-500 font-medium">未能解析出候选人对比信息</div>
                        <div class="text-gray-400 text-xs mt-2">AI 返回了数据但结构无法识别。包含的键：${Object.keys(resultData).join(', ')}</div>
                        <div class="mt-6">
                            <button onclick="console.log('Raw data:', window.lastComparisonResult)" class="text-blue-600 text-xs hover:underline">在控制台查看原始数据</button>
                        </div>
                    </div>
                `;
                return;
            }

            const colors = [
                { border: 'rgb(37, 99, 235)', bg: 'rgba(37, 99, 235, 0.1)' },
                { border: 'rgb(16, 185, 129)', bg: 'rgba(16, 185, 129, 0.1)' },
                { border: 'rgb(245, 158, 11)', bg: 'rgba(245, 158, 11, 0.1)' },
                { border: 'rgb(139, 92, 246)', bg: 'rgba(139, 92, 246, 0.1)' },
                { border: 'rgb(236, 72, 153)', bg: 'rgba(236, 72, 153, 0.1)' }
            ];

            const dims = [
                { key: 'skills', label: '专业技能' },
                { key: 'experience', label: '经验契合' },
                { key: 'education', label: '学历背景' },
                { key: 'stability', label: '离职稳定性' },
                { key: 'potential', label: '发展潜力' },
                { key: 'teamwork', label: '团队协作' }
            ];

            // 修复 Winner 解析逻辑：支持 A/B/C 索引或直接姓名
            const getWinnerName = (winner) => {
                if (!winner) return '暂无';
                if (winner === 'Tie') return '多位人选平局';
                
                // 如果是 A, B, C...
                if (winner.length === 1 && winner >= 'A' && winner <= 'Z') {
                    const idx = winner.charCodeAt(0) - 65;
                    return people[idx] ? people[idx].name : winner;
                }
                
                // 如果是候选人姓名，直接返回
                return winner;
            };

            const recommendation = resultData.recommendation || {};
            const winnerName = getWinnerName(recommendation.winner);

            let html = `
                <div class="space-y-6">
                    <!-- Top Section: Radar Chart + Candidate Legend -->
                    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <!-- Left: Radar Chart -->
                        <div class="lg:col-span-2 bg-white rounded-xl p-8 border border-gray-100 shadow-sm">
                            <h4 class="text-lg font-bold text-gray-900 mb-8 flex items-center">
                                <i class="fas fa-chart-pie mr-2 text-blue-600"></i>
                                能力对比分布
                            </h4>
                            <div class="h-[380px] relative">
                                <canvas id="multiRadarChart"></canvas>
                            </div>
                        </div>

                        <!-- Right: Candidate Legend -->
                        <div class="lg:col-span-1 bg-white rounded-xl p-8 border border-gray-100 shadow-sm flex flex-col">
                            <h4 class="text-lg font-bold text-gray-900 mb-8 flex items-center">
                                <i class="fas fa-users mr-2 text-blue-600"></i>
                                候选人概览
                            </h4>
                            <div class="space-y-4 overflow-y-auto custom-scrollbar flex-grow pr-1">
                                ${people.map((p, i) => `
                                    <div class="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-blue-200 transition-colors">
                                        <div class="flex items-center space-x-3">
                                            <div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm" style="background-color: ${colors[i % colors.length].border}">
                                                ${p.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div class="font-bold text-gray-900 text-sm">${p.name}</div>
                                                <div class="text-[10px] text-gray-500 font-medium">综合评分</div>
                                            </div>
                                        </div>
                                        <div class="text-xl font-black text-blue-600">${p.total_score}</div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>

                    <!-- Middle Section: Score Table (Horizontal Metrics) -->
                    <div class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                        <div class="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/30">
                            <h3 class="text-base font-bold text-gray-900">核心维度对照表</h3>
                            <span class="px-2.5 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                                Dimension Matrix
                            </span>
                        </div>
                        <div class="w-full overflow-x-auto">
                            <table class="w-full text-left border-collapse min-w-[600px]">
                                <thead>
                                    <tr class="bg-gray-50/50">
                                        <th class="p-3 border-b border-gray-100 text-[11px] font-bold text-gray-500 w-[120px]">候选人</th>
                                        ${dims.map(dim => `
                                            <th class="p-3 border-b border-gray-100 text-center text-[11px] font-bold text-gray-500 leading-tight">
                                                <div class="flex flex-col items-center justify-center">
                                                    <span>${dim.label}</span>
                                                </div>
                                            </th>
                                        `).join('')}
                                        <th class="p-3 border-b border-gray-100 text-center text-[11px] font-bold text-gray-500 w-[80px]">综合得分</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-gray-50 text-xs text-gray-600">
                                    ${people.map((p, i) => `
                                        <tr class="hover:bg-blue-50/30 transition-colors">
                                            <td class="p-3 bg-gray-50/10">
                                                <div class="flex items-center space-x-2">
                                                    <div class="w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-white text-[9px] font-bold shadow-sm" style="background-color: ${colors[i % colors.length].border}">
                                                        ${p.name.charAt(0)}
                                                    </div>
                                                    <span class="font-bold text-gray-900 truncate" title="${p.name}">${p.name}</span>
                                                </div>
                                            </td>
                                            ${dims.map(dim => {
                                                const score = p.scores_percent[dim.key] || 0;
                                                return `
                                                    <td class="p-3 text-center">
                                                        <div class="flex flex-col items-center">
                                                            <span class="font-bold ${score >= 85 ? 'text-green-600' : score >= 70 ? 'text-blue-600' : 'text-gray-500'}">${score}</span>
                                                            <div class="w-full max-w-[40px] h-1 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
                                                                <div class="h-full ${score >= 85 ? 'bg-green-500' : score >= 70 ? 'bg-blue-500' : 'bg-gray-400'}" style="width: ${score}%"></div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                `;
                                            }).join('')}
                                            <td class="p-3 text-center bg-blue-50/10">
                                                <span class="text-sm font-black text-blue-600">${p.total_score}</span>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Bottom Section: AI Comprehensive Analysis -->
                    <div class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                        <div class="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/30">
                            <h4 class="text-lg font-bold text-gray-900 flex items-center">
                                <i class="fas fa-robot mr-2 text-blue-600"></i>
                                AI 综合对比分析
                            </h4>
                        </div>
                        <div class="p-8">
                            ${recommendation.reason ? `
                                <div class="mb-8 p-6 bg-blue-50/50 rounded-2xl border border-blue-100">
                                    <div class="flex items-center space-x-3 mb-4">
                                        <div class="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md">
                                            <i class="fas fa-trophy"></i>
                                        </div>
                                        <div>
                                            <h5 class="text-base font-bold text-gray-900">
                                                推荐人选：${winnerName}
                                            </h5>
                                            <p class="text-xs text-blue-600 font-medium uppercase tracking-wider">Top Recommendation</p>
                                        </div>
                                    </div>
                                    <p class="text-sm text-gray-700 leading-relaxed">${recommendation.reason}</p>
                                    ${recommendation.hiring_risk ? `
                                        <div class="mt-4 pt-4 border-t border-blue-100 flex items-start space-x-2">
                                            <i class="fas fa-exclamation-triangle text-amber-500 mt-0.5"></i>
                                            <p class="text-xs text-gray-600"><span class="font-bold text-amber-600">风险提示：</span>${recommendation.hiring_risk}</p>
                                        </div>
                                    ` : ''}
                                </div>
                            ` : ''}

                            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                ${people.map((p, i) => `
                                    <div class="bg-gray-50/50 p-6 rounded-2xl border border-gray-100 hover:shadow-md transition-all">
                                        <div class="flex items-center justify-between mb-4">
                                            <div class="flex items-center space-x-3">
                                                <div class="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm" style="background-color: ${colors[i % colors.length].border}">
                                                    ${p.name.charAt(0)}
                                                </div>
                                                <span class="font-bold text-gray-900 truncate max-w-[120px]" title="${p.name}">${p.name}</span>
                                            </div>
                                            <div class="flex flex-col items-end">
                                                <span class="text-xl font-black text-blue-600">${p.total_score}</span>
                                                <span class="text-[10px] text-gray-400 font-bold uppercase">Points</span>
                                            </div>
                                        </div>
                                        <div class="relative">
                                            <i class="fas fa-quote-left absolute -top-2 -left-2 text-blue-100 text-2xl"></i>
                                            <p class="text-sm text-gray-600 leading-relaxed relative z-10 pl-2">
                                                ${p.summary || '暂无评价'}
                                            </p>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>

                            ${resultData.comparison_table ? `
                                <div class="mt-10">
                                    <h5 class="text-base font-bold text-gray-900 mb-6 flex items-center">
                                        <i class="fas fa-th-list mr-2 text-blue-500"></i>
                                        详细对比矩阵
                                    </h5>
                                    <div class="overflow-x-auto rounded-xl border border-gray-100">
                                        <table class="w-full text-xs text-left border-collapse min-w-[500px]">
                                            <thead>
                                                <tr class="bg-gray-50 border-b border-gray-100">
                                                    <th class="p-4 font-bold text-gray-600 w-32">对比维度</th>
                                                    ${people.map(p => `
                                                        <th class="p-4 font-bold text-gray-600">${p.name}</th>
                                                    `).join('')}
                                                    <th class="p-4 font-bold text-gray-600 w-24 text-center">胜出者</th>
                                                </tr>
                                            </thead>
                                            <tbody class="divide-y divide-gray-50">
                                                ${resultData.comparison_table.map(row => `
                                                    <tr class="hover:bg-blue-50/20 transition-colors">
                                                        <td class="p-4 font-bold text-gray-700 bg-gray-50/30">${row.dimension}</td>
                                                        ${people.map((_, i) => `
                                                            <td class="p-4 text-gray-600 leading-relaxed">
                                                                ${row[String.fromCharCode(65 + i)] || row[people[i]?.name] || '-'}
                                                            </td>
                                                        `).join('')}
                                                        <td class="p-4 text-center">
                                                            <span class="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${row.winner === 'Tie' ? 'bg-gray-100 text-gray-600' : 'bg-green-50 text-green-600 border border-green-100'}">
                                                                ${getWinnerName(row.winner)}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                `).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
            
            dom.multiResults.innerHTML = html;
            renderMultiRadarChart(people, colors);
        } catch (err) {
            console.error('Render multi results failed:', err);
            dom.multiResults.innerHTML = `
                <div class="bg-red-50 p-8 rounded-xl border border-red-100 text-center">
                    <i class="fas fa-exclamation-circle text-red-500 text-3xl mb-4"></i>
                    <h3 class="text-lg font-bold text-red-800 mb-2">渲染对比结果失败</h3>
                    <p class="text-red-600 text-sm mb-4">${err.message}</p>
                    <button onclick="location.reload()" class="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold">刷新页面重试</button>
                </div>
            `;
        }
    }

    // --- Helpers ---

    function debounce(func, wait) {
        let timeout;
        return function() {
            const context = this, args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    }

    function animateNumber(el, start, end, duration) {
        let startTime = null;
        const step = (currentTime) => {
            if (!startTime) startTime = currentTime;
            const progress = Math.min((currentTime - startTime) / duration, 1);
            el.textContent = Math.floor(progress * (end - start) + start);
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }

    // Initialize on DOM Load
    document.addEventListener('DOMContentLoaded', init);
})();
