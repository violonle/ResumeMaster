/**
 * Resume Tools Controller V2
 * Implements the new layout and logic for Resume Analysis and Comparison
 */

(function () {
    // Shared State
    const state = {
        activeSidebarTab: 'library', // 'library' or 'upload'
        analysisMode: 'single',      // 'single' or 'multi'
        selectedResumes: [],         // Selected resume objects from library
        uploadedFiles: [],           // Files uploaded in the current session
        isAnalyzing: false,
        forceNextAnalysis: false, // 是否强制重新解析
        analysisResult: null,
        comparisonResult: null,
        talentPool: [],              // All resumes from the talent pool
        jobs: [],                    // All jobs from the database
        selectedJobId: 'all',        // Currently selected job for filtering
        pendingSingleAction: null,
        loadingTimer: null,          // 载入界面跳转按钮定时器
        loadingActionsVisible: false // 是否已显示手动跳转按钮
    };

    const deepAnalysisCompletenessCache = new Map();
    const deepAnalysisCompletenessInFlight = new Set();

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
        analysisModeTabs: document.querySelectorAll('.main-content-area .tab-card'),
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
        aiReport: document.getElementById('ai-report'),
        highlightsRisksContainer: document.getElementById('highlights-risks-container'),
        resHighlights: document.getElementById('res-highlights'),
        resRisks: document.getElementById('res-risks'),
        reanalyzeBtn: document.getElementById('reanalyze-btn'),
        exportMdSingleBtn: document.getElementById('exportMdSingleBtn'),
        exportPdfSingleBtn: document.getElementById('exportPdfSingleBtn'),
        viewResultsBtn: document.getElementById('view-results-btn')
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
        const modeTabs = document.querySelectorAll('[data-mode]');
        modeTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                // Find the closest button element in case the click was on an inner element
                const button = e.target.closest('button');
                if (!button) return;

                const mode = button.dataset.mode;
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
        dom.analyzeBtn.addEventListener('click', onAnalyzeBtnClick);

        // Re-analyze Button
        if (dom.reanalyzeBtn) {
            dom.reanalyzeBtn.addEventListener('click', async () => {
                const target = state.selectedResumes[0] || state.uploadedFiles[0];
                const resumeId = target ? (target.id || target.resumeId) : (state.analysisResult ? (state.analysisResult.resume_id || state.analysisResult.id) : null);

                if (!resumeId) {
                    alert('无法获取简历ID，请选择简历后再试');
                    return;
                }

                if (!confirm('确定要重新解析吗？这将强制消耗 AI 额度重新生成报告。')) return;

                try {
                    // Update button UI state
                    const originalContent = dom.reanalyzeBtn.innerHTML;
                    dom.reanalyzeBtn.disabled = true;
                    dom.reanalyzeBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>重新解析中...';

                    // Set force flag and trigger analysis
                    state.forceNextAnalysis = true;

                    // 提取当前维度得分，以便在重新解析时保持不变
                    let currentDimensions = null;
                    let currentOverallScore = null;
                    if (state.analysisResult) {
                        const normalized = normalizeResult(state.analysisResult);
                        if (normalized) {
                            if (normalized.dimensions) {
                                currentDimensions = normalized.dimensions;
                            }
                            if (normalized.overallScore) {
                                currentOverallScore = normalized.overallScore;
                            }
                            console.log('[Re-analyze] Preserving current metrics:', {
                                dimensions: currentDimensions,
                                score: currentOverallScore
                            });
                        }
                    }

                    // Directly call startAnalysis which handles the overlay and progress
                    await startAnalysis(currentDimensions, currentOverallScore);

                    // Reset UI and flags
                    state.forceNextAnalysis = false;
                    dom.reanalyzeBtn.disabled = false;
                    dom.reanalyzeBtn.innerHTML = originalContent;
                } catch (error) {
                    console.error('Re-analyze error:', error);
                    state.forceNextAnalysis = false;
                    dom.reanalyzeBtn.disabled = false;
                    dom.reanalyzeBtn.innerHTML = '<i class="fas fa-microscope mr-1"></i>重新解析';
                    alert('重新解析失败，请稍后重试');
                }
            });
        }

        // Export MD Button
        if (dom.exportMdSingleBtn) {
            dom.exportMdSingleBtn.addEventListener('click', () => {
                if (!state.analysisResult) {
                    alert('请先完成解析后再导出');
                    return;
                }
                const md = buildMarkdown();
                const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const nameText = dom.resName ? dom.resName.textContent : '简历解析报告';
                const dateStr = new Date().toISOString().slice(0, 10);
                a.download = `${nameText}_${dateStr}.md`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            });
        }

        // PDF Export for Single Results
        if (dom.exportPdfSingleBtn) {
            dom.exportPdfSingleBtn.addEventListener('click', (e) => {
                const name = dom.resName ? dom.resName.textContent : '简历分析报告';
                const dateStr = new Date().toISOString().slice(0, 10);
                exportToPdf('single-analysis-results', `${name}_深度分析报告_${dateStr}.pdf`, e.currentTarget);
            });
        }

        // Modal Confirm Button
        const confirmAnalysisBtn = document.getElementById('confirmAnalysisBtn');
        if (confirmAnalysisBtn) {
            confirmAnalysisBtn.addEventListener('click', () => {
                const modal = document.getElementById('analysisModal');
                if (modal) modal.classList.add('hidden');

                // 核心修复：单一解析模式下，不再跳转到详情页，而是直接在当前页面进行解析
                // 这样符合用户“在 resume-tools.html 生成内容”的预期
                if (state.analysisMode === 'single' && state.pendingSingleAction && state.pendingSingleAction.type === 'view_existing' && state.pendingSingleAction.resumeId) {
                    // 如果是查看已有结果，可以直接跳转到详情页，或者在当前页渲染（取决于需求）
                    // 这里为了体验一致性，我们选择在当前页渲染
                    openExistingAnalysis({ id: state.pendingSingleAction.resumeId });
                    return;
                }

                startAnalysis();
            });
        }

        if (dom.viewResultsBtn) {
            dom.viewResultsBtn.addEventListener('click', () => {
                dom.loadingOverlay.classList.add('hidden');
                const targetId = state.analysisMode === 'single' ? 'single-analysis-results' : 'multi-analysis-results';
                document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

                // 重置相关状态
                state.loadingActionsVisible = false;
                if (dom.viewResultsBtn) dom.viewResultsBtn.classList.add('hidden');
            });
        }
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
            state.talentPool = await window.resumeDataManager.getTalentPoolResumes(false, true, { isTalentPool: true });
        } catch (e) {
            state.talentPool = [];
        }
    }

    async function loadJobs() {
        if (!window.resumeDataManager) return;
        try {
            const result = await window.resumeDataManager.apiRequest('/jobs', 'GET', null, true, true); // Added silent=true
            state.jobs = result.data || [];
        } catch (e) {
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

        // Sort: Unanalyzed first, then analyzed
        // We use overall_score, is_analyzed, or backend status flags as indicators
        const sorted = [...filtered].sort((a, b) => {
            const aAnalyzed = !!(a.has_deep_analysis || (a.analysis && a.analysis.overall_score > 0) || a.is_analyzed || (a.overall_score && a.overall_score > 0) || a.status === 'analyzed');
            const bAnalyzed = !!(b.has_deep_analysis || (b.analysis && b.analysis.overall_score > 0) || b.is_analyzed || (b.overall_score && b.overall_score > 0) || b.status === 'analyzed');
            if (aAnalyzed === bAnalyzed) return 0;
            return aAnalyzed ? 1 : -1;
        });

        dom.candidateList.innerHTML = '';
        if (sorted.length === 0) {
            dom.candidateList.innerHTML = '<div class="text-center py-8 text-gray-400 text-sm">暂无匹配候选人</div>';
            return;
        }

        sorted.forEach(c => {
            const isSelected = state.selectedResumes.some(r => r.id === c.id);

            const cachedCompleteness = deepAnalysisCompletenessCache.get(String(c.id));
            const isDeepAnalysisComplete = cachedCompleteness === true;

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

            // Determine action element: Radio/Checkbox or View Analysis link
            let actionHtml = '';
            if (state.analysisMode === 'single' && isDeepAnalysisComplete) {
                actionHtml = `
                    <a href="analysis-detail.html?resume_id=${c.id}&trigger=true" class="text-[10px] font-bold text-blue-600 hover:text-blue-700 hover:underline flex items-center whitespace-nowrap bg-blue-50 px-2 py-1 rounded-lg border border-blue-100 transition-all">
                        <i class="fas fa-chart-line mr-1"></i>查看解析
                    </a>
                `;
            } else {
                actionHtml = `
                    <input type="${state.analysisMode === 'single' ? 'radio' : 'checkbox'}" 
                           class="w-5 h-5 text-blue-600 accent-blue-600 bg-gray-50 border-gray-200 focus:ring-blue-500 focus:ring-2 checked:bg-blue-600 checked:border-transparent ${state.analysisMode === 'single' ? 'rounded-full' : 'rounded'} transition-all"
                           ${isSelected ? 'checked' : ''}>
                `;
            }

            div.innerHTML = `
                <div class="flex items-center space-x-3">
                    <div class="flex-shrink-0">
                        ${window.ui.renderAvatar(c.avatar, c.name || '未命名', 'w-10 h-10', 'rounded-full', true)}
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
                        ${actionHtml}
                    </div>
                </div>
            `;

            // If analyzed in single mode, clicking the item should probably just go to the link, 
            // but the user might want to select it for re-analysis?
            // "如已解析，则不显示单选radio，用‘查看解析’的链接来替代"
            // This implies you can't select it for analysis if it's already analyzed.
            if (state.analysisMode === 'single' && isDeepAnalysisComplete) {
                const open = (e) => {
                    if (e && (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) return;
                    if (e) e.preventDefault();
                    openExistingAnalysis(c);
                };
                const link = div.querySelector('a');
                if (link) {
                    link.addEventListener('click', open);
                }
                div.onclick = (e) => {
                    if (e.target.tagName === 'A' || e.target.closest('a')) return;
                    open(e);
                };
            } else {
                div.onclick = () => {
                    toggleCandidateSelection(c);
                };
            }
            dom.candidateList.appendChild(div);
        });

        if (state.analysisMode === 'single') {
            prefetchDeepAnalysisCompleteness(sorted.map(c => String(c.id)));
        }
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
                    // ui.showNotification('最多只能对比5份简历', 'warning');
                    alert('最多只能对比5份简历');
                    return;
                }
                state.selectedResumes.push(candidate);
            } else {
                state.selectedResumes.splice(index, 1);
            }
        }

        renderCandidateList();
        updateAnalyzeBtn();
        showEmptyState();
        state.analysisResult = null;
        state.comparisonResult = null;
    }

    function handleFileUpload(fileList) {
        const files = Array.from(fileList).filter(f => {
            const ext = f.name.split('.').pop().toLowerCase();
            return ['pdf', 'doc', 'docx', 'txt'].includes(ext) && f.size <= 10 * 1024 * 1024;
        });

        if (files.length === 0) {
            // ui.showNotification('请上传10MB以内的PDF/DOC/DOCX/TXT文件', 'warning');
            alert('请上传10MB以内的PDF/DOC/DOCX/TXT文件');
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

    async function onAnalyzeBtnClick() {
        if (state.analysisMode !== 'single') {
            const modal = document.getElementById('analysisModal');
            if (modal) modal.classList.remove('hidden');
            state.pendingSingleAction = null;
            return;
        }

        const target = state.selectedResumes[0] || null;
        if (!target || !target.id) return;

        const rid = String(target.id);
        const name = String(target.name || '该候选人');
        const modal = document.getElementById('analysisModal');
        const titleEl = document.getElementById('analysis-modal-title');
        const msgEl = document.getElementById('analysis-modal-message');
        const confirmBtn = document.getElementById('confirmAnalysisBtn');

        const isComplete = await fetchDeepAnalysisCompleteness(rid);

        if (isComplete) {
            state.pendingSingleAction = { type: 'view_existing', resumeId: rid, name };
            if (titleEl) titleEl.textContent = '深度解析已存在';
            if (msgEl) msgEl.textContent = `${name} 已进行过深度解析，您可直接查看解析结果。`;
            if (confirmBtn) confirmBtn.textContent = '查看结果';
        } else {
            state.pendingSingleAction = { type: 'start_new', resumeId: rid, name };
            if (titleEl) titleEl.textContent = '深度解析说明';
            if (msgEl) msgEl.textContent = '深度解析将消耗 1 个 AI 点数，通过多维度深度评估候选人与职位的匹配度。';
            if (confirmBtn) confirmBtn.textContent = '立即解析';
        }

        if (modal) modal.classList.remove('hidden');
    }

    async function openExistingAnalysis(candidate) {
        if (!candidate || !candidate.id) return;

        // 为了统一体验和解决“内容为空”的问题，点击历史记录也跳转到统一的详情页
        window.location.href = `analysis-detail.html?resume_id=${encodeURIComponent(String(candidate.id))}`;
    }

    // --- Analysis Logic ---

    async function startAnalysis(preservedDimensions = null, preservedScore = null) {
        if (state.isAnalyzing) {
            return;
        }

        state.isAnalyzing = true;
        if (dom.analyzeBtn) dom.analyzeBtn.disabled = true;

        // 重置手动操作状态
        state.loadingActionsVisible = false;
        if (dom.viewResultsBtn) dom.viewResultsBtn.classList.add('hidden');
        const longWaitMsg = document.getElementById('long-wait-msg');
        if (longWaitMsg) {
            longWaitMsg.innerHTML = '<p class="text-blue-600 font-bold text-sm mb-1">解析报告正在生成中...</p><p class="text-gray-400 text-xs">您可以关闭本页，稍后在“解析记录”中查看，或者刷新当前页。</p>';
        }

        // Ensure overlay is available (re-query if necessary)
        if (!dom.loadingOverlay) {
            dom.loadingOverlay = document.getElementById('loading-overlay');
        }

        if (dom.loadingOverlay) {
            dom.loadingOverlay.classList.remove('hidden');

            // 2.5秒后显示跳转按钮
            if (state.loadingTimer) clearTimeout(state.loadingTimer);
            state.loadingTimer = setTimeout(() => {
                state.loadingActionsVisible = true;
                const longWaitMsg = document.getElementById('long-wait-msg');
                const loadingActions = document.getElementById('loading-actions');
                if (longWaitMsg) longWaitMsg.classList.remove('hidden');
                if (loadingActions) loadingActions.classList.remove('hidden');
            }, 2500);
        } else {
            console.error('[startAnalysis] Loading overlay element not found!');
        }

        // 更新进度提示 (Initial)
        const initialMsg = state.forceNextAnalysis ? '正在重新解析中...' : '正在准备分析环境...';
        updateLoadingProgress(initialMsg, 10);

        try {
            const target = state.selectedResumes[0] || state.uploadedFiles[0];
            console.info('[ResumeTools] Trigger analysis:', state.analysisMode, target ? (target.id || target.name || '') : '');

            // 核心修复：确保在单人模式下选中了候选人
            if (state.analysisMode === 'single' && !target) {
                throw new Error('请先选择一位候选人');
            }

            if (state.analysisMode === 'single') {
                await performSingleAnalysis(preservedDimensions, preservedScore);
            } else {
                await performMultiAnalysis();
            }

            // 成功后处理
            const longWaitMsgDone = document.getElementById('long-wait-msg');
            if (state.loadingActionsVisible && longWaitMsgDone) {
                longWaitMsgDone.innerHTML = '<p class="text-emerald-600 font-bold text-sm mb-1">分析已完成！</p><p class="text-gray-400 text-xs">正在为您展示解析结果...</p>';
                longWaitMsgDone.classList.remove('hidden');
            }

            setTimeout(() => {
                if (dom.loadingOverlay) dom.loadingOverlay.classList.add('hidden');
                state.loadingActionsVisible = false;
                if (dom.viewResultsBtn) dom.viewResultsBtn.classList.add('hidden');
                const longWaitMsg = document.getElementById('long-wait-msg');
                const loadingActions = document.getElementById('loading-actions');
                if (longWaitMsg) longWaitMsg.classList.add('hidden');
                if (loadingActions) loadingActions.classList.add('hidden');
                const targetId = state.analysisMode === 'single' ? 'single-analysis-results' : 'multi-analysis-results';
                document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 400);

        } catch (e) {
            console.error('Analysis failed:', e);
            // 遵循用户规则：UI上要有相应的 Loading 和 Error 状态反馈
            if (typeof ui !== 'undefined' && ui.showNotification) {
                ui.showNotification(e.message || '分析过程中出现错误，请检查网络或重试', 'error');
            }

            // 关键修复：当分析失败时，更新遮罩状态而不是让其卡住
            if (state.loadingActionsVisible && dom.loadingOverlay) {
                const longWaitMsg = document.getElementById('long-wait-msg');
                const loadingText = dom.loadingOverlay.querySelector('.loading-text');
                if (loadingText) loadingText.textContent = '分析失败';

                if (longWaitMsg) {
                    longWaitMsg.innerHTML = `<p class="text-rose-500 font-bold text-sm mb-1">分析失败</p><p class="text-gray-400 text-xs">${e.message || '请稍后重试'}</p>`;
                    longWaitMsg.classList.remove('hidden');
                }

                // 3秒后自动关闭遮罩
                setTimeout(() => {
                    dom.loadingOverlay.classList.add('hidden');
                }, 3000);
            }
        } finally {
            state.isAnalyzing = false;
            state.forceNextAnalysis = false; // 重置强制重新解析标志

            // 清理定时器
            if (state.loadingTimer) {
                clearTimeout(state.loadingTimer);
                state.loadingTimer = null;
            }

            // 只有在未显示手动操作区域时才自动关闭遮罩
            if (!state.loadingActionsVisible) {
                const longWaitMsg = document.getElementById('long-wait-msg');
                const loadingActions = document.getElementById('loading-actions');
                if (longWaitMsg) longWaitMsg.classList.add('hidden');
                if (loadingActions) loadingActions.classList.add('hidden');
                dom.loadingOverlay.classList.add('hidden');
            }

            updateAnalyzeBtn();
        }
    }

    function updateLoadingProgress(message, progress) {
        if (!dom.loadingOverlay) {
            dom.loadingOverlay = document.getElementById('loading-overlay');
        }
        if (!dom.loadingOverlay) return;

        const loadingText = dom.loadingOverlay.querySelector('.loading-text');
        const progressBar = dom.loadingOverlay.querySelector('.progress-bar-inner');
        const longWaitMsg = document.getElementById('long-wait-msg');
        const loadingActions = document.getElementById('loading-actions');

        if (loadingText) loadingText.textContent = message;
        if (progressBar) progressBar.style.width = `${progress}%`;
    }

    async function performSingleAnalysis(preservedDimensions = null, preservedScore = null) {
        const target = state.selectedResumes[0] || state.uploadedFiles[0];
        const isForce = state.forceNextAnalysis;

        // 1. 如果是已有的库内简历，直接跳转到详情页触发解析
        if (target.id) {
            updateLoadingProgress('正在跳转到详情页...', 90);
            setTimeout(() => {
                let url = `analysis-detail.html?resume_id=${encodeURIComponent(String(target.id))}&trigger=true`;
                if (isForce) url += '&force=true';
                window.location.href = url;
            }, 500);
            return;
        }

        // 2. 如果是上传的新文件，先上传获取 ID，再跳转
        updateLoadingProgress('正在上传文件...', 30);
        try {
            const formData = new FormData();
            formData.append('file', target);

            // 获取选中的职位信息
            const selectedJob = state.jobs.find(j => j.id == state.selectedJobId);
            if (selectedJob) {
                formData.append('targetJob', JSON.stringify({
                    id: selectedJob.id,
                    title: selectedJob.title,
                    description: selectedJob.description
                }));
            }

            const uploadResult = await window.resumeDataManager.apiRequest('/ai/upload', 'POST', formData, false);
            if (uploadResult && uploadResult.success && uploadResult.data && uploadResult.data.resumeId) {
                updateLoadingProgress('上传成功，正在跳转...', 90);
                setTimeout(() => {
                    window.location.href = `analysis-detail.html?resume_id=${encodeURIComponent(String(uploadResult.data.resumeId))}&trigger=true`;
                }, 500);
            } else {
                throw new Error(uploadResult.error || '文件上传失败');
            }
        } catch (error) {
            console.error('Upload failed:', error);
            throw error;
        }
    }

    async function performMultiAnalysis() {
        // Prepare IDs and names for existing resumes and files for upload
        const resumesInfo = state.selectedResumes.map(r => ({ id: r.id, name: r.name }));

        // Find the selected job object if any
        const selectedJob = state.jobs.find(j => j.id == state.selectedJobId) || null;

        // For uploaded files, we need to upload them first to get IDs
        if (state.uploadedFiles.length > 0) {
            let fileIdx = 0;
            for (const file of state.uploadedFiles) {
                fileIdx++;
                updateLoadingProgress(`正在上传第 ${fileIdx}/${state.uploadedFiles.length} 份简历...`, 10 + (fileIdx / state.uploadedFiles.length * 20));

                try {
                    const formData = new FormData();
                    formData.append('file', file);

                    // 核心优化：传递目标职位上下文，触发后端自动快评
                    if (selectedJob) {
                        formData.append('targetJob', JSON.stringify(selectedJob));
                    }

                    // Use resumeDataManager.apiRequest for better error handling and token management
                    const uploadRes = await window.resumeDataManager.apiRequest('/ai/upload', 'POST', formData, true, true);

                    if (uploadRes.success && uploadRes.data && uploadRes.data.resumeId) {
                        resumesInfo.push({
                            id: uploadRes.data.resumeId,
                            name: file.name.replace(/\.[^/.]+$/, "") // Remove extension
                        });
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

        if (resumeIds.length < 2) {
            throw new Error('请至少选择或上传 2 份简历进行对比');
        }

        updateLoadingProgress('正在进行多份简历横向对比分析...', 40);

        // Pass a dummy progress callback to show it's working
        const result = await window.aiAnalyzer.compareResumes(resumeIds, selectedJob, (p) => {
            updateLoadingProgress(p.message || '正在对比分析...', 40 + (p.progress * 0.5));
        });

        updateLoadingProgress('对比分析完成，正在渲染报告...', 100);
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
     * @property {number} dimensions.project - 项目履历匹配
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

        let resultData = data;
        if (resultData && typeof resultData === 'object' && resultData.data && typeof resultData.data === 'object') {
            resultData = resultData.data;
        }
        if (resultData && typeof resultData === 'object' && resultData.analysis) {
            const analysisObj = (resultData.analysis && typeof resultData.analysis === 'object') ? resultData.analysis : {};
            const merged = { ...analysisObj };
            if (resultData.overall_score !== undefined) merged.overall_score = resultData.overall_score;
            if (resultData.total_score !== undefined) merged.total_score = resultData.total_score;
            if (resultData.score !== undefined) merged.score = resultData.score;
            if (resultData.dimensions !== undefined) merged.dimensions = resultData.dimensions;
            if (resultData.scores_percent !== undefined) merged.scores_percent = resultData.scores_percent;
            if (resultData.radar_scores !== undefined) merged.radar_scores = resultData.radar_scores;
            if (resultData.evaluation_report !== undefined) merged.evaluation_report = resultData.evaluation_report;
            if (resultData.analysis_report !== undefined) merged.analysis_report = resultData.analysis_report;
            if (resultData.report !== undefined) merged.report = resultData.report;
            if (resultData.detailed_analysis !== undefined) merged.detailed_analysis = resultData.detailed_analysis;
            if (resultData.details !== undefined) merged.details = resultData.details;
            if (resultData.summary !== undefined) merged.summary = resultData.summary;
            if (resultData.strengths !== undefined) merged.strengths = resultData.strengths;
            if (resultData.weaknesses !== undefined) merged.weaknesses = resultData.weaknesses;
            if (resultData.suggestions !== undefined) merged.suggestions = resultData.suggestions;
            resultData = merged;
        } else if (resultData && typeof resultData === 'object' && (resultData.result || resultData.analysis)) {
            resultData = resultData.result || resultData.analysis;
        }

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
        let normalizedRawScores = rawScores;
        if (typeof normalizedRawScores === 'string') {
            try {
                normalizedRawScores = JSON.parse(normalizedRawScores);
            } catch (_) {
                normalizedRawScores = {};
            }
        }

        const getVal = (keys) => {
            for (const key of keys) {
                if (normalizedRawScores[key] !== undefined) {
                    const val = typeof normalizedRawScores[key] === 'object' ? parseInt(normalizedRawScores[key].score || normalizedRawScores[key].value || 0) : parseInt(normalizedRawScores[key]);
                    if (!isNaN(val)) return val;
                }
            }
            return 0;
        };

        const dimensions = {
            skills: getVal(['skills', 'skill_match', 'professional', '专业技能', '技能评分', '技能匹配']),
            experience: getVal(['experience', 'experience_match', 'background', '工作经验', '经验契合', '经验评分']),
            education: getVal(['education', 'education_background', 'academic', '学历背景', '教育背景', '学历评分']),
            project: getVal(['project', 'project_match', 'project_fit', 'project_experience', '项目履历匹配', '项目经验', '履历匹配']),
            potential: getVal(['potential', 'growth_potential', 'development', '发展潜力', '潜力评分', '成长性']),
            teamwork: getVal(['teamwork', 'collaboration', 'social', '团队协作', '协作能力', '团队精神'])
        };

        // 4. AI 报告归一化
        let details = resultData.detailed_analysis || resultData.details || {};
        if (typeof details === 'string') {
            try { details = JSON.parse(details); } catch (_) { details = {}; }
        }
        const report =
            resultData.evaluation_report ||
            resultData.analysis_report ||
            resultData.report ||
            details.evaluation_report ||
            details.analysis_report ||
            details.report ||
            resultData.evaluation ||
            resultData.feedback ||
            resultData.advice ||
            '暂无详细报告内容';

        // 5. 亮点与风险提取 (Extra highlights and risks)
        const highlights =
            resultData.highlights ||
            resultData.strengths ||
            (resultData.evaluation_report && resultData.evaluation_report.strengths) ||
            (details.evaluation_report && details.evaluation_report.strengths) ||
            details.strengths ||
            [];
        const risks =
            resultData.risks ||
            resultData.weaknesses ||
            (resultData.evaluation_report && resultData.evaluation_report.weaknesses) ||
            (details.evaluation_report && details.evaluation_report.weaknesses) ||
            details.weaknesses ||
            [];

        return {
            basicInfo,
            overallScore,
            dimensions,
            report,
            highlights: Array.isArray(highlights) ? highlights : [],
            risks: Array.isArray(risks) ? risks : [],
            raw: resultData // 保留原始数据以备不时之需
        };
    }

    function renderSingleResults(rawData) {
        try {
            const data = normalizeResult(rawData);
            if (!data) return;

            // 关键修复：增加最终数据完整性校验，如果总分和维度分均为0，说明数据尚未就绪
            const hasDimensions = Object.values(data.dimensions).some(v => v > 0);
            if (data.overallScore === 0 && !hasDimensions && (!data.report || data.report === '暂无详细报告内容')) {
                console.warn('[Render] Data seems empty, skipping render to avoid blank page.');
                if (typeof ui !== 'undefined' && ui.showNotification) {
                    ui.showNotification('分析结果尚未完全准备好，请稍等或刷新页面', 'warning');
                }
                return;
            }

            dom.emptyState.classList.add('hidden');
            dom.multiResults.classList.add('hidden');
            dom.singleResults.classList.remove('hidden');

            // 1. 基础信息 (Basic Info)
            if (dom.resName) dom.resName.textContent = data.basicInfo.name;
            if (dom.resInfo) {
                dom.resInfo.textContent = `${data.basicInfo.experience}经验 | ${data.basicInfo.education} | ${data.basicInfo.salary}`;
            }

            // 2. 核心得分 (Overall Score)
            if (dom.resScore) {
                animateNumber(dom.resScore, 0, data.overallScore, 1000);

                // Remove existing badge if any
                const existingBadge = dom.resScore.parentNode.querySelector('.estimate-badge');
                if (existingBadge) existingBadge.remove();

                // Add estimated badge if needed
                const isEstimated = (data.raw && (data.raw.is_estimate || data.raw.status === 'estimating')) || data.isEstimated;
                if (isEstimated) {
                    const badge = document.createElement('span');
                    badge.className = 'estimate-badge ml-2 text-xs text-gray-400 font-normal bg-gray-100 px-1.5 py-0.5 rounded align-middle';
                    badge.textContent = '(预估)';
                    dom.resScore.parentNode.appendChild(badge);
                }
            }

            // 3. 雷达图维度 (Radar Chart)
            renderRadarChart(data.dimensions);

            // 4. 维度卡片 (Score Cards)
            renderScoreCards(data.dimensions);

            // 5. AI 报告内容 (AI Report)
            renderAIReport(data.report);

            // 6. 亮点与风险 (Highlights & Risks)
            if (dom.highlightsRisksContainer) {
                if (data.highlights.length > 0 || data.risks.length > 0) {
                    dom.highlightsRisksContainer.classList.remove('hidden');

                    if (dom.resHighlights) {
                        dom.resHighlights.innerHTML = data.highlights.length > 0
                            ? data.highlights.map(h => `<li class="flex items-start text-sm text-gray-700 leading-relaxed"><i class="fas fa-check-circle text-emerald-500 mt-1 mr-2 text-[10px]"></i>${h}</li>`).join('')
                            : '<li class="text-xs text-gray-400 italic">暂无亮点</li>';
                    }

                    if (dom.resRisks) {
                        dom.resRisks.innerHTML = data.risks.length > 0
                            ? data.risks.map(r => `<li class="flex items-start text-sm text-gray-700 leading-relaxed"><i class="fas fa-exclamation-circle text-rose-500 mt-1 mr-2 text-[10px]"></i>${r}</li>`).join('')
                            : '<li class="text-xs text-gray-400 italic">暂无风险</li>';
                    }
                } else {
                    dom.highlightsRisksContainer.classList.add('hidden');
                }
            }
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

        const labels = ['专业技能', '经验契合', '项目履历', '学历背景', '发展潜力', '团队协作'];
        const values = [
            scores.skills || 0,
            scores.experience || 0,
            scores.project || 0,
            scores.education || 0,
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
            { key: 'project', label: '项目履历匹配', icon: 'fa-project-diagram', bgColor: 'bg-blue-50', textColor: 'text-blue-600' },
            { key: 'education', label: '学历背景', icon: 'fa-graduation-cap', bgColor: 'bg-blue-50', textColor: 'text-blue-600' },
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

        const keyMap = {
            'summary': '能力总结',
            'strengths': '核心优势',
            'weaknesses': '不足之处',
            'suggestions': '改进建议',
            'hiring_advice': '录用建议',
            'parsed_data': '解析详情',
            'basic_info': '基础信息',
            'skills': '技能评估',
            'experience': '经验分析',
            'education': '教育背景',
            'evaluation_report': '深度评估报告',
            'highlights': '核心亮点',
            'risks': '风险提示'
        };

        if (typeof report === 'string') {
            // 核心修复：如果检测到对比解析的内容出现在单人详情中，拦截并提示
            if (report.includes('对比分析报告') || report.includes('候选人对比') || report.includes('两位候选人')) {
                console.warn('[Security] Detected multi-analysis report content in single view');
                dom.aiReport.innerHTML = `
                    <div class="p-8 bg-blue-50 rounded-2xl border border-blue-100 text-center">
                        <i class="fas fa-exclamation-triangle text-blue-500 text-3xl mb-4"></i>
                        <h4 class="text-blue-900 font-bold mb-2">报告类型不匹配</h4>
                        <p class="text-blue-700 text-sm mb-6">当前展示的是对比分析报告，建议重新生成针对该候选人的深度解析报告以获得更精准的评估。</p>
                        <button id="re-analyze-btn" class="px-6 py-2 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600 transition-colors">
                            立即重新分析
                        </button>
                    </div>
                `;
                const reBtn = document.getElementById('re-analyze-btn');
                if (reBtn) reBtn.onclick = () => startAnalysis();
                return;
            }

            // Convert simple markdown-like content to HTML with enhanced styling
            dom.aiReport.innerHTML = report.split('\n').map(line => {
                let content = line.trim();
                if (!content) return '';

                // 处理可能出现的 [object Object] 异常
                if (content.includes('[object Object]')) return '';

                if (content.startsWith('###')) {
                    const rawText = content.replace(/^###\s*/, '').trim();
                    const title = keyMap[rawText.toLowerCase()] || rawText;
                    return `<h4 class="text-lg font-bold text-gray-900 mt-8 mb-4 flex items-center tracking-tight">
                                <span class="w-1.5 h-5 bg-blue-600 rounded-full mr-3"></span>${title}
                            </h4>`;
                }
                if (content.startsWith('##')) {
                    const rawText = content.replace(/^##\s*/, '').trim();
                    const title = keyMap[rawText.toLowerCase()] || rawText;
                    return `<h3 class="text-xl font-extrabold text-gray-900 mt-10 mb-5 tracking-tight">${title}</h3>`;
                }
                if (content.startsWith('# ')) {
                    const rawText = content.replace(/^#\s*/, '').trim();
                    const title = keyMap[rawText.toLowerCase()] || rawText;
                    return `<h2 class="text-2xl font-black text-gray-900 mt-12 mb-6 tracking-tighter border-b pb-2">${title}</h2>`;
                }
                if (content.startsWith('- ') || content.startsWith('* ')) {
                    const text = content.replace(/^[-*]\s*/, '').trim();
                    return `<div class="flex items-start mb-3 pl-1">
                                <i class="fas fa-circle text-[6px] text-blue-500 mt-2.5 mr-3 flex-shrink-0"></i>
                                <span class="text-gray-600 leading-relaxed">${text}</span>
                            </div>`;
                }

                // 加粗处理 **text**
                const formattedContent = content.replace(/\*\*(.*?)\*\*/g, '<strong class="text-gray-900 font-bold">$1</strong>');
                return `<p class="text-gray-600 leading-relaxed mb-4 pl-1">${formattedContent}</p>`;
            }).join('');
        } else if (typeof report === 'object' && report !== null) {
            // If report is structured object, use the enhanced object rendering logic
            let html = '';

            // Handle summary separately if exists for prominence
            const summary = report.summary || report.evaluation || '';
            if (summary) {
                html += `
                    <div class="mb-10 p-6 bg-blue-50/50 rounded-2xl border border-blue-100 shadow-sm relative overflow-hidden group">
                        <div class="absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 bg-blue-600/5 rounded-full transition-transform group-hover:scale-110"></div>
                        <div class="flex items-center space-x-3 mb-4">
                            <div class="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md">
                                <i class="fas fa-robot text-sm"></i>
                            </div>
                            <div>
                                <h5 class="text-base font-bold text-gray-900">AI 综合评价</h5>
                                <p class="text-[10px] text-blue-600 font-bold uppercase tracking-widest">Executive Summary</p>
                            </div>
                        </div>
                        <div class="text-sm text-gray-700 leading-relaxed whitespace-pre-line relative z-10">${typeof summary === 'string' ? summary : JSON.stringify(summary)}</div>
                    </div>
                `;
            }

            for (const [key, value] of Object.entries(report)) {
                if (key === 'basic_info' || key === 'parsed_data' || key === 'summary' || key === 'evaluation') continue;

                const title = keyMap[key] || key;

                // 针对“录用建议”进行特殊样式优化
                if (key === 'hiring_advice') {
                    let grade = '';
                    let cnLevel = '';
                    let advice = '';

                    let adviceObj = value;
                    if (typeof value === 'string' && value.trim().startsWith('{')) {
                        try { adviceObj = JSON.parse(value); } catch (e) { }
                    }

                    if (typeof adviceObj === 'object' && adviceObj !== null) {
                        grade = adviceObj.grade || '';
                        cnLevel = adviceObj.comment || '';
                        const reason = adviceObj.reason || '';
                        advice = reason || '';
                    } else {
                        advice = typeof value === 'string' ? value : JSON.stringify(value);
                        // 尝试匹配等级（支持 A, B+, B, C, 推荐, 建议录用 等）
                        const gradeMatch = advice.match(/^([A-DS][+-]?|推荐|强烈推荐|建议录用|不予考虑|慎重考虑)[:：\s]?(.*)/i);
                        if (gradeMatch) {
                            grade = gradeMatch[1];
                            advice = gradeMatch[2];
                        }
                    }

                    html += `
                        <div class="mb-10 last:mb-0">
                            <h4 class="text-lg font-bold text-gray-900 mb-4 flex items-center tracking-tight">
                                <span class="w-1.5 h-5 bg-emerald-600 rounded-full mr-3"></span>${title}
                            </h4>
                            <div class="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                                <div class="flex flex-col md:flex-row md:items-start gap-6">
                                    ${grade ? `
                                    <div class="flex-shrink-0 flex flex-col items-center justify-center min-w-[120px] px-4 py-6 bg-gray-900 rounded-2xl shadow-lg">
                                        <span class="text-[10px] text-gray-400 font-bold uppercase mb-2 tracking-widest">推荐等级</span>
                                        <span class="text-5xl font-black text-white leading-none">${grade}</span>
                                        ${cnLevel ? `<span class="text-[11px] font-bold text-emerald-400 mt-3 text-center leading-tight px-1">${cnLevel}</span>` : ''}
                                    </div>
                                    ` : ''}
                                    <div class="flex-1">
                                        <div class="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-2 flex items-center">
                                            <i class="fas fa-comment-dots mr-2"></i>核心录用理由
                                        </div>
                                        <div class="text-gray-700 leading-relaxed text-sm md:text-base whitespace-pre-line">
                                            ${advice}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>`;
                } else {
                    html += `
                        <div class="mb-8 last:mb-0">
                            <h4 class="text-lg font-bold text-gray-900 mb-4 flex items-center tracking-tight">
                                <span class="w-1.5 h-5 bg-blue-600 rounded-full mr-3"></span>${title}
                            </h4>
                            <div class="text-gray-600 leading-relaxed pl-4 ml-1">
                                ${Array.isArray(value)
                            ? `<div class="space-y-3">
                                        ${value.map(item => `
                                            <div class="flex items-start">
                                                <i class="fas fa-check-circle text-blue-500 mt-1.5 mr-3 text-xs flex-shrink-0"></i>
                                                <span class="text-gray-600">${item}</span>
                                            </div>`).join('')}
                                           </div>`
                            : (typeof value === 'string' ? `<p class="whitespace-pre-line">${value}</p>` : `<pre class="text-xs bg-gray-50 p-3 rounded-lg overflow-x-auto">${JSON.stringify(value, null, 2)}</pre>`)
                        }
                            </div>
                        </div>`;
                }
            }
            dom.aiReport.innerHTML = html || '<p class="text-gray-400 italic">暂无报告内容</p>';
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

        const labels = ['专业技能', '经验契合', '项目履历', '学历背景', '发展潜力', '团队协作'];
        const datasets = people.map((p, i) => ({
            label: p.name,
            data: [
                p.scores_percent.skills || 0,
                p.scores_percent.experience || 0,
                p.scores_percent.project || p.scores_percent.stability || 0,
                p.scores_percent.education || 0,
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
            dom.emptyState.classList.add('hidden');
            dom.singleResults.classList.add('hidden');
            dom.multiResults.classList.remove('hidden');

            // 提取数据
            let resultData = data.data || data.comparison || data.result || data;

            // 如果数据是字符串，尝试解析 (针对可能的解析残留)
            if (typeof resultData === 'string') {
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
                    <i class="fas fa-exclamation-triangle text-blue-500 text-4xl mb-4"></i>
                    <div class="text-gray-500 font-medium">未获取到有效的对比数据</div>
                    <div class="text-gray-400 text-xs mt-2">数据类型: ${typeof resultData}</div>
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
                { key: 'project', label: '项目履历' },
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

            const gridColsClass = (people.length === 1)
                ? 'grid-cols-1 md:grid-cols-1 lg:grid-cols-1'
                : (people.length === 2)
                    ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-2'
                    : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';

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
                                             ${window.ui ? window.ui.renderAvatar(p.avatar, p.name, 'w-8 h-8', 'rounded-lg', true) : `
                                                 <div class="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                                                     <i class="fas fa-user text-xs"></i>
                                                 </div>
                                             `}
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
                                                    ${window.ui ? window.ui.renderAvatar(p.avatar, p.name, 'w-5 h-5 shrink-0', 'rounded-lg', true) : `
                                                        <div class="w-6 h-6 shrink-0 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                                                            <i class="fas fa-user text-[10px]"></i>
                                                        </div>
                                                    `}
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
                            <div class="flex items-center gap-2">
                                <button id="exportMdBtn" class="px-3 py-1.5 text-xs font-bold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200">
                                    <i class="fas fa-file-code mr-1"></i>导出MD
                                </button>
                                <button id="exportPdfBtn" class="px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700">
                                    <i class="fas fa-file-pdf mr-1"></i>导出PDF
                                </button>
                            </div>
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
                                            <i class="fas fa-exclamation-triangle text-rose-500 mt-0.5"></i>
                                            <p class="text-xs text-gray-600"><span class="font-bold text-rose-600">风险提示：</span>${recommendation.hiring_risk}</p>
                                        </div>
                                    ` : ''}
                                </div>
                            ` : ''}

                            <div class="grid ${gridColsClass} gap-6">
                                ${people.map((p, i) => `
                                    <div class="bg-gray-50/50 p-6 rounded-2xl border border-gray-100 hover:shadow-md transition-all">
                                        <div class="flex items-center justify-between mb-4">
                                            <div class="flex items-center space-x-3">
                                                ${window.ui ? window.ui.renderAvatar(p.avatar, p.name, 'w-10 h-10', 'rounded-lg', true) : `
                                                    <div class="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                                                        <i class="fas fa-user text-sm"></i>
                                                    </div>
                                                `}
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
            try {
                const exportMdBtn = document.getElementById('exportMdBtn');
                const exportPdfBtn = document.getElementById('exportPdfBtn');
                const buildMarkdown = () => {
                    const lines = [];
                    lines.push(`# 简历多人对比分析报告`);
                    lines.push('');
                    if (recommendation && recommendation.reason) {
                        lines.push(`> 推荐人选：${winnerName}`);
                        lines.push('');
                        lines.push(`> 理由：${recommendation.reason}`);
                        if (recommendation.hiring_risk) {
                            lines.push(`> 风险提示：${recommendation.hiring_risk}`);
                        }
                        lines.push('');
                    }
                    lines.push(`## 候选人概览`);
                    people.forEach(p => {
                        lines.push(`- ${p.name}：综合得分 ${p.total_score}`);
                    });
                    lines.push('');
                    lines.push(`## 核心维度对照表`);
                    const dimLabels = ['skills', 'experience', 'project', 'education', 'potential', 'teamwork'];
                    const dimTitle = ['专业技能', '经验契合', '项目履历', '学历背景', '潜力', '团队协作'];
                    lines.push(`| 候选人 | ${dimTitle.join(' | ')} | 综合得分 |`);
                    lines.push(`| - | - | - | - | - | - | - |`);
                    people.forEach(p => {
                        const row = [
                            p.name,
                            ...dimLabels.map(k => (p.scores_percent && p.scores_percent[k] != null) ? String(p.scores_percent[k]) : '0'),
                            String(p.total_score)
                        ];
                        lines.push(`| ${row.join(' | ')} |`);
                    });
                    lines.push('');
                    lines.push(`## AI 综合评价`);
                    people.forEach(p => {
                        lines.push(`### ${p.name}`);
                        lines.push((p.summary && String(p.summary).trim()) ? String(p.summary).trim() : '暂无评价');
                        lines.push('');
                    });
                    return lines.join('\n');
                };
                exportMdBtn?.addEventListener('click', () => {
                    const md = buildMarkdown();
                    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    const dateStr = new Date().toISOString().slice(0, 10);
                    a.download = `对比分析_${dateStr}.md`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                });
                exportPdfBtn?.addEventListener('click', (e) => {
                    const dateStr = new Date().toISOString().slice(0, 10);
                    exportToPdf('multi-analysis-results', `多人对比分析报告_${dateStr}.pdf`, e.currentTarget);
                });
            } catch (err) {
                console.warn('Export handlers init failed:', err);
            }
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

    function buildMarkdown() {
        const record = state.analysisResult;
        if (!record) return '';

        const data = normalizeResult(record);
        const lines = [];
        const nameText = data.basicInfo.name || '候选人';

        lines.push(`# ${nameText} 的简历解析报告`);
        lines.push('');
        lines.push(`## 综合得分`);
        lines.push(`${data.overallScore} / 100`);
        lines.push('');
        lines.push(`## 核心维度`);

        const dimLabels = {
            skills: '专业技能',
            experience: '经验契合',
            project: '项目履历',
            education: '学历背景',
            potential: '潜力',
            teamwork: '团队协作'
        };

        Object.keys(dimLabels).forEach(key => {
            lines.push(`- ${dimLabels[key]}：${data.dimensions[key] || 0}`);
        });

        lines.push('');
        lines.push(`## AI 深度分析报告`);
        lines.push(data.report || '暂无详细报告');
        lines.push('');

        if (data.highlights && data.highlights.length > 0) {
            lines.push(`### 核心优势`);
            data.highlights.forEach(h => lines.push(`- ${h}`));
            lines.push('');
        }

        if (data.risks && data.risks.length > 0) {
            lines.push(`### 不足之处`);
            data.risks.forEach(r => lines.push(`- ${r}`));
            lines.push('');
        }

        return lines.join('\n');
    }

    async function exportToPdf(elementId, filename, btn) {
        const target = document.getElementById(elementId);
        if (!target) return;

        const originalHtml = btn ? btn.innerHTML : '';

        try {
            if (btn && btn.tagName === 'BUTTON') {
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1.5"></i>正在生成...';
            }

            // Temporarily hide elements that shouldn't be in PDF
            const buttonsToHide = target.querySelectorAll('button');
            const originalDisplays = Array.from(buttonsToHide).map(b => b.style.display);
            buttonsToHide.forEach(b => b.style.display = 'none');

            // Set fixed width for better canvas capture
            const originalWidth = target.style.width;
            target.style.width = '1200px'; // Consistent width for PDF

            const canvas = await html2canvas(target, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                width: 1200
            });

            // Restore elements
            target.style.width = originalWidth;
            buttonsToHide.forEach((b, i) => b.style.display = originalDisplays[i]);

            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            const jspdfNS = window.jspdf || {};
            const JsPDFCtor = jspdfNS.jsPDF || window.jsPDF;

            if (!JsPDFCtor) {
                window.print();
                return;
            }

            const pdf = new JsPDFCtor('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            let heightLeft = pdfHeight;
            let position = 0;
            const pageHeight = pdf.internal.pageSize.getHeight();

            pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
            heightLeft -= pageHeight;

            while (heightLeft >= 0) {
                position = heightLeft - pdfHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
                heightLeft -= pageHeight;
            }

            pdf.save(filename);
        } catch (err) {
            console.error('PDF Export Error:', err);
            alert('导出失败，请重试或尝试直接打印页面');
        } finally {
            if (btn && btn.tagName === 'BUTTON') {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
        }
    }

    // --- Helpers ---

    function isMultiReportString(report) {
        return typeof report === 'string' && (
            report.includes('对比分析报告') ||
            report.includes('候选人对比') ||
            report.includes('两位候选人')
        );
    }

    function isEmptyReport(report) {
        if (!report) return true;
        if (typeof report === 'string') {
            const s = report.trim();
            if (!s) return true;
            if (s === '暂无报告' || s === '暂无详细报告内容') return true;
            return false;
        }
        if (typeof report === 'object') {
            return Object.keys(report).length === 0;
        }
        return true;
    }

    function isDeepAnalysisCompleteFromResultData(resultData) {
        if (!resultData) return false;
        const report = resultData.report ?? resultData.detailed_analysis ?? resultData.details ?? resultData.evaluation_report ?? resultData.analysis_report ?? null;
        if (isMultiReportString(report)) return false;
        return !isEmptyReport(report);
    }

    async function fetchDeepAnalysisCompleteness(resumeId) {
        const id = String(resumeId);
        if (deepAnalysisCompletenessCache.has(id)) return deepAnalysisCompletenessCache.get(id) === true;
        if (deepAnalysisCompletenessInFlight.has(id)) return false;
        deepAnalysisCompletenessInFlight.add(id);
        try {
            const result = await window.resumeDataManager.apiRequest(`/ai/result/${encodeURIComponent(id)}`, 'GET', null, false, true);
            const isComplete = isDeepAnalysisCompleteFromResultData(result ? result.data : null);
            deepAnalysisCompletenessCache.set(id, isComplete);
            return isComplete;
        } catch (e) {
            deepAnalysisCompletenessCache.set(id, false);
            return false;
        } finally {
            deepAnalysisCompletenessInFlight.delete(id);
        }
    }

    async function prefetchDeepAnalysisCompleteness(resumeIds) {
        if (!window.resumeDataManager || typeof window.resumeDataManager.apiRequest !== 'function') return;
        const pending = (resumeIds || []).filter(id => id && !deepAnalysisCompletenessCache.has(String(id)) && !deepAnalysisCompletenessInFlight.has(String(id)));
        if (pending.length === 0) return;

        const concurrency = 4;
        let cursor = 0;
        const workers = Array.from({ length: Math.min(concurrency, pending.length) }, async () => {
            while (cursor < pending.length) {
                const id = pending[cursor];
                cursor += 1;
                await fetchDeepAnalysisCompleteness(id);
            }
        });

        await Promise.all(workers);
        if (state.analysisMode === 'single' && state.activeSidebarTab === 'library') {
            renderCandidateList();
        }
    }

    function debounce(func, wait) {
        let timeout;
        return function () {
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
