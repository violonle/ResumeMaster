/**
 * Recruitment Flow Controller
 * Manages the recruitment process Kanban board and related actions.
 */

const recruitmentFlowController = {
    // State
    state: {
        jobs: [
            { id: 'all', title: '全部岗位', department: '' }
        ],
        currentJobId: 'all',
        candidates: [],
        columns: [
            { id: 'applied', title: '待初筛', icon: 'fa-inbox-in', color: 'blue' },
            { id: 'screening', title: '已初筛', icon: 'fa-user-check', color: 'indigo' },
            { id: 'interview', title: '面试中', icon: 'fa-comments-question', color: 'purple' },
            { id: 'offer', title: '已录用', icon: 'fa-file-certificate', color: 'amber' },
            { id: 'rejected', title: '自动淘汰池', icon: 'fa-ban', color: 'red' }
        ],
        draggedCardId: null
    },

    // Initialization
    init() {
        // Initialize Sidebar
        if (window.Sidebar) {
            window.Sidebar.init({
                active: 'recruitment-flow'
            });
        }

        this.loadData();
        this.setupEventListeners();
        this.initFlatpickr();
        
        // Check URL params for auto-actions (e.g., open specific job)
        const urlParams = new URLSearchParams(window.location.search);
        const jobId = urlParams.get('jobId');
        if (jobId) {
            this.state.currentJobId = jobId;
        }
    },

    async loadData() {
        try {
            if (typeof resumeDataManager === 'undefined') {
                throw new Error('ResumeDataManager not found');
            }

            // Load Jobs
            const jobs = await resumeDataManager.getAllJobs();
            if (jobs && jobs.length > 0) {
                this.state.jobs = [
                    { id: 'all', title: '全部岗位', department: '' },
                    ...jobs.map(j => ({
                        id: String(j.id),
                        title: j.title,
                        department: j.department || '',
                        enableAutoScreening: j.enableAutoScreening || j.enable_auto_screening || false
                    }))
                ];
            }

            // Load Pipeline Data
            const pipeline = await resumeDataManager.getRecruitmentPipeline();
            
            console.log('从getRecruitmentPipeline获取的数据:', pipeline);
            
            if (pipeline) {
                // Pipeline is an object with status keys: '投递', '初筛', '面试', 'Offer', '入职'
                // Convert to flat array of candidates
                const statusMap = {
                    '投递': 'applied',
                    '初筛': 'screening',
                    '面试': 'interview',
                    'Offer': 'offer',
                    '入职': 'offer', // Map 'hired' related statuses to 'offer'
                    '已入职': 'offer',
                    '已录用': 'offer',
                    '淘汰': 'rejected',
                    '放弃': 'rejected',
                    // Add English keys support for consistency
                    'applied': 'applied',
                    'screening': 'screening',
                    'interview': 'interview',
                    'offer': 'offer',
                    'hired': 'offer', // Map 'hired' to 'offer' so they appear in the same column
                    'rejected': 'rejected'
                };
                
                this.state.candidates = [];
                Object.keys(pipeline).forEach(status => {
                    const mappedStatus = statusMap[status] || status;
                    if (Array.isArray(pipeline[status])) {
                        pipeline[status].forEach(item => {
                            console.log('处理简历项:', item);
                            const candidate = this.mapApiToCandidate(item);
                            console.log('转换后的候选人:', candidate);
                            this.state.candidates.push({
                                ...candidate,
                                status: mappedStatus
                            });
                        });
                    }
                });
                
                console.log('最终候选人列表:', this.state.candidates);
            } else {
                this.state.candidates = [];
            }

        } catch (error) {
            console.error('Failed to load recruitment data:', error);
            this.state.candidates = [];
        }

        this.renderHeader();
        this.renderBoard();
        this.updateStats();
    },

    mapApiToCandidate(item) {
        let educationStr = '未填写学历';
        let experienceStr = '无经验';
        let hasParseError = false;
        
        if (item.parsed_data) {
            const parsed = item.parsed_data;
            
            if (parsed.parseError) {
                hasParseError = true;
                console.warn(`Resume ${item.id} has parse error:`, parsed.parseError);
            } else if (parsed.rawText === '') {
                hasParseError = true;
                console.warn(`Resume ${item.id} has empty raw text`);
            } else {
                try {
                    // Education
                    if (Array.isArray(parsed.education) && parsed.education.length > 0) {
                        const edu = parsed.education[0];
                        educationStr = `${edu.degree || ''} ${edu.school || ''}`.trim();
                    }
                    
                    // Experience
                    if (Array.isArray(parsed.work_experience) && parsed.work_experience.length > 0) {
                        const exp = parsed.work_experience[0];
                        experienceStr = exp.company || '未知公司';
                    }
                } catch (e) {
                    console.error(`Error parsing resume ${item.id}:`, e);
                    hasParseError = true;
                }
            }
        }

        return {
            id: String(item.id),
            resumeId: String(item.id),
            name: item.name || item.file_name || '未知候选人',
            jobId: String(item.job_id || item.jobId || 'all'),
            score: item.score || 0,
            experience: experienceStr,
            education: educationStr,
            interviewTime: null,
            offerStatus: null
        };
    },

    // Rendering
    renderHeader() {
        const jobSelect = document.getElementById('jobSelect');
        if (jobSelect) {
            jobSelect.innerHTML = this.state.jobs.map(job => {
                const label = job.id === 'all' ? '全部岗位' : `${job.title} - ${job.department}`;
                return `<option value="${job.id}" ${job.id === this.state.currentJobId ? 'selected' : ''}>${label}</option>`
            }).join('');
            
            jobSelect.addEventListener('change', (e) => {
                this.state.currentJobId = e.target.value;
                this.renderBoard();
                this.updateStats();
            });
        }
    },

    renderBoard() {
        const board = document.getElementById('kanban-board');
        if (!board) return;

        board.innerHTML = this.state.columns.map(col => `
            <div 
                class="min-w-[340px] w-[340px] rounded-3xl p-5 border transition-all flex flex-col h-full bg-white border-gray-100/50 column-container" 
                data-column="${col.id}"
                ondrop="recruitmentFlowController.handleDrop(event, '${col.id}')"
                ondragover="recruitmentFlowController.handleDragOver(event)"
                ondragenter="recruitmentFlowController.handleDragEnter(event)"
                ondragleave="recruitmentFlowController.handleDragLeave(event)"
            >
                <div class="flex items-center justify-between mb-6 px-3">
                    <div class="flex items-center">
                        <div class="w-9 h-9 rounded-lg bg-white border border-gray-100 shadow-sm flex items-center justify-center mr-3 text-${col.color}-600">
                            <i class="fa-solid ${col.icon || 'fa-folder'} text-sm"></i>
                        </div>
                        <span class="text-sm font-black text-gray-900">${col.title}</span>
                    </div>
                    <span class="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-[10px] font-black text-${col.color}-700 border border-gray-100 shadow-sm count-badge">
                        0
                    </span>
                </div>
                
                <div class="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-1 kanban-column" id="col-${col.id}">
                    <!-- Cards will be injected here -->
                </div>

                <button onclick="recruitmentFlowController.openAddCandidateModal()" class="w-full py-4 mt-4 border-2 border-dashed border-gray-100 rounded-2xl text-[11px] text-gray-400 font-black hover:bg-white hover:text-blue-700 hover:border-blue-200 transition-all flex items-center justify-center group">
                    <i class="fa-solid fa-plus-circle mr-2 text-sm group-hover:scale-110 transition-transform"></i>
                    添加候选人
                </button>
            </div>
        `).join('');

        this.renderCards();
    },

    renderCards() {
        const filteredCandidates = this.state.currentJobId === 'all'
            ? this.state.candidates
            : this.state.candidates.filter(c => c.jobId === this.state.currentJobId);
        
        // Reset counts
        this.state.columns.forEach(col => {
            const countBadge = document.querySelector(`[data-column="${col.id}"] .count-badge`);
            if (countBadge) countBadge.textContent = '0';
            const colEl = document.getElementById(`col-${col.id}`);
            if (colEl) colEl.innerHTML = '';
        });

        filteredCandidates.forEach(candidate => {
            // Logic for 'applied' (待初筛): Show ALL candidates, ignoring auto-screening status
            // to ensure consistency with librarypool.html
            // if (candidate.status === 'applied') {
            //     const job = this.state.jobs.find(j => j.id === candidate.jobId);
            //     if (job && job.enableAutoScreening) {
            //         return;
            //     }
            // }

            const colEl = document.getElementById(`col-${candidate.status}`);
            if (colEl) {
                const card = document.createElement('div');
                card.className = `bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:border-blue-300 transition-all cursor-move group relative animate-in overflow-hidden`;
                card.draggable = true;
                card.dataset.id = candidate.id;
                
                card.addEventListener('click', (e) => {
                    if (!e.target.closest('button') && !e.target.closest('a')) {
                        this.viewResume(candidate.resumeId);
                    }
                });

                const avatarUrl = `https://i.pravatar.cc/150?u=${candidate.id}`;
                const tags = candidate.tags || ['待处理'];
                
                // Determine action text based on status
                const nextActionText = {
                    'applied': '通过初筛',
                    'screening': '安排面试',
                    'interview': '面试通过',
                    'offer': '确认入职',
                    'hired': '查看档案'
                }[candidate.status] || '下一步';

                // Determine buttons content
                let actionButtons;
                if (candidate.status === 'rejected') {
                    actionButtons = `
                        <div class="flex items-center gap-1.5 w-[95%]">
                            <button onclick="recruitmentFlowController.advanceCandidate('${candidate.id}', 'applied')" 
                                    class="flex-1 bg-green-600 text-white text-[10px] font-black py-1.5 rounded-lg hover:bg-green-700 transition-colors shadow-md shadow-green-100 whitespace-nowrap overflow-hidden text-ellipsis">
                                复活
                            </button>
                            <button onclick="recruitmentFlowController.deleteCandidate('${candidate.id}')" 
                                    class="flex-1 bg-red-600 text-white text-[10px] font-black py-1.5 rounded-lg hover:bg-red-700 transition-colors shadow-md shadow-red-100 whitespace-nowrap overflow-hidden text-ellipsis">
                                删除
                            </button>
                            <button onclick="window.location.href='resume-tools.html?id=${candidate.resumeId}'" 
                                    class="flex-1 bg-blue-600 text-white text-[10px] font-black py-1.5 rounded-lg hover:bg-blue-700 transition-colors shadow-md shadow-blue-100 whitespace-nowrap overflow-hidden text-ellipsis">
                                深度解析
                            </button>
                        </div>
                    `;
                } else {
                    actionButtons = `
                        <div class="flex items-center gap-1.5 w-[95%]">
                            <button onclick="recruitmentFlowController.viewResume('${candidate.resumeId}')" 
                                    class="flex-1 bg-white border border-gray-200 text-gray-700 text-[10px] font-black py-1.5 rounded-lg hover:bg-gray-50 transition-colors shadow-sm whitespace-nowrap overflow-hidden text-ellipsis">
                                查看
                            </button>
                            <button onclick="recruitmentFlowController.advanceCandidate('${candidate.id}')" 
                                    class="flex-1 bg-blue-600 text-white text-[10px] font-black py-1.5 rounded-lg hover:bg-blue-700 transition-colors shadow-md shadow-blue-100 whitespace-nowrap overflow-hidden text-ellipsis">
                                ${nextActionText}
                            </button>
                            <a href="javascript:void(0)" onclick="recruitmentFlowController.advanceCandidate('${candidate.id}', 'rejected')" 
                               class="pl-2 text-[10px] font-black text-gray-400 hover:text-red-500 transition-colors whitespace-nowrap border-l border-gray-100 shrink-0">
                                淘汰
                            </a>
                        </div>
                    `;
                }

                card.innerHTML = `
                    <!-- Hover Overlay -->
                    <div class="absolute inset-0 bg-white/90 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-300 z-10 flex items-center justify-center px-2">
                        ${actionButtons}
                    </div>

                    <div class="flex justify-between items-start mb-2">
                        <div class="flex flex-wrap gap-1">
                            ${tags.map(tag => `
                                <span class="inline-flex items-center text-[8px] font-black px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-100/50">
                                    ${tag}
                                </span>
                            `).join('')}
                        </div>
                        <i class="fa-solid fa-grip-lines text-gray-100 group-hover:text-gray-200 text-[10px] transition-colors"></i>
                    </div>

                    <div class="flex items-center space-x-3 mt-2">
                        <img class="w-8 h-8 rounded-lg border border-gray-50 shadow-sm pointer-events-none" src="${avatarUrl}" alt="${candidate.name}" />
                        <div class="min-w-0 flex-1">
                            <h4 class="text-[12px] font-black text-gray-900 truncate">${candidate.name}</h4>
                            <p class="text-[10px] font-bold text-gray-400 truncate">${candidate.education} · ${candidate.experience}</p>
                        </div>
                        <div class="text-right shrink-0">
                            <div class="text-[11px] font-black ${candidate.score >= 90 ? 'text-green-600' : 'text-blue-600'}">
                                ${candidate.score}
                            </div>
                        </div>
                    </div>
                `;
                
                card.addEventListener('dragstart', (e) => this.handleDragStart(e, candidate.id));
                card.addEventListener('dragend', (e) => this.handleDragEnd(e));

                colEl.appendChild(card);

                const countBadge = document.querySelector(`[data-column="${candidate.status}"] .count-badge`);
                if (countBadge) {
                    countBadge.textContent = parseInt(countBadge.textContent) + 1;
                }
            }
        });
        
        // Render empty states
        this.state.columns.forEach(col => {
            const colEl = document.getElementById(`col-${col.id}`);
            if (colEl && colEl.children.length === 0) {
                colEl.innerHTML = `
                    <div class="py-12 text-center border-2 border-dashed border-gray-100 rounded-2xl bg-white/30 flex flex-col items-center">
                        <i class="fa-solid fa-folder-open text-gray-200 text-3xl mb-3"></i>
                        <p class="text-xs font-black text-gray-400">将卡片拖至此处</p>
                    </div>
                `;
            }
        });
    },

    updateStats() {
        const filtered = this.state.currentJobId === 'all'
            ? this.state.candidates
            : this.state.candidates.filter(c => c.jobId === this.state.currentJobId);
        const stats = {
            total: filtered.length,
            interview: filtered.filter(c => c.status === 'interview').length,
            offer: filtered.filter(c => c.status === 'offer').length,
            hired: filtered.filter(c => c.status === 'hired').length,
            rejected: filtered.filter(c => c.status === 'rejected').length
        };
        
        const statsEl = document.getElementById('process-stats');
        if (statsEl) {
            statsEl.innerHTML = `
                <div class="flex items-center gap-6">
                    <div class="flex items-center">
                        <div class="w-2 h-2 rounded-full bg-blue-600 mr-2"></div>
                        <span class="text-[11px] font-black text-gray-400 mr-2">候选人</span>
                        <span class="text-sm font-black text-gray-900">${stats.total}</span>
                    </div>
                    <div class="w-px h-4 bg-gray-100"></div>
                    <div class="flex items-center">
                        <div class="w-2 h-2 rounded-full bg-purple-600 mr-2"></div>
                        <span class="text-[11px] font-black text-gray-400 mr-2">面试中</span>
                        <span class="text-sm font-black text-gray-900">${stats.interview}</span>
                    </div>
                    <div class="w-px h-4 bg-gray-100"></div>
                    <div class="flex items-center">
                        <div class="w-2 h-2 rounded-full bg-amber-600 mr-2"></div>
                        <span class="text-[11px] font-black text-gray-400 mr-2">录用中</span>
                        <span class="text-sm font-black text-gray-900">${stats.offer}</span>
                    </div>
                    <div class="w-px h-4 bg-gray-100"></div>
                    <div class="flex items-center">
                        <div class="w-2 h-2 rounded-full bg-emerald-600 mr-2"></div>
                        <span class="text-[11px] font-black text-gray-400 mr-2">已录用</span>
                        <span class="text-sm font-black text-gray-900">${stats.hired}</span>
                    </div>
                    <div class="w-px h-4 bg-gray-100"></div>
                    <div class="flex items-center">
                        <div class="w-2 h-2 rounded-full bg-red-600 mr-2"></div>
                        <span class="text-[11px] font-black text-gray-400 mr-2">已淘汰</span>
                        <span class="text-sm font-black text-gray-900">${stats.rejected}</span>
                    </div>
                </div>
            `;
        }
    },

    // Actions
    handleDragStart(e, id) {
        this.state.draggedCardId = id;
        e.dataTransfer.setData('text/plain', id);
        e.target.classList.add('opacity-40', 'scale-95', 'grayscale');
    },

    handleDragEnd(e) {
        e.target.classList.remove('opacity-40', 'scale-95', 'grayscale');
        document.querySelectorAll('.column-container').forEach(col => {
            col.classList.remove('bg-blue-50/80', 'border-blue-400', 'border-2', 'shadow-inner');
            col.classList.add('bg-white', 'border-gray-100/50');
        });
        this.state.draggedCardId = null;
    },

    handleDragOver(e) {
        e.preventDefault();
    },

    handleDragEnter(e) {
        e.preventDefault();
        const col = e.target.closest('.column-container');
        if (col) {
            col.classList.remove('bg-white', 'border-gray-100/50');
            col.classList.add('bg-blue-50/80', 'border-blue-400', 'border-2', 'shadow-inner');
        }
    },

    handleDragLeave(e) {
        const col = e.target.closest('.column-container');
        if (col) {
            col.classList.remove('bg-blue-50/80', 'border-blue-400', 'border-2', 'shadow-inner');
            col.classList.add('bg-white', 'border-gray-100/50');
        }
    },

    async handleDrop(e, targetStatus) {
        e.preventDefault();
        const candidateId = this.state.draggedCardId;
        if (!candidateId) return;

        const candidate = this.state.candidates.find(c => c.id === candidateId);
        if (candidate && candidate.status !== targetStatus) {
            await this.advanceCandidate(candidateId, targetStatus);
        }
    },

    async advanceCandidate(id, targetStatus) {
        const candidate = this.state.candidates.find(c => c.id === id);
        if (!candidate) return;

        // If targetStatus is not provided, try to infer next step
        if (!targetStatus) {
            const statusOrder = ['applied', 'screening', 'interview', 'offer', 'hired'];
            const currentIdx = statusOrder.indexOf(candidate.status);
            if (currentIdx !== -1 && currentIdx < statusOrder.length - 1) {
                targetStatus = statusOrder[currentIdx + 1];
            } else {
                return;
            }
        }

        // For status that requires extra info via modal, open modal first
        if (targetStatus === 'interview') {
            this.openModal('interview', id);
            return;
        } else if (targetStatus === 'offer') {
            this.openModal('offer', id);
            return;
        }

        // Map English status to Chinese for API
        const statusToChinese = {
            'applied': '投递',
            'screening': '初筛',
            'interview': '面试',
            'offer': 'Offer',
            'hired': '入职',
            'rejected': '放弃'
        };
        const chineseStatus = statusToChinese[targetStatus] || targetStatus;

        // API Call
        try {
            if (typeof ErrorHandler !== 'undefined') ErrorHandler.showLoading(true);
            await resumeDataManager.updateRecruitmentStatus(id, chineseStatus);
            candidate.status = targetStatus;
            
            // Emit event to notify other pages of data update
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('resumeDataUpdated', { detail: { source: 'recruitment-flow' } }));
            }
        } catch (error) {
            console.error('Failed to update status:', error);
            if (typeof window !== 'undefined' && window.ui && window.ui.showAlert) {
                window.ui.showAlert('状态更新失败: ' + error.message, { type: 'error' });
            }
            return; // Do not update UI if failed
        } finally {
            if (typeof ErrorHandler !== 'undefined') ErrorHandler.showLoading(false);
        }

        this.renderBoard();
        this.updateStats();
    },

    async deleteCandidate(id) {
        if (!confirm('确定要删除这位候选人吗？此操作不可恢复。')) return;
        
        try {
            if (typeof ErrorHandler !== 'undefined') ErrorHandler.showLoading(true);
            const candidate = this.state.candidates.find(c => c.id === id);
            if (candidate && candidate.resumeId) {
                await resumeDataManager.deleteResume(candidate.resumeId);
            } else {
                throw new Error('Candidate not found');
            }
            
            // Remove from state
            this.state.candidates = this.state.candidates.filter(c => c.id !== id);
            this.renderCards();
            this.updateStats();
            
            if (typeof window !== 'undefined' && window.ui && window.ui.showAlert) {
                window.ui.showAlert('候选人已删除', { type: 'success' });
            }
        } catch (error) {
            console.error('Delete failed:', error);
             if (typeof window !== 'undefined' && window.ui && window.ui.showAlert) {
                window.ui.showAlert('删除失败: ' + error.message, { type: 'error' });
            }
        } finally {
            if (typeof ErrorHandler !== 'undefined') ErrorHandler.showLoading(false);
        }
    },

    viewResume(id) {
        const candidate = this.state.candidates.find(c => c.id === id);
        console.log('查看简历:', { id, candidate });
        if (candidate && candidate.resumeId) {
             window.location.href = `resume-details.html?id=${candidate.resumeId}`;
        } else {
            console.error('无法找到简历ID:', { id, candidate });
            if (typeof window !== 'undefined' && window.ui && window.ui.showAlert) {
                window.ui.showAlert('无法找到简历ID', { type: 'error' });
            }
        }
    },

    // Modal Management
    openAddCandidateModal() {
        const modal = document.getElementById('addCandidateModal');
        if (modal) {
            modal.classList.remove('hidden');
            // Populate job select
            const jobSelect = document.getElementById('modalJobSelect');
            if (jobSelect) {
                jobSelect.innerHTML = '<option value="">请选择目标职位...</option>' + 
                    this.state.jobs
                        .filter(j => j.id !== 'all')
                        .map(j => `<option value="${j.id}">${j.title} - ${j.department}</option>`)
                        .join('');
                
                // Reset candidate select
                const candidateSelect = document.getElementById('modalCandidateSelect');
                if (candidateSelect) {
                    candidateSelect.innerHTML = '<option value="">请先选择职位...</option>';
                    candidateSelect.disabled = true;
                }
            }
        }
    },

    async loadCandidatesForJob(jobId) {
        // Mock function to load candidates not in pipeline for specific job
        // In real app, this should fetch candidates who applied to this job but not processed yet
        // For demo, we'll list all candidates not in current board
        try {
            // Reusing getRecruitmentPipeline logic or fetching from a different endpoint
            // For now, let's just show some mock candidates or available resumes
             if (typeof resumeDataManager === 'undefined') return [];
             const resumes = await resumeDataManager.getAllResumes();
             return resumes.map(r => ({
                 id: r.id,
                 name: r.file_name || '未命名候选人'
             }));
        } catch (error) {
            console.error('Failed to load candidates', error);
            return [];
        }
    },

    openModal(type, candidateId) {
        const modal = document.getElementById(`${type}Modal`);
        if (modal) {
            modal.classList.remove('hidden');
            modal.dataset.candidateId = candidateId;
            // Reset form if exists
            const form = modal.querySelector('form');
            if (form) form.reset();
        }
    },

    closeModal(type) {
        const modal = document.getElementById(`${type}Modal`);
        if (modal) {
            modal.classList.add('hidden');
        }
    },

    setupEventListeners() {
        // Modal closers
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.fixed');
                if (modal) modal.classList.add('hidden');
            });
        });

        // Click outside modal to close
        window.onclick = (event) => {
            if (event.target.classList.contains('bg-black/50')) {
                event.target.classList.add('hidden');
            }
        };

        // Form submissions
        const addCandidateForm = document.getElementById('addCandidateForm');
        if (addCandidateForm) {
            const modalJobSelect = document.getElementById('modalJobSelect');
            const modalCandidateSelect = document.getElementById('modalCandidateSelect');

            modalJobSelect.addEventListener('change', async (e) => {
                const jobId = e.target.value;
                if (jobId) {
                    modalCandidateSelect.disabled = false;
                    modalCandidateSelect.innerHTML = '<option value="">正在加载候选人...</option>';
                    const candidates = await this.loadCandidatesForJob(jobId);
                    modalCandidateSelect.innerHTML = '<option value="">请选择候选人...</option>' + 
                        candidates.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
                } else {
                    modalCandidateSelect.innerHTML = '<option value="">请先选择职位...</option>';
                    modalCandidateSelect.disabled = true;
                }
            });

            addCandidateForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const jobId = modalJobSelect.value;
                const resumeId = modalCandidateSelect.value;
                
                if (!jobId || !resumeId) {
                    if (window.ui && window.ui.showAlert) window.ui.showAlert('请选择职位和候选人', { type: 'warning' });
                    return;
                }

                try {
                    if (typeof ErrorHandler !== 'undefined') ErrorHandler.showLoading(true);
                    // Add to pipeline (setting status to '投递')
                    await resumeDataManager.updateRecruitmentStatus(resumeId, '投递');
                    
                    if (window.ui && window.ui.showAlert) window.ui.showAlert('候选人已成功添加！', { type: 'success' });
                    this.closeModal('addCandidate');
                    this.loadData();
                } catch (err) {
                    if (window.ui && window.ui.showAlert) window.ui.showAlert('添加失败: ' + err.message, { type: 'error' });
                } finally {
                    if (typeof ErrorHandler !== 'undefined') ErrorHandler.showLoading(false);
                }
            });
        }

        const interviewForm = document.getElementById('interviewForm');
        if (interviewForm) {
            interviewForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const modal = document.getElementById('interviewModal');
                const id = modal.dataset.candidateId;
                
                console.log('[Frontend] Submitting interview form for id:', id);
                const formData = new FormData(interviewForm);
                const data = {
                datetime: formData.get('datetime'),
                channel: formData.get('channel') || formData.get('type') || 'offline',
                location: formData.get('location') || '',
                note: formData.get('note') || formData.get('notes') || '',
                aiQuestionCount: parseInt(formData.get('aiQuestionCount') || '8', 10)
            };
                console.log('[Frontend] Interview data:', data);
                
                try {
                    if (typeof ErrorHandler !== 'undefined') ErrorHandler.showLoading(true);
                    
                    const result = await resumeDataManager.scheduleInterview(id, {
                        datetime: data.datetime,
                        channel: data.channel,
                        aiQuestionCount: data.aiQuestionCount,
                        location: data.location || '',
                        note: (data.interviewer ? `面试官: ${data.interviewer}\n` : '') + (data.note || '')
                    });
                    
                    if (typeof window !== 'undefined' && window.ui && window.ui.showAlert) {
                        const n = result && result.notifications ? result.notifications : null;
                        const smsText = n ? (n.sms.sent ? '短信已发送' : (n.sms.skipped ? '短信已跳过' : (n.sms.attempted ? '短信发送失败/未配置' : '短信未发送'))) : '短信/邮件按配置发送';
                        const emailText = n ? (n.email.sent ? '邮件已发送' : (n.email.skipped ? '邮件已跳过' : (n.email.attempted ? '邮件发送失败/未配置' : '邮件未发送'))) : '';
                        const msg = ['面试已成功安排', smsText, emailText].filter(Boolean).join('，');
                        window.ui.showAlert(msg, { type: 'success' });
                    }
                    this.closeModal('interview');
                    this.loadData();
                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('resumeDataUpdated', { detail: { source: 'recruitment-flow' } }));
                    }
                } catch(err) {
                    if (typeof window !== 'undefined' && window.ui && window.ui.showAlert) {
                        window.ui.showAlert('安排失败: ' + err.message, { type: 'error' });
                    }
                } finally {
                    if (typeof ErrorHandler !== 'undefined') ErrorHandler.showLoading(false);
                }
            });
        }

        const offerForm = document.getElementById('offerForm');
        if (offerForm) {
            offerForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const modal = document.getElementById('offerModal');
                const id = modal.dataset.candidateId;

                const formData = new FormData(e.target);
                const data = Object.fromEntries(formData.entries());

                try {
                    const result = await resumeDataManager.sendOffer(id, {
                        message: data.content || '恭喜您通过面试，我们向您发出录用意向。',
                        phone: '',
                        email: ''
                    });
                    if (typeof window !== 'undefined' && window.ui && window.ui.showAlert) {
                        const n = result && result.notifications ? result.notifications : null;
                        const smsText = n ? (n.sms.sent ? '短信已发送' : (n.sms.skipped ? '短信已跳过' : (n.sms.attempted ? '短信发送失败/未配置' : '短信未发送'))) : '短信/邮件按配置发送';
                        const emailText = n ? (n.email.sent ? '邮件已发送' : (n.email.skipped ? '邮件已跳过' : (n.email.attempted ? '邮件发送失败/未配置' : '邮件未发送'))) : '';
                        const msg = ['Offer已发送', smsText, emailText].filter(Boolean).join('，');
                        window.ui.showAlert(msg, { type: 'success' });
                    }
                    this.closeModal('offer');
                    this.loadData();
                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('resumeDataUpdated', { detail: { source: 'recruitment-flow' } }));
                    }
                } catch(err) {
                    if (typeof window !== 'undefined' && window.ui && window.ui.showAlert) {
                        window.ui.showAlert('发送失败: ' + err.message, { type: 'error' });
                    }
                }
            });
        }
    },

    initFlatpickr() {
        if (typeof flatpickr !== 'undefined') {
            // Register Chinese locale if available
            const locale = (typeof flatpickr.l10ns !== 'undefined' && flatpickr.l10ns.zh) ? flatpickr.l10ns.zh : 'zh';
            
            flatpickr(".flatpickr", {
                enableTime: true,
                dateFormat: "Y-m-d H:i",
                time_24hr: true,
                locale: locale,
                minDate: "today",
                defaultHour: 10,
                disableMobile: "true",
                animate: true,
                onOpen: function(selectedDates, dateStr, instance) {
                    instance.calendarContainer.classList.add('shadow-xl', 'border-0', 'rounded-xl');
                }
            });
        }
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    recruitmentFlowController.init();
});
