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
            state.talentPool = await window.resumeDataManager.getTalentPoolResumes();
        } catch (e) {
            console.error('Failed to load talent pool:', e);
            state.talentPool = [];
        }
    }

    async function loadJobs() {
        if (!window.resumeDataManager) return;
        try {
            const result = await window.resumeDataManager.apiRequest('/jobs');
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
                    <div class="checkbox-custom ${isSelected ? 'checked' : ''} shadow-sm">
                        ${isSelected ? '<i class="fas fa-check text-[10px] text-white"></i>' : ''}
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
        
        try {
            if (state.analysisMode === 'single') {
                await performSingleAnalysis();
            } else {
                await performMultiAnalysis();
            }
        } catch (e) {
            console.error('Analysis failed:', e);
            ui.showNotification(e.message || '分析过程中出现错误', 'error');
        } finally {
            state.isAnalyzing = false;
            dom.loadingOverlay.classList.add('hidden');
            updateAnalyzeBtn();
        }
    }

    async function performSingleAnalysis() {
        let result;
        const target = state.selectedResumes[0] || state.uploadedFiles[0];
        
        // Find the selected job object if any
        const selectedJob = state.jobs.find(j => j.id == state.selectedJobId) || null;
        
        if (state.selectedResumes.length > 0) {
            // Analyze existing resume
            result = await window.aiAnalyzer.analyzeExistingResume(target.id, selectedJob);
        } else {
            // Analyze uploaded file
            result = await window.aiAnalyzer.analyzeFile(target, selectedJob);
        }
        
        state.analysisResult = result;
        renderSingleResults(result);
    }

    async function performMultiAnalysis() {
        // Prepare IDs for existing resumes and files for upload
        const resumeIds = state.selectedResumes.map(r => r.id);
        
        // Find the selected job object if any
        const selectedJob = state.jobs.find(j => j.id == state.selectedJobId) || null;
        
        // For uploaded files, we need to upload them first to get IDs
        if (state.uploadedFiles.length > 0) {
            for (const file of state.uploadedFiles) {
                try {
                    const formData = new FormData();
                    formData.append('file', file);
                    
                    // Use the same upload endpoint as AI analyzer
                    const response = await fetch(`${window.resumeDataManager.apiBaseUrl}/ai/upload`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${window.resumeDataManager.token}`
                        },
                        body: formData
                    });
                    
                    const uploadRes = await response.json();
                    if (uploadRes.success && uploadRes.data && uploadRes.data.resumeId) {
                        resumeIds.push(uploadRes.data.resumeId);
                    } else {
                        throw new Error(`文件 ${file.name} 上传失败`);
                    }
                } catch (err) {
                    console.error('File upload failed:', err);
                    throw new Error(`文件 ${file.name} 上传失败: ${err.message}`);
                }
            }
        }
        
        if (resumeIds.length < 2) {
            throw new Error('请至少选择或上传 2 份简历进行对比');
        }
        
        const result = await window.aiAnalyzer.compareResumes(resumeIds, selectedJob);
        state.comparisonResult = result;
        renderMultiResults(result, state.selectedResumes);
    }

    // --- Rendering Results ---

    function renderSingleResults(data) {
        dom.emptyState.classList.add('hidden');
        dom.multiResults.classList.add('hidden');
        dom.singleResults.classList.remove('hidden');
        
        // Basic Info
        const info = data.basic_info || data.parsedData?.personalInfo || {};
        dom.resName.textContent = info.name || '候选人';
        dom.resInfo.textContent = `${info.experience || '多年'}经验 | ${info.education || '本科'} | ${info.expected_salary || '面议'}`;
        
        // Score
        const score = data.total_score || data.score || 0;
        animateNumber(dom.resScore, 0, score, 1000);
        
        // Radar Chart
        renderRadarChart(data.scores_percent || {});
        
        // Score Cards
        renderScoreCards(data.scores_star || {});
        
        // AI Report
        renderAIReport(data.analysis_report || data.report || '暂无详细报告内容');
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
            scores.skills || 85,
            scores.experience || 80,
            scores.education || 90,
            scores.stability || 75,
            scores.potential || 85,
            scores.teamwork || 80
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

    function renderScoreCards(stars) {
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
            const starCount = stars[dim.key] || 4;
            const item = document.createElement('div');
            item.className = 'flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0 group transition-all';
            item.innerHTML = `
                <div class="flex items-center space-x-3">
                    <div class="w-8 h-8 rounded-lg bg-blue-50/50 text-blue-500 flex items-center justify-center text-xs group-hover:bg-blue-100/50 transition-colors">
                        <i class="fas ${dim.icon}"></i>
                    </div>
                    <div>
                        <div class="text-sm font-semibold text-gray-700 group-hover:text-blue-600 transition-colors">${dim.label}</div>
                        <div class="flex text-blue-400 text-[9px] mt-0.5 space-x-0.5">
                            ${Array(5).fill(0).map((_, i) => `<i class="${i < starCount ? 'fas' : 'far'} fa-star"></i>`).join('')}
                        </div>
                    </div>
                </div>
                <div class="flex items-baseline space-x-1">
                    <span class="text-sm font-black text-blue-600">${starCount}.0</span>
                    <span class="text-[10px] text-gray-400 font-bold">/ 5.0</span>
                </div>
            `;
            dom.scoreCards.appendChild(item);
        });
    }

    function renderAIReport(report) {
        if (typeof report === 'string') {
            // Convert simple markdown-like content to HTML
            const html = report
                .replace(/### (.*)/g, '<h4 class="text-lg font-bold text-gray-900 mt-6 mb-3">$1</h4>')
                .replace(/## (.*)/g, '<h3 class="text-xl font-bold text-gray-900 mt-8 mb-4">$1</h3>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\n/g, '<br>');
            dom.aiReport.innerHTML = html;
        } else if (typeof report === 'object') {
            // If report is structured object
            let html = '';
            if (report.summary) {
                html += `<div class="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 mb-8">
                    <h4 class="text-blue-900 font-bold mb-2 flex items-center">
                        <i class="fas fa-quote-left mr-2 text-blue-400"></i>
                        综合评价
                    </h4>
                    <p class="text-blue-800 leading-relaxed">${report.summary}</p>
                </div>`;
            }
            
            if (report.strengths) {
                html += `<div class="mb-8">
                    <h4 class="text-gray-900 font-bold mb-4 flex items-center">
                        <i class="fas fa-check-circle mr-2 text-green-500"></i>
                        核心优势
                    </h4>
                    <ul class="space-y-3">
                        ${report.strengths.map(s => `<li class="flex items-start text-sm">
                            <span class="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 mr-3 flex-shrink-0"></span>
                            <span>${s}</span>
                        </li>`).join('')}
                    </ul>
                </div>`;
            }
            
            if (report.suggestions) {
                html += `<div class="mb-8">
                    <h4 class="text-gray-900 font-bold mb-4 flex items-center">
                        <i class="fas fa-lightbulb mr-2 text-yellow-500"></i>
                        改进建议
                    </h4>
                    <ul class="space-y-3">
                        ${report.suggestions.map(s => `<li class="flex items-start text-sm">
                            <span class="w-1.5 h-1.5 rounded-full bg-yellow-500 mt-1.5 mr-3 flex-shrink-0"></span>
                            <span>${s}</span>
                        </li>`).join('')}
                    </ul>
                </div>`;
            }

            dom.aiReport.innerHTML = html;
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

    function renderMultiResults(data, selectedResumes = []) {
        dom.emptyState.classList.add('hidden');
        dom.singleResults.classList.add('hidden');
        dom.multiResults.classList.remove('hidden');
        
        // Transform compare-resumes result to people format
        const people = selectedResumes.map((r, i) => {
            const label = String.fromCharCode(65 + i);
            const scores = data.radar_scores || {};
            return {
                name: r.name || '候选人',
                total_score: data.global_scores?.[label] || 0,
                scores_percent: {
                    skills: (scores.skill_match?.[label] || 0) * 20,
                    experience: (scores.experience_match?.[label] || 0) * 20,
                    education: (scores.job_match?.[label] || 0) * 20,
                    stability: (scores.learning_ability?.[label] || 0) * 20,
                    potential: (scores.learning_ability?.[label] || 0) * 20,
                    teamwork: (scores.teamwork?.[label] || 0) * 20
                },
                summary: data.recommendation?.reason || data.summary_report || '暂无评价'
            };
        });
        
        if (people.length === 0) {
            dom.multiResults.innerHTML = '<div class="text-center py-20 text-gray-500">未获取到对比数据</div>';
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
                    <div class="w-full">
                        <table class="w-full text-left border-collapse table-fixed">
                            <thead>
                                <tr class="bg-gray-50/50">
                                    <th class="p-3 border-b border-gray-100 text-[11px] font-bold text-gray-500 w-[100px]">候选人</th>
                                    ${dims.map(dim => `
                                        <th class="p-3 border-b border-gray-100 text-center text-[11px] font-bold text-gray-500 leading-tight">
                                            <div class="flex flex-col items-center justify-center">
                                                <span>${dim.label.substring(0, 2)}</span>
                                                <span>${dim.label.substring(2)}</span>
                                            </div>
                                        </th>
                                    `).join('')}
                                    <th class="p-3 border-b border-gray-100 text-center text-[11px] font-bold text-gray-500 w-[70px]">综合得分</th>
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
                        ${data.recommendation ? `
                            <div class="mb-8 p-6 bg-blue-50/50 rounded-2xl border border-blue-100">
                                <div class="flex items-center space-x-3 mb-4">
                                    <div class="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md">
                                        <i class="fas fa-trophy"></i>
                                    </div>
                                    <div>
                                        <h5 class="text-base font-bold text-gray-900">
                                            推荐人选：${data.recommendation.winner === 'Tie' ? '多位人选平局' : (people[data.recommendation.winner.charCodeAt(0) - 65]?.name || data.recommendation.winner)}
                                        </h5>
                                        <p class="text-xs text-blue-600 font-medium uppercase tracking-wider">Top Recommendation</p>
                                    </div>
                                </div>
                                <p class="text-sm text-gray-700 leading-relaxed">${data.recommendation.reason}</p>
                                ${data.recommendation.hiring_risk ? `
                                    <div class="mt-4 pt-4 border-t border-blue-100 flex items-start space-x-2">
                                        <i class="fas fa-exclamation-triangle text-amber-500 mt-0.5"></i>
                                        <p class="text-xs text-gray-600"><span class="font-bold text-amber-600">风险提示：</span>${data.recommendation.hiring_risk}</p>
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

                        ${data.comparison_table ? `
                            <div class="mt-10">
                                <h5 class="text-base font-bold text-gray-900 mb-6 flex items-center">
                                    <i class="fas fa-th-list mr-2 text-blue-500"></i>
                                    详细对比矩阵
                                </h5>
                                <div class="overflow-x-auto rounded-xl border border-gray-100">
                                    <table class="w-full text-xs text-left border-collapse">
                                        <thead>
                                            <tr class="bg-gray-50 border-b border-gray-100">
                                                <th class="p-4 font-bold text-gray-600 w-32">对比维度</th>
                                                ${selectedResumes.map(r => `
                                                    <th class="p-4 font-bold text-gray-600">${r.name}</th>
                                                `).join('')}
                                                <th class="p-4 font-bold text-gray-600 w-24 text-center">胜出者</th>
                                            </tr>
                                        </thead>
                                        <tbody class="divide-y divide-gray-50">
                                            ${data.comparison_table.map(row => `
                                                <tr class="hover:bg-blue-50/20 transition-colors">
                                                    <td class="p-4 font-bold text-gray-700 bg-gray-50/30">${row.dimension}</td>
                                                    ${selectedResumes.map((_, i) => `
                                                        <td class="p-4 text-gray-600 leading-relaxed">
                                                            ${row[String.fromCharCode(65 + i)] || '-'}
                                                        </td>
                                                    `).join('')}
                                                    <td class="p-4 text-center">
                                                        <span class="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${row.winner === 'Tie' ? 'bg-gray-100 text-gray-600' : 'bg-green-50 text-green-600 border border-green-100'}">
                                                            ${row.winner === 'Tie' ? '平局' : (people[row.winner.charCodeAt(0) - 65]?.name || row.winner)}
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
