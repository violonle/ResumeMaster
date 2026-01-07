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
            { id: 'applied', title: '投递', color: 'blue' },
            { id: 'screening', title: '初筛', color: 'indigo' },
            { id: 'interview', title: '面试', color: 'purple' },
            { id: 'offer', title: 'Offer', color: 'amber' },
            { id: 'hired', title: '入职', color: 'emerald' },
            { id: 'rejected', title: '淘汰', color: 'red' }
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
                        department: j.department || ''
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
                    '入职': 'hired'
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
            jobId: 'all',
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
            <div class="flex flex-col h-full bg-gray-50 rounded-lg border border-gray-200 w-80 flex-shrink-0" data-column="${col.id}">
                <div class="p-3 border-b border-gray-200 bg-white rounded-t-lg flex justify-between items-center sticky top-0 z-10">
                    <div class="flex items-center gap-2">
                        <div class="w-3 h-3 rounded-full bg-${col.color}-500"></div>
                        <h3 class="font-semibold text-gray-700">${col.title}</h3>
                        <span class="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-500 count-badge">0</span>
                    </div>
                    <button class="text-gray-400 hover:text-gray-600"><i class="fas fa-ellipsis-h"></i></button>
                </div>
                <div class="flex-1 p-2 overflow-y-auto space-y-3 custom-scrollbar kanban-column" 
                     id="col-${col.id}"
                     ondrop="recruitmentFlowController.handleDrop(event, '${col.id}')"
                     ondragover="recruitmentFlowController.handleDragOver(event)"
                     ondragenter="recruitmentFlowController.handleDragEnter(event)"
                     ondragleave="recruitmentFlowController.handleDragLeave(event)">
                    <!-- Cards will be injected here -->
                </div>
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
        });

        filteredCandidates.forEach(candidate => {
            // 添加调试信息
            console.log('创建简历卡片:', { id: candidate.id, resumeId: candidate.resumeId, name: candidate.name });
            
            const colEl = document.getElementById(`col-${candidate.status}`);
            if (colEl) {
                const card = document.createElement('div');
                card.className = 'bg-white p-3 rounded shadow-sm border border-gray-100 cursor-move hover:shadow-md transition-all duration-200 group relative';
                card.draggable = true;
                card.dataset.id = candidate.id;
                // 添加点击事件，使整个卡片可点击查看详情
                    card.addEventListener('click', (e) => {
                        // 如果点击的是按钮，不执行卡片点击事件（避免冲突）
                        if (!e.target.closest('button')) {
                            this.viewResume(candidate.resumeId);
                        }
                    });
                card.innerHTML = `
                    <div class="flex justify-between items-start mb-2">
                        <div>
                            <div class="font-medium text-gray-900">${candidate.name}</div>
                            <div class="text-xs text-gray-500">${candidate.education} · ${candidate.experience}</div>
                        </div>
                        <div class="text-xs font-semibold ${candidate.score >= 90 ? 'text-green-600' : 'text-blue-600'}">
                            ${candidate.score}分
                        </div>
                    </div>
                    ${this.renderCardActions(candidate)}
                `;
                
                // Drag events
                card.addEventListener('dragstart', (e) => this.handleDragStart(e, candidate.id));
                card.addEventListener('dragend', (e) => this.handleDragEnd(e));

                colEl.appendChild(card);

                // Update count
                const countBadge = document.querySelector(`[data-column="${candidate.status}"] .count-badge`);
                if (countBadge) {
                    countBadge.textContent = parseInt(countBadge.textContent) + 1;
                }
            }
        });
    },

    renderCardActions(candidate) {
        let actions = '';
        const btnClass = "flex-1 text-xs py-1.5 rounded transition-colors text-center";
        
        switch (candidate.status) {
            case 'applied': // 投递
                actions = `
                    <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onclick="recruitmentFlowController.viewResume('${candidate.resumeId}')" class="${btnClass} bg-gray-100 text-gray-600 hover:bg-gray-200">查看</button>
                        <button onclick="recruitmentFlowController.advanceCandidate('${candidate.id}', 'screening')" class="${btnClass} bg-indigo-50 text-indigo-600 hover:bg-indigo-100">通过初筛</button>
                    </div>`;
                break;
                
            case 'screening': // 初筛
                actions = `
                    <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onclick="recruitmentFlowController.viewResume('${candidate.resumeId}')" class="${btnClass} bg-gray-100 text-gray-600 hover:bg-gray-200">查看</button>
                         <button onclick="recruitmentFlowController.advanceCandidate('${candidate.id}', 'interview')" class="${btnClass} bg-purple-50 text-purple-600 hover:bg-purple-100">安排面试</button>
                    </div>`;
                break;

            case 'interview': // 面试
                actions = `
                    <div class="grid grid-cols-2 gap-2">
                        <button onclick="recruitmentFlowController.openModal('interview', '${candidate.id}')" class="${btnClass} bg-purple-50 text-purple-600 hover:bg-purple-100 col-span-2"><i class="fas fa-calendar-alt mr-1"></i>安排/修改面试</button>
                        <button onclick="recruitmentFlowController.advanceCandidate('${candidate.id}', 'offer')" class="${btnClass} bg-green-50 text-green-600 hover:bg-green-100">面试通过</button>
                        <button onclick="recruitmentFlowController.advanceCandidate('${candidate.id}', 'rejected')" class="${btnClass} bg-red-50 text-red-600 hover:bg-red-100">淘汰</button>
                    </div>`;
                break;

            case 'offer': // Offer
                actions = `
                    <div class="space-y-2">
                        <button onclick="recruitmentFlowController.openModal('offer', '${candidate.id}')" class="${btnClass} w-full bg-amber-50 text-amber-600 hover:bg-amber-100"><i class="fas fa-file-contract mr-1"></i>发送/修改Offer</button>
                        <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onclick="recruitmentFlowController.advanceCandidate('${candidate.id}', 'hired')" class="${btnClass} bg-emerald-50 text-emerald-600 hover:bg-emerald-100">确认入职</button>
                            <button onclick="recruitmentFlowController.advanceCandidate('${candidate.id}', 'rejected')" class="${btnClass} bg-red-50 text-red-600 hover:bg-red-100">拒绝</button>
                        </div>
                    </div>`;
                break;

            case 'hired': // 入职
                actions = `
                    <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onclick="recruitmentFlowController.viewResume('${candidate.resumeId}')" class="${btnClass} w-full bg-gray-100 text-gray-600 hover:bg-gray-200">查看档案</button>
                    </div>`;
                break;

            case 'rejected': // 淘汰
                actions = `
                    <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onclick="recruitmentFlowController.advanceCandidate('${candidate.id}', 'applied')" class="${btnClass} w-full bg-gray-100 text-gray-600 hover:bg-gray-200">恢复候选人</button>
                    </div>`;
                break;
        }
        return actions;
    },

    updateStats() {
        const filtered = this.state.currentJobId === 'all'
            ? this.state.candidates
            : this.state.candidates.filter(c => c.jobId === this.state.currentJobId);
        const stats = {
            total: filtered.length,
            interview: filtered.filter(c => c.status === 'interview').length,
            offer: filtered.filter(c => c.status === 'offer').length,
            hired: filtered.filter(c => c.status === 'hired').length
        };
        
        const statsEl = document.getElementById('process-stats');
        if (statsEl) {
            statsEl.innerHTML = `
                <div class="flex items-center gap-4 text-sm text-gray-600">
                    <div><span class="font-bold text-gray-900">${stats.total}</span> 候选人</div>
                    <div><span class="font-bold text-indigo-600">${stats.interview}</span> 面试中</div>
                    <div><span class="font-bold text-amber-600">${stats.offer}</span> Offer</div>
                    <div><span class="font-bold text-emerald-600">${stats.hired}</span> 入职</div>
                </div>
            `;
        }
    },

    // Actions
    handleDragStart(e, id) {
        this.state.draggedCardId = id;
        e.dataTransfer.setData('text/plain', id);
        e.target.classList.add('opacity-50');
    },

    handleDragEnd(e) {
        e.target.classList.remove('opacity-50');
        document.querySelectorAll('.kanban-column').forEach(col => {
            col.classList.remove('bg-gray-100', 'ring-2', 'ring-blue-100');
        });
        this.state.draggedCardId = null;
    },

    handleDragOver(e) {
        e.preventDefault();
    },

    handleDragEnter(e) {
        e.preventDefault();
        const col = e.target.closest('.kanban-column');
        if (col) {
            col.classList.add('bg-gray-100', 'ring-2', 'ring-blue-100');
        }
    },

    handleDragLeave(e) {
        const col = e.target.closest('.kanban-column');
        if (col) {
            col.classList.remove('bg-gray-100', 'ring-2', 'ring-blue-100');
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
            
            // Trigger modals if needed
            if (targetStatus === 'interview') {
                this.openModal('interview', id);
            } else if (targetStatus === 'offer') {
                this.openModal('offer', id);
            }
            
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
        const interviewForm = document.getElementById('interviewForm');
        if (interviewForm) {
            interviewForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const modal = document.getElementById('interviewModal');
                const id = modal.dataset.candidateId;
                
                // Collect form data
                const formData = new FormData(e.target);
                const data = Object.fromEntries(formData.entries());
                
                try {
                    await resumeDataManager.scheduleInterview(id, {
                        datetime: data.datetime || (data.date + ' ' + data.time),
                        channel: data.type,
                        location: data.interviewer || '',
                        note: data.notes || ''
                    });
                    if (typeof window !== 'undefined' && window.ui && window.ui.showAlert) {
                        window.ui.showAlert('面试安排已发送！', { type: 'success' });
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
                    await resumeDataManager.sendOffer(id, {
                        message: data.content || '恭喜您通过面试，我们向您发出录用意向。',
                        phone: '',
                        email: ''
                    });
                    if (typeof window !== 'undefined' && window.ui && window.ui.showAlert) {
                        window.ui.showAlert('Offer已发送！', { type: 'success' });
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
            flatpickr(".flatpickr", {
                enableTime: true,
                dateFormat: "Y-m-d H:i",
                time_24hr: true,
                locale: "zh",
                minDate: "today",
                defaultHour: 10
            });
        }
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    recruitmentFlowController.init();
});
