/**
 * Recruitment Flow Controller
 * Manages the recruitment process Kanban board and related actions.
 */

// Global status converter fallback
if (typeof window !== 'undefined' && typeof window.toCN === 'undefined') {
  window.toCN = function(s){
    const k = String(s||'').toLowerCase();
    if (k==='applied'||k==='投递'||k==='new'||k==='') return '待快评';
    if (k==='screening'||k==='快评'||k==='已快评'||k==='passed') return '已快评';
    if (k==='interview'||k==='面试') return '面试中';
    if (k==='offer'||k==='已发offer') return '已录用';
    if (k==='hired'||k==='入职'||k==='已入职'||k==='已录用') return '已录用';
    if (k==='rejected'||k==='淘汰'||k==='已淘汰') return '已淘汰';
    return '待快评';
  };
}

const recruitmentFlowController = {
    // State
    state: {
        jobs: [
            { id: 'all', title: '全部岗位', department: '' }
        ],
        currentJobId: 'all',
        candidates: [],
        columns: [
            { id: 'applied', title: '待快评', icon: 'fa-inbox-in', color: 'blue' },
            { id: 'screening', title: '已快评', icon: 'fa-user-check', color: 'indigo' },
            { id: 'interview', title: '面试中', icon: 'fa-comments-question', color: 'purple' },
            { id: 'offer', title: '已录用', icon: 'fa-file-certificate', color: 'indigo' },
            { id: 'rejected', title: '自动淘汰池', icon: 'fa-ban', color: 'red' }
        ],
        draggedCardId: null,
        currentRejectId: null
    },

    // Initialization
    init() {
        // Initialize Sidebar
        if (window.Sidebar) {
            window.Sidebar.init({
                active: 'recruitment-flow'
            });
        }

        // Check URL params for auto-actions (e.g., open specific job)
        const urlParams = new URLSearchParams(window.location.search);
        const jobId = urlParams.get('jobId');
        if (jobId) {
            this.state.currentJobId = jobId;
        }

        this.loadData();
        this.setupEventListeners();
        this.initFlatpickr();
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
            // If currentJobId is 'all', fetch all resumes grouped by status
            // Otherwise, fetch pipeline data for the specific job
            const pipelineJobId = this.state.currentJobId === 'all' ? null : this.state.currentJobId;
            const pipeline = await resumeDataManager.getRecruitmentPipeline(pipelineJobId);
            
            console.log(`从 getRecruitmentPipeline(${pipelineJobId}) 获取的数据:`, pipeline);
            
            this.state.candidates = [];
            
            if (pipeline) {
                // Determine if pipeline is an array (flat) or an object (grouped)
                const isArray = Array.isArray(pipeline);
                
                // Pipeline might be an object with status keys or a flat array
                const statusMap = {
                    '投递': 'applied',
                    '快评': 'screening',
                    '面试': 'interview',
                    '面试中': 'interview',
                    'Offer': 'offer',
                    '入职': 'offer',
                    '已入职': 'offer',
                    '已录用': 'offer',
                    '淘汰': 'rejected',
                    '已淘汰': 'rejected',
                    '自动淘汰': 'rejected',
                    '放弃': 'rejected',
                    'archived': 'rejected',
                    'applied': 'applied',
                    'screening': 'screening',
                    'interview': 'interview',
                    'offer': 'offer',
                    'hired': 'offer',
                    'rejected': 'rejected'
                };

                if (isArray) {
                    // Handle flat array from /recruitment/pipeline/view
                    pipeline.forEach(item => {
                        const candidate = this.mapApiToCandidate(item);
                        const rawStatus = item.status || item.recruitment_status || 'applied';
                        const mappedStatus = statusMap[rawStatus] || rawStatus;
                        
                        this.state.candidates.push({
                            ...candidate,
                            status: mappedStatus
                        });
                    });
                } else {
                    // Handle grouped object from /library/resumes?groupByStatus=true
                    Object.keys(pipeline).forEach(status => {
                        const mappedStatus = statusMap[status] || status;
                        if (Array.isArray(pipeline[status])) {
                            pipeline[status].forEach(item => {
                                const candidate = this.mapApiToCandidate(item);
                                this.state.candidates.push({
                                    ...candidate,
                                    status: mappedStatus
                                });
                            });
                        }
                    });
                }
                
                if (this.state.currentJobId && this.state.currentJobId !== 'all') {
                    const currentJobId = String(this.state.currentJobId);
                    this.state.candidates = this.state.candidates.filter(c => String(c.jobId) === currentJobId);
                }

                console.log('最终候选人列表:', this.state.candidates);
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
                console.warn(`Resume ${item.id} has parse error:`, JSON.stringify(parsed.parseError));
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

        // 使用 resume_job_id 作为 ID，它是 recruitment 流程中唯一标识一条“简历-职位”关联的 ID
        const recruitmentId = item.resume_job_id || item.id;

        return {
            id: String(recruitmentId),
            resumeId: String(item.id),
            name: item.name || item.file_name || '未知候选人',
            jobId: String(item.job_id || item.jobId || item.associated_job_id || item.rj_job_id || 'all'),
            score: item.score || (item.analysis ? item.analysis.overall_score : 0),
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
                const label = job.id === 'all' ? '全部岗位' : job.title;
                return `<option value="${job.id}" ${job.id === this.state.currentJobId ? 'selected' : ''}>${label}</option>`
            }).join('');
            
            // Remove old listener if any to avoid duplicates
            const newJobSelect = jobSelect.cloneNode(true);
            jobSelect.parentNode.replaceChild(newJobSelect, jobSelect);
            
            newJobSelect.addEventListener('change', (e) => {
                console.log('[Frontend] Job changed to:', e.target.value);
                this.state.currentJobId = e.target.value;
                this.loadData().then(() => {
                    this.renderBoard();
                    this.updateStats();
                });
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
                ondrop="window.recruitmentFlowController.handleDrop(event, '${col.id}')"
                ondragover="window.recruitmentFlowController.handleDragOver(event)"
                ondragenter="window.recruitmentFlowController.handleDragEnter(event)"
                ondragleave="window.recruitmentFlowController.handleDragLeave(event)"
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

                <button onclick="window.recruitmentFlowController.openAddCandidateModal()" class="w-full py-4 mt-4 border-2 border-dashed border-gray-100 rounded-2xl text-[11px] text-gray-400 font-black hover:bg-white hover:text-blue-700 hover:border-blue-200 transition-all flex items-center justify-center group">
                    <i class="fa-solid fa-plus-circle mr-2 text-sm group-hover:scale-110 transition-transform"></i>
                    添加候选人
                </button>
            </div>
        `).join('');

        this.renderCards();
    },

    renderCards() {
        const filteredCandidates = this.state.candidates;
        
        // Reset counts
        this.state.columns.forEach(col => {
            const countBadge = document.querySelector(`[data-column="${col.id}"] .count-badge`);
            if (countBadge) countBadge.textContent = '0';
            const colEl = document.getElementById(`col-${col.id}`);
            if (colEl) colEl.innerHTML = '';
        });

        filteredCandidates.forEach(candidate => {
            // Logic for 'applied' (待快评): Show ALL candidates, ignoring auto-screening status
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

                const avatarHtml = window.ui ? window.ui.renderAvatar(candidate.avatar, candidate.name, 'w-8 h-8', 'rounded-lg', true) : `
                    <div class="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                        <i class="fas fa-user text-xs"></i>
                    </div>
                `;
                const hasScore = candidate.score > 0;
                const tags = candidate.tags || (hasScore ? ['已快评'] : ['待快评']);
                
                // Determine action text based on status
                const nextActionText = {
                    'applied': '已快评',
                    'screening': '安排面试',
                    'interview': '面试通过',
                    'offer': '确认入职',
                    'hired': '查看档案'
                }[candidate.status] || '下一步';

                // Determine buttons content
                const overlay = document.createElement('div');
                overlay.className = `absolute inset-0 bg-white/95 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 invisible group-hover:visible transition-all duration-200 z-10 flex items-center justify-center px-2`;
                
                const actionButtonsWrapper = document.createElement('div');
                actionButtonsWrapper.className = `flex items-center gap-2 w-full justify-center`;
                
                if (candidate.status === 'rejected') {
                    // Re-activate button
                    const reactivateBtn = document.createElement('button');
                    reactivateBtn.type = 'button';
                    reactivateBtn.className = `flex-1 bg-green-600 text-white text-[10px] font-black py-1.5 rounded-lg hover:bg-green-700 transition-colors shadow-md shadow-green-100 whitespace-nowrap overflow-hidden text-ellipsis`;
                    reactivateBtn.textContent = '复活';
                    reactivateBtn.onclick = (e) => {
                        e.stopPropagation();
                        this.advanceCandidate(candidate.id, 'applied');
                    };
                    
                    // Delete button
                    const deleteBtn = document.createElement('button');
                    deleteBtn.type = 'button';
                    deleteBtn.className = `flex-1 bg-red-600 text-white text-[10px] font-black py-1.5 rounded-lg hover:bg-red-700 transition-colors shadow-md shadow-red-100 whitespace-nowrap overflow-hidden text-ellipsis`;
                    deleteBtn.textContent = '删除';
                    deleteBtn.onclick = (e) => {
                        e.stopPropagation();
                        this.deleteCandidate(candidate.id);
                    };

                    actionButtonsWrapper.appendChild(reactivateBtn);
                    actionButtonsWrapper.appendChild(deleteBtn);
                } else {
                    // View button
                    const viewBtn = document.createElement('button');
                    viewBtn.type = 'button';
                    viewBtn.className = `flex-1 bg-white border border-gray-200 text-gray-700 text-[10px] font-black py-1.5 rounded-lg hover:bg-gray-50 transition-colors shadow-sm whitespace-nowrap overflow-hidden text-ellipsis`;
                    viewBtn.textContent = '查看';
                    viewBtn.onclick = (e) => {
                        e.stopPropagation();
                        this.viewResume(candidate.resumeId);
                    };

                    // AI / Next action button
                    const nextBtn = document.createElement('button');
                    nextBtn.type = 'button';
                    nextBtn.className = `flex-1 bg-blue-600 text-white text-[10px] font-black py-1.5 rounded-lg hover:bg-blue-700 transition-colors shadow-md shadow-blue-100 whitespace-nowrap overflow-hidden text-ellipsis`;
                    
                    if (!hasScore) {
                        nextBtn.innerHTML = `<i class="fas fa-robot mr-1"></i> AI 快评`;
                        nextBtn.onclick = (e) => {
                            e.stopPropagation();
                            this.handleDeepAnalysis(candidate.resumeId);
                        };
                    } else {
                        nextBtn.textContent = nextActionText;
                        nextBtn.onclick = (e) => {
                            e.stopPropagation();
                            this.advanceCandidate(candidate.id);
                        };
                    }

                // Reject button
                const rejectBtn = document.createElement('button');
                rejectBtn.type = 'button';
                rejectBtn.className = `text-[11px] font-bold text-gray-400 hover:text-blue-600 transition-colors whitespace-nowrap bg-transparent cursor-pointer outline-none z-20 hover:underline underline-offset-4 px-2 border-none shadow-none`;
                rejectBtn.textContent = '淘汰';
                rejectBtn.title = '将该候选人移入淘汰池';
                // 使用唯一 ID 确保点击事件正确触发
                rejectBtn.id = `reject-btn-${candidate.id}`;
                rejectBtn.setAttribute('data-candidate-id', candidate.id);
                rejectBtn.onclick = (e) => {
                    console.log('%c[Action] Reject Button Element Clicked', 'color: #ef4444; font-weight: bold', 'Candidate ID:', candidate.id);
                    e.stopPropagation();
                    e.preventDefault();
                    if (window.recruitmentFlowController && typeof window.recruitmentFlowController.openRejectModal === 'function') {
                        window.recruitmentFlowController.openRejectModal(candidate.id);
                    } else {
                        console.error('[Frontend] recruitmentFlowController.openRejectModal not found');
                        // Fallback
                        this.openRejectModal(candidate.id);
                    }
                };

                    actionButtonsWrapper.appendChild(viewBtn);
                    actionButtonsWrapper.appendChild(nextBtn);
                    actionButtonsWrapper.appendChild(rejectBtn);
                }

                overlay.appendChild(actionButtonsWrapper);

                card.innerHTML = `
                    <div class="flex justify-between items-start mb-2">
                        <div class="flex flex-wrap gap-1">
                            ${tags.map(tag => `
                                <span class="inline-flex items-center text-[8px] font-black px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-100/50">
                                    ${tag}
                                </span>
                            `).join('')}
                            ${!hasScore ? `
                                <span class="inline-flex items-center text-[8px] font-black px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded border border-gray-200">
                                    待快评
                                </span>
                            ` : ''}
                        </div>
                        <i class="fa-solid fa-grip-lines text-gray-100 group-hover:text-gray-200 text-[10px] transition-colors"></i>
                    </div>

                    <div class="flex items-center space-x-3 mt-2">
                        ${avatarHtml}
                        <div class="min-w-0 flex-1">
                            <h4 class="text-[12px] font-black text-gray-900 truncate">${candidate.name}</h4>
                            <p class="text-[10px] font-bold text-gray-400 truncate">${candidate.education} · ${candidate.experience}</p>
                        </div>
                        <div class="text-right shrink-0">
                            <div class="text-[11px] font-black ${!hasScore ? 'text-gray-400' : (candidate.score >= 90 ? 'text-green-600' : 'text-blue-600')}">
                                ${hasScore ? candidate.score : '--'}
                            </div>
                        </div>
                    </div>
                `;

                // Append overlay AFTER innerHTML to preserve listeners
                card.appendChild(overlay);
                
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
        const filtered = this.state.candidates;
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
                <div class="flex items-center gap-4 bg-white/60 backdrop-blur-sm border border-slate-200/60 rounded-2xl px-5 py-2 shadow-sm transition-all hover:border-blue-200 hover:shadow-md group">
                    <div class="flex items-center">
                        <div class="w-2 h-2 rounded-full bg-blue-600 mr-1.5 shadow-sm shadow-blue-200"></div>
                        <span class="text-[11px] font-black text-gray-400 mr-1.5 uppercase tracking-wider">候选人</span>
                        <span class="text-sm font-black text-slate-900">${stats.total}</span>
                    </div>
                    <div class="w-px h-3 bg-slate-200"></div>
                    <div class="flex items-center">
                        <div class="w-2 h-2 rounded-full bg-purple-600 mr-1.5 shadow-sm shadow-purple-200"></div>
                        <span class="text-[11px] font-black text-gray-400 mr-1.5 uppercase tracking-wider">面试中</span>
                        <span class="text-sm font-black text-slate-900">${stats.interview}</span>
                    </div>
                    <div class="w-px h-3 bg-slate-200"></div>
                    <div class="flex items-center">
                        <div class="w-2 h-2 rounded-full bg-indigo-600 mr-1.5 shadow-sm shadow-indigo-200"></div>
                        <span class="text-[11px] font-black text-gray-400 mr-1.5 uppercase tracking-wider">录用中</span>
                        <span class="text-sm font-black text-slate-900">${stats.offer}</span>
                    </div>
                    <div class="w-px h-3 bg-slate-200"></div>
                    <div class="flex items-center">
                        <div class="w-2 h-2 rounded-full bg-emerald-600 mr-1.5 shadow-sm shadow-emerald-200"></div>
                        <span class="text-[11px] font-black text-gray-400 mr-1.5 uppercase tracking-wider">已录用</span>
                        <span class="text-sm font-black text-slate-900">${stats.hired}</span>
                    </div>
                    <div class="w-px h-3 bg-slate-200"></div>
                    <div class="flex items-center">
                        <div class="w-2 h-2 rounded-full bg-red-600 mr-1.5 shadow-sm shadow-red-200"></div>
                        <span class="text-[11px] font-black text-gray-400 mr-1.5 uppercase tracking-wider">已淘汰</span>
                        <span class="text-sm font-black text-slate-900">${stats.rejected}</span>
                    </div>
                </div>
            `;
        }
    },

    // --- Actions ---
    switchJob(jobId) {
        console.log('切换职位到:', jobId);
        if (jobId) {
            this.state.currentJobId = jobId;
        }

        // 重新加载数据
        this.loadData().then(() => {
            // 重新渲染看板和统计
            this.renderBoard();
            this.updateStats();
        });
    },

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

    // 独立出打开弹窗的逻辑，确保可以被直接调用
    openRejectModal(candidateId) {
        console.log('%c[Action] openRejectModal called', 'color: #3b82f6; font-weight: bold', 'Candidate ID:', candidateId);
        
        // 1. 设置状态
        this.state.currentRejectId = candidateId;
        
        // 2. 获取 DOM 元素
        let modal = document.getElementById('rejectModal');
        const reasonInput = document.getElementById('rejectReason');
        
        // 3. 校验并移动到 body (解决父级 overflow:hidden 或 transform 导致的 z-index/fixed 失效)
        if (!modal) {
            console.error('[Frontend] rejectModal element NOT FOUND');
            return;
        }

        if (modal.parentElement !== document.body) {
            console.log('[Frontend] Moving modal to body to ensure visibility');
            document.body.appendChild(modal);
        }

        // 4. 显示弹窗
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        modal.style.zIndex = '10000'; // 稍微提高一点
        
        // 5. 重置输入框并聚焦
        if (reasonInput) {
            reasonInput.value = '';
            setTimeout(() => {
                reasonInput.focus();
            }, 100);
        }

        console.log('[Frontend] Modal should now be visible');
    },

    closeRejectModal() {
        const modal = document.getElementById('rejectModal');
        if (modal) {
            modal.classList.add('hidden');
            modal.style.display = 'none';
        }
    },

    async confirmReject() {
        console.log('[Frontend] confirmReject started', { currentRejectId: this.state.currentRejectId });
        if (!this.state.currentRejectId) return;
        
        const reasonInput = document.getElementById('rejectReason');
        const notes = reasonInput ? reasonInput.value : '';
        const confirmBtn = document.getElementById('confirmRejectBtn');
        
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>处理中...';
        }
        
        try {
            const result = await window.resumeDataManager.updateRecruitmentStatus(this.state.currentRejectId, '淘汰', notes);
            console.log('[Frontend] Update status result:', result);
            
            if (result) {
                this.closeRejectModal();
                // 强制重新加载数据
                await this.loadData();
                // 确保 UI 更新
                this.renderBoard();
                this.updateStats();
                
                // 发送状态更新通知 (如果有的话)
                if (window.showToast) {
                    window.showToast('候选人已移入淘汰池', 'success');
                }
            } else {
                throw new Error('API 返回失败');
            }
        } catch (error) {
            console.error('[Frontend] Failed to reject candidate:', error);
            if (window.showToast) {
                window.showToast('操作失败：' + (error.message || '未知错误'), 'error');
            }
            alert('操作失败，请重试');
        } finally {
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = '确认淘汰';
            }
        }
    },

    handleReject(candidateId) {
        this.openRejectModal(candidateId);
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
        if (!candidate) {
            console.error('[Frontend] Candidate not found for id:', id);
            return;
        }

        console.log('[Frontend] Advancing candidate:', { id, name: candidate.name, currentStatus: candidate.status, targetStatus });

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
            'applied': '待快评',
            'screening': '已快评',
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

    viewResume(resumeId) {
        const rid = resumeId === null || resumeId === undefined ? '' : String(resumeId);
        if (rid) {
            window.location.href = `resume-details.html?id=${encodeURIComponent(rid)}`;
            return;
        }
        if (typeof window !== 'undefined' && window.ui && window.ui.showAlert) {
            window.ui.showAlert('无法找到简历ID', { type: 'error' });
        }
    },

    // Modal Management
    async openAddCandidateModal() {
        if (!this.state.jobs || this.state.jobs.length <= 1) {
            await this.loadData();
        }
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
             const targetJobId = String(jobId);
             const existingResumeIds = new Set(
                 (this.state.candidates || [])
                     .filter(c => String(c.jobId) === targetJobId)
                     .map(c => String(c.resumeId))
             );
             return (resumes || [])
                 .filter(r => r && r.id !== undefined && r.id !== null)
                 .filter(r => !existingResumeIds.has(String(r.id)))
                 .map(r => ({
                     id: r.id,
                     name: r.name || r.file_name || '未命名候选人'
                 }));
        } catch (error) {
            console.error('Failed to load candidates', error);
            return [];
        }
    },

    updateRadioStyles(type) {
        const labelOnline = document.getElementById('type-online-label');
        const labelOnsite = document.getElementById('type-onsite-label');
        if (!labelOnline || !labelOnsite) return;

        const isOnline = type === 'online';
        
        // Online Label
        if (isOnline) {
            labelOnline.className = "relative flex items-center justify-center p-4 border rounded-xl cursor-pointer transition-all border-blue-200 bg-blue-50 ring-2 ring-blue-500";
            const iconOnline = document.getElementById('icon-online');
            const textOnline = document.getElementById('text-online');
            const checkOnline = document.getElementById('check-online');
            if (iconOnline) iconOnline.className = "fas fa-robot text-2xl text-blue-600";
            if (textOnline) textOnline.className = "text-sm font-bold text-blue-900";
            if (checkOnline) checkOnline.classList.remove('hidden');
            
            // Onsite Label Reset
            labelOnsite.className = "relative flex items-center justify-center p-4 border rounded-xl cursor-pointer hover:bg-gray-50 transition-all border-gray-200";
            const iconOnsite = document.getElementById('icon-onsite');
            const textOnsite = document.getElementById('text-onsite');
            const checkOnsite = document.getElementById('check-onsite');
            if (iconOnsite) iconOnsite.className = "fas fa-building text-2xl text-gray-400";
            if (textOnsite) textOnsite.className = "text-sm font-bold text-gray-600";
            if (checkOnsite) checkOnsite.classList.add('hidden');
        } else {
            // Onsite Label Active
            labelOnsite.className = "relative flex items-center justify-center p-4 border rounded-xl cursor-pointer transition-all border-blue-200 bg-blue-50 ring-2 ring-blue-500";
            const iconOnsite = document.getElementById('icon-onsite');
            const textOnsite = document.getElementById('text-onsite');
            const checkOnsite = document.getElementById('check-onsite');
            if (iconOnsite) iconOnsite.className = "fas fa-building text-2xl text-blue-600";
            if (textOnsite) textOnsite.className = "text-sm font-bold text-blue-900";
            if (checkOnsite) checkOnsite.classList.remove('hidden');

            // Online Label Reset
            labelOnline.className = "relative flex items-center justify-center p-4 border rounded-xl cursor-pointer hover:bg-gray-50 transition-all border-gray-200";
            const iconOnline = document.getElementById('icon-online');
            const textOnline = document.getElementById('text-online');
            const checkOnline = document.getElementById('check-online');
            if (iconOnline) iconOnline.className = "fas fa-robot text-2xl text-gray-400";
            if (textOnline) textOnline.className = "text-sm font-bold text-gray-600";
            if (checkOnline) checkOnline.classList.add('hidden');
        }
    },

    async openModal(type, candidateId) {
        const modal = document.getElementById(`${type}Modal`);
        if (modal) {
            modal.classList.remove('hidden');
            modal.dataset.candidateId = candidateId;
            // Reset form if exists
            const form = modal.querySelector('form');
            if (form) {
                form.reset();
                // If it's interview modal, trigger default radio styles
                if (type === 'interview') {
                    const onlineRadio = form.querySelector('input[name="type"][value="online"]');
                    if (onlineRadio) {
                        onlineRadio.checked = true;
                        this.updateRadioStyles('online');
                        
                        // Also handle address input default for online
                        const locationInput = form.querySelector('input[name="location"]');
                        if (locationInput) {
                            locationInput.value = '线上AI面试';
                            locationInput.readOnly = true;
                            locationInput.classList.add('bg-gray-50');
                        }
                    }
                }
            }
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
                if (modal) {
                    modal.classList.add('hidden');
                    modal.style.display = 'none';
                }
            });
        });

        // Click outside modal to close
        window.addEventListener('click', (event) => {
            if (event.target.classList.contains('bg-black/50') || event.target.classList.contains('fixed')) {
                // If it's a backdrop or the modal container itself
                if (event.target.id === 'rejectModal' || event.target.id === 'interviewModal' || event.target.id === 'offerModal' || event.target.id === 'addCandidateModal') {
                    event.target.classList.add('hidden');
                    event.target.style.display = 'none';
                }
            }
        });

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
                    
                    // 为指定职位添加候选人，后端应处理关联逻辑
                    // 这里的 resumeId 是 Resume ID，后端需要创建或更新 ResumeJob
                    await resumeDataManager.apiRequest(`/recruitment/resumes/${resumeId}/apply`, 'POST', { jobId });
                    
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

                // 从详情区域获取手机号和邮箱
                const phone = document.getElementById('resume-phone')?.textContent?.trim() || '';
                const email = document.getElementById('resume-email')?.textContent?.trim() || '';

                const data = {
                    datetime: formData.get('datetime'),
                    channel: formData.get('channel') || formData.get('type') || 'offline',
                    location: formData.get('location') || '',
                    note: formData.get('note') || formData.get('notes') || '',
                    aiQuestionCount: parseInt(formData.get('aiQuestionCount') || '8', 10),
                    phone: phone,
                    email: email
                };
                console.log('[Frontend] Interview data:', data);
                
                try {
                    if (typeof ErrorHandler !== 'undefined') ErrorHandler.showLoading(true);
                    
                    const result = await resumeDataManager.scheduleInterview(id, {
                        datetime: data.datetime,
                        channel: data.channel,
                        aiQuestionCount: data.aiQuestionCount,
                        location: data.location || '',
                        note: (data.interviewer ? `面试官: ${data.interviewer}\n` : '') + (data.note || ''),
                        phone: data.phone,
                        email: data.email
                    });
                    
                    if (typeof window !== 'undefined' && window.ui && window.ui.showAlert) {
                        const n = result && result.notifications ? result.notifications : null;
                        const smsText = n ? (n.sms.sent ? '短信已发送' : (n.sms.skipped ? '短信已跳过' : (n.sms.attempted ? '短信发送失败/未配置' : '短信未发送'))) : '短信/邮件按配置发送';
                        const emailText = n ? (n.email.sent ? '邮件已发送' : (n.email.skipped ? '邮件已跳过' : (n.email.attempted ? '邮件发送失败/未配置' : '邮件未发送'))) : '';
                        const msg = ['面试已成功安排', smsText, emailText].filter(Boolean).join('，');
                        window.ui.showAlert(msg, { type: 'success' });
                    }
                    const candidate = this.state.candidates.find(c => c.id === id);
                    if (candidate) {
                        candidate.status = 'interview';
                        this.renderBoard();
                        this.updateStats();
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

                // 从详情区域获取手机号和邮箱
                const phone = document.getElementById('resume-phone')?.textContent?.trim() || '';
                const email = document.getElementById('resume-email')?.textContent?.trim() || '';

                try {
                    const result = await resumeDataManager.sendOffer(id, {
                        message: data.content || '恭喜您通过面试，我们向您发出录用意向。',
                        phone: phone,
                        email: email
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

    // --- Standard Interaction Handlers ---
    handleDeepAnalysis(resumeId) {
        this.currentAnalysisId = resumeId;
        const modal = document.getElementById('analysisModal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    },

    closeAnalysisModal() {
        const modal = document.getElementById('analysisModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    },

    async confirmDeepAnalysis() {
        if (!this.currentAnalysisId) return;
        
        try {
            if (typeof ui !== 'undefined' && typeof ui.showLoading === 'function') {
                ui.showLoading('正在启动深度解析...');
            } else if (typeof ErrorHandler !== 'undefined') {
                ErrorHandler.showLoading(true);
            }

            // 发送请求前，记录当前 resumeId
            const resumeId = this.currentAnalysisId;
            console.log('🚀 启动深度解析, resumeId:', resumeId);

            const result = await userAuthInstance.apiRequest('/ai/analyze', 'POST', { 
                resumeId: resumeId // 使用正确的参数名
            });
            
            if (result.success) {
                if (window.ui && window.ui.showNotification) {
                    window.ui.showNotification('深度解析任务已启动', 'success');
                } else if (window.ui && window.ui.showAlert) {
                    window.ui.showAlert('深度解析任务已启动', { type: 'success' });
                }
                this.closeAnalysisModal();
                // 重定向到详情页，优先使用 record_id
                const recordId = result.data.record_id || result.data.id;
                setTimeout(() => {
                    window.location.href = `analysis-detail.html?id=${recordId}`;
                }, 1000);
            } else {
                const errorMsg = result.error?.message || result.error || '未知错误';
                if (window.ui && window.ui.showNotification) {
                    window.ui.showNotification('启动解析失败: ' + errorMsg, 'error');
                } else if (window.ui && window.ui.showAlert) {
                    window.ui.showAlert('启动解析失败: ' + errorMsg, { type: 'error' });
                }
            }
        } catch (e) {
            console.error('Deep analysis error:', e);
            // 改进错误提示，如果是 404，可能是 API 路径问题
            let errorMsg = e.message || '网络连接失败，请检查网络后重试';
            if (e.status === 404) {
                errorMsg = 'API 接口未找到 (404)，请联系管理员确认后端服务状态';
            }
            
            if (window.ui && window.ui.showNotification) {
                window.ui.showNotification(errorMsg, 'error');
            } else if (window.ui && window.ui.showAlert) {
                window.ui.showAlert(errorMsg, { type: 'error' });
            }
        } finally {
            if (typeof ui !== 'undefined' && typeof ui.hideLoading === 'function') {
                ui.hideLoading();
            } else if (typeof ErrorHandler !== 'undefined') {
                ErrorHandler.showLoading(false);
            }
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

// Expose to global scope
window.recruitmentFlowController = recruitmentFlowController;
console.log('[Frontend] RecruitmentFlowController loaded and exposed to window');

