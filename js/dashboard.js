/**
 * 仪表盘页面控制器
 * 负责加载和显示仪表盘数据、图表和交互逻辑
 */
class DashboardController {
    constructor() {
        this.resumeData = new ResumeDataManager();
        this.charts = {};
        this.init();
    }

    async init() {
        try {
            // 初始化UI组件
            this.initializeDateDisplay();
            
            // 加载数据
            await Promise.all([
                this.loadStats(),
                this.loadFunnelChart(),
                this.loadPendingTasks(),
                this.loadRecentActivities(),
                this.loadAIPrediction()
            ]);

            // 初始化AI助手
            this.initAIAssistant();

            // 引导流程
            this.initOnboardingWizard();
            
            console.log('Dashboard initialized successfully');
        } catch (error) {
            console.error('Dashboard initialization failed:', error);
            // 显示错误提示
        }
    }

    initializeDateDisplay() {
        const dateEl = document.getElementById('current-date');
        if (dateEl) {
            const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
            dateEl.textContent = new Date().toLocaleDateString('zh-CN', options);
        }
        const gEl = document.getElementById('greeting');
        const uEl = document.getElementById('user-id');
        if (gEl) {
            const h = new Date().getHours();
            let g = '早安';
            if (h < 6) g = '晚上好';
            else if (h < 9) g = '早安';
            else if (h < 12) g = '上午好';
            else if (h < 18) g = '下午好';
            else g = '晚上好';
            gEl.textContent = g;
        }
        if (uEl) {
            let name = '';
            try {
                if (window.userAuthInstance && typeof window.userAuthInstance.getCurrentUser === 'function') {
                    const u = window.userAuthInstance.getCurrentUser();
                    const un = u && u.username ? String(u.username).trim() : '';
                    if (un) name = un;
                }
                if (!name) {
                    const raw = localStorage.getItem('userInfo') || '{}';
                    const obj = JSON.parse(raw);
                    const u = obj.user || obj;
                    const un = (u && u.username) ? String(u.username).trim() : '';
                    if (un) name = un;
                }
            } catch (_) {}
            uEl.textContent = name || '显示ID';
        }
    }

    async loadStats() {
        try {
            const stats = await this.resumeData.getDashboardStats();
            
            this.updateStatCard('stat-candidates', stats.total_candidates, `今日新增 ${stats.new_candidates_today}`);
            this.updateStatCard('stat-jobs', stats.active_jobs, '招聘进行中');
            this.updateStatCard('stat-interviews', stats.interviews_scheduled, '待面试');
            this.updateStatCard('stat-offers', stats.offers_sent, '待入职');
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    }

    updateStatCard(id, value, subtitle) {
        const el = document.getElementById(id);
        if (el) {
            el.querySelector('.stat-value').textContent = value;
            el.querySelector('.stat-subtitle').textContent = subtitle;
        }
    }

    async loadFunnelChart() {
        const container = document.getElementById('recruitmentFunnelChart');
        if (!container) return;
        
        // Remove canvas if it exists (we are replacing it with HTML bars)
        const canvas = container.tagName === 'CANVAS' ? container : container.querySelector('canvas');
        let parent = container;
        if (canvas) {
             parent = canvas.parentElement;
             canvas.remove();
        }
        
        // Create a new container for the bars if needed
        const funnelContainer = document.createElement('div');
        funnelContainer.className = 'flex flex-col space-y-3 w-full h-full justify-center';
        parent.appendChild(funnelContainer);

        try {
            // 获取真实漏斗数据
            const pipeline = await this.resumeData.getRecruitmentPipeline();
            
            // 处理数据
            const stages = {
                'applied': { count: 0, label: '投递', color: 'bg-blue-100', text: 'text-blue-700', width: '100%' },
                'screening': { count: 0, label: '初筛', color: 'bg-blue-200', text: 'text-blue-800', width: '85%' },
                'interview': { count: 0, label: '面试', color: 'bg-blue-300', text: 'text-blue-900', width: '70%' },
                'offer': { count: 0, label: 'Offer', color: 'bg-indigo-300', text: 'text-indigo-900', width: '55%' },
                'hired': { count: 0, label: '入职', color: 'bg-indigo-500', text: 'text-white', width: '40%' }
            };

            pipeline.forEach(item => {
                if (stages.hasOwnProperty(item.status)) {
                    stages[item.status].count++;
                }
            });
            
            // Calculate cumulative counts for funnel effect
            let currentCount = 0;
            // Reverse iteration to accumulate
            const stageKeys = ['hired', 'offer', 'interview', 'screening', 'applied'];
            stageKeys.forEach(key => {
                 currentCount += stages[key].count;
                 stages[key].cumulative = currentCount;
            });

            // Render HTML bars
            const stageOrder = ['applied', 'screening', 'interview', 'offer', 'hired'];
            
            funnelContainer.innerHTML = stageOrder.map(key => {
                const s = stages[key];
                return `
                <div class="relative w-full">
                    <div class="flex items-center mb-1 justify-between text-xs text-gray-600 px-1">
                        <span class="font-medium">${s.label}</span>
                        <span>${s.cumulative} 人</span>
                    </div>
                    <div class="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
                        <div class="${s.color} h-4 rounded-full transition-all duration-1000 ease-out" style="width: ${s.width}"></div>
                    </div>
                </div>
                `;
            }).join('');
            
        } catch (error) {
            console.error('Failed to load funnel chart:', error);
            if (parent) parent.innerHTML = '<div class="text-center text-gray-400 py-8">暂无数据</div>';
        }
    }

    async loadPendingTasks() {
        const container = document.getElementById('pending-tasks-list');
        if (!container) return;

        try {
            const tasks = await this.resumeData.getPendingTasks();
            
            const detailedTasks = [];
            
            tasks.forEach(t => {
                // If API returns detailed items, use them
                if (t.items && Array.isArray(t.items) && t.items.length > 0) {
                    t.items.forEach(item => {
                        let detail = {
                             title: t.title,
                             desc: item.desc || '未命名任务',
                             time: item.time ? new Date(item.time).toLocaleDateString() : '今天',
                             link: t.link,
                             priority: t.priority,
                             type: t.type
                        };
                        
                        if (t.type === 'review') {
                            detail.action = '去筛选';
                        } else if (t.type === 'interview') {
                            detail.action = '查看详情';
                        } else if (t.type === 'offer') {
                            detail.action = '审批';
                        } else {
                            detail.action = '查看';
                        }
                        detailedTasks.push(detail);
                    });
                } else {
                    // Fallback for mock data (count only)
                    for(let i=0; i < Math.min(t.count, 3); i++) {
                        let detail = {
                             title: t.title,
                             desc: '待处理',
                             time: '今天',
                             link: t.link,
                             priority: t.priority,
                             type: t.type
                        };
                        
                        if (t.type === 'review') {
                            detail.desc = ['Java工程师 - 张三', '产品经理 - 李四', '前端开发 - 王五'][i] || '新候选人';
                            detail.action = '去筛选';
                        } else if (t.type === 'interview') {
                            detail.desc = ['10:00 - 张三 (视频面试)', '14:30 - 李四 (现场面试)'][i] || '待定时间';
                            detail.action = '查看详情';
                        } else if (t.type === 'offer') {
                            detail.desc = '王五 - 高级工程师';
                            detail.action = '审批';
                        } else {
                            detail.desc = '系统自动任务';
                            detail.action = '查看';
                        }
                        detailedTasks.push(detail);
                    }
                }
            });

            // Sort by priority
            const priorityOrder = { 'high': 0, 'medium': 1, 'low': 2 };
            detailedTasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

            const reviewItems = detailedTasks.filter(t => t.type === 'review');
            const workflowItems = detailedTasks.filter(t => t.type === 'interview' || t.type === 'offer');

            const renderItem = (task) => `
                <div class="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl hover:shadow-md transition-all">
                    <div class="flex-1 min-w-0">
                        <h4 class="text-sm font-bold text-gray-900 whitespace-normal">${task.desc}</h4>
                        <p class="text-xs text-gray-500 mt-0.5">${task.title} · ${task.time}</p>
                    </div>
                    <button onclick="window.location.href='${task.link}'" class="ml-4 shrink-0 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100">
                        ${task.action}
                    </button>
                </div>
            `;

            container.innerHTML = `
                <div class="space-y-4">
                    <div>
                        <div class="flex items-center mb-2">
                            <span class="text-sm font-bold text-gray-800">待筛选简历</span>
                            <span class="ml-2 text-xs text-gray-500">${reviewItems.length} 条</span>
                        </div>
                        <div class="space-y-3">
                            ${reviewItems.map(renderItem).join('') || '<div class="text-xs text-gray-500">暂无任务</div>'}
                        </div>
                    </div>
                    <div>
                        <div class="flex items-center mb-2">
                            <span class="text-sm font-bold text-gray-800">待确认的流程节点</span>
                            <span class="ml-2 text-xs text-gray-500">${workflowItems.length} 条</span>
                        </div>
                        <div class="space-y-3">
                            ${workflowItems.map(renderItem).join('') || '<div class="text-xs text-gray-500">暂无任务</div>'}
                        </div>
                    </div>
                </div>
            `;
            
        } catch (error) {
            console.error('Failed to load pending tasks:', error);
            container.innerHTML = '<div class="text-sm text-gray-500 text-center py-4">暂无待办事项</div>';
        }
    }

    async loadAIPrediction() {
        const el = document.getElementById('ai-prediction-content');
        const rangeSelect = document.getElementById('ai-prediction-range');
        if (!el) return;
        
        const render = (data) => {
            if (!data || !data.ai_analysis) {
                el.innerHTML = '<div class="flex items-center justify-center h-full text-gray-400">暂无预测数据</div>';
                return;
            }

            const analysis = data.ai_analysis;
            // 处理可能的字符串数据（防止JSON解析失败时的降级显示）
            const getList = (arr) => Array.isArray(arr) ? arr : [];

            el.innerHTML = `
                <div class="flex flex-col gap-4">
                    <!-- 趋势分析 -->
                    <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div class="flex items-center mb-2 pb-2 border-b border-gray-100">
                            <i class="fas fa-chart-line text-gray-400 mr-2"></i>
                            <h4 class="font-bold text-gray-800 text-sm">招聘趋势预测</h4>
                        </div>
                        <p class="text-sm text-gray-600 leading-relaxed text-justify mt-2">${analysis.trend_analysis || '暂无分析'}</p>
                    </div>

                    <!-- 漏斗健康度 -->
                    <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                         <div class="flex items-center mb-2 pb-2 border-b border-gray-100">
                            <i class="fas fa-heartbeat text-gray-400 mr-2"></i>
                            <h4 class="font-bold text-gray-800 text-sm">漏斗健康度</h4>
                        </div>
                        <p class="text-sm text-gray-600 leading-relaxed text-justify mt-2">${analysis.pipeline_health || '暂无评价'}</p>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <!-- 潜在瓶颈 -->
                        <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                             <div class="flex items-center mb-2 pb-2 border-b border-gray-100">
                                <i class="fas fa-exclamation-circle text-gray-400 mr-2 text-xs"></i>
                                <h4 class="font-bold text-gray-800 text-sm">潜在瓶颈</h4>
                            </div>
                            <ul class="list-disc list-inside text-xs text-gray-600 space-y-2 mt-2">
                                ${getList(analysis.potential_bottlenecks).map(b => `<li>${b}</li>`).join('') || '<li class="text-gray-400">未发现明显瓶颈</li>'}
                            </ul>
                        </div>

                        <!-- 改进建议 -->
                        <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                             <div class="flex items-center mb-2 pb-2 border-b border-gray-100">
                                <i class="fas fa-lightbulb text-gray-400 mr-2 text-xs"></i>
                                <h4 class="font-bold text-gray-800 text-sm">改进建议</h4>
                            </div>
                             <ul class="list-disc list-inside text-xs text-gray-600 space-y-2 mt-2">
                                ${getList(analysis.suggestions).map(s => `<li>${s}</li>`).join('') || '<li class="text-gray-400">暂无建议</li>'}
                            </ul>
                        </div>
                    </div>
                </div>
            `;
        };
        const fetchAndRender = async (period) => {
            try {
                const data = await this.resumeData.getAIPrediction(period);
                render(data);
            } catch (e) {
                render(null);
            }
        };
        await fetchAndRender(rangeSelect ? rangeSelect.value : '7d');
        if (rangeSelect) {
            rangeSelect.addEventListener('change', () => fetchAndRender(rangeSelect.value));
        }
    }
    
    getTaskIcon(type) {
        switch(type) {
            case 'review': return 'fas fa-search';
            case 'interview': return 'fas fa-video';
            case 'offer': return 'fas fa-file-signature';
            default: return 'fas fa-tasks';
        }
    }
    
    getTaskIconBg(type) {
        switch(type) {
            case 'review': return 'bg-blue-500';
            case 'interview': return 'bg-purple-500';
            case 'offer': return 'bg-green-500';
            default: return 'bg-gray-400';
        }
    }

    getPriorityColor(priority) {
        switch (priority) {
            case 'high': return 'bg-red-500';
            case 'medium': return 'bg-yellow-500';
            case 'low': return 'bg-green-500';
            default: return 'bg-gray-400';
        }
    }

    async loadRecentActivities() {
        // 简单模拟或从API获取最近活动
        // 这里暂时留空或简单的静态展示，后续可从UserActivity获取
    }

    initAIAssistant() {
        const chatContainer = document.getElementById('ai-chat-widget');
        if (!chatContainer) return;

        // 这里可以初始化内嵌的AI聊天组件
        // 如果是iframe或者简单的输入框
        
        const input = document.getElementById('ai-quick-input');
        const btn = document.getElementById('ai-quick-send');
        
        if (input && btn) {
            const sendMsg = () => {
                const text = input.value.trim();
                if (!text) return;
                
                // 跳转到AI助手页面并带上问题，或者直接在这里显示回复
                // 为了保留完整体验，我们这里演示跳转
                window.location.href = `assistant-chat.html?initialQuery=${encodeURIComponent(text)}`;
            };

            btn.addEventListener('click', sendMsg);
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') sendMsg();
            });
        }
    }

    initOnboardingWizard() {
        const modal = document.getElementById('onboarding-modal');
        if (!modal) return;
        const closeBtn = document.getElementById('onboarding-close');
        const steps = [
            { ind: document.getElementById('step-ind-1'), pane: document.getElementById('onb-step-1') },
            { ind: document.getElementById('step-ind-2'), pane: document.getElementById('onb-step-2') },
            { ind: document.getElementById('step-ind-3'), pane: document.getElementById('onb-step-3') }
        ];
        const showStep = (i) => {
            steps.forEach((s, idx) => {
                const active = idx === i;
                s.pane.classList.toggle('hidden', !active);
                s.ind.className = active
                    ? 'flex items-center p-3 rounded-lg border border-blue-200 bg-blue-50'
                    : 'flex items-center p-3 rounded-lg border border-gray-200';
                const num = s.ind.querySelector('div');
                if (num) num.className = active
                    ? 'w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs mr-2'
                    : 'w-6 h-6 rounded-full bg-gray-400 text-white flex items-center justify-center text-xs mr-2';
            });
        };
        const open = () => { modal.classList.remove('hidden'); modal.classList.add('flex'); showStep(0); };
        const close = () => { modal.classList.add('hidden'); modal.classList.remove('flex'); };
        if (closeBtn) closeBtn.addEventListener('click', () => { close(); localStorage.setItem('firstSetupRequired','0'); });

        // 填充显示ID与头像预览
        const idInput = document.getElementById('onb-user-id');
        if (idInput) {
            try {
                idInput.value = (typeof HeaderProfile !== 'undefined' && HeaderProfile.getDisplayId) ? HeaderProfile.getDisplayId() : '用户';
            } catch(_) { idInput.value = '用户'; }
        }
        const avatarInput = document.getElementById('onb-avatar');
        const avatarPrev = document.getElementById('onb-avatar-preview');
        const avatarIcon = document.getElementById('onb-avatar-icon');
        const fileNameDisplay = document.getElementById('file-name-display');
        const cropModal = document.getElementById('avatar-crop-modal');
        const cropCanvas = document.getElementById('avatar-crop-canvas');
        const cropApply = document.getElementById('avatar-crop-apply');
        const cropCancel = document.getElementById('avatar-crop-cancel');
        const cropZoom = document.getElementById('avatar-crop-zoom');
        const cropOpenBtn = document.getElementById('avatar-crop-open');
        let cropImg = null;
        let baseScale = 1;
        let sel = { x: 50, y: 50, size: 200 };
        let dragging = false;
        let dragMode = null; // 'move', 'nw', 'ne', 'sw', 'se'
        let dragOffset = { x: 0, y: 0 };
        let dragStartSize = 0;
        let dragStartPos = { x: 0, y: 0 };
        
        const getEffectiveScale = () => {
             const zoom = parseFloat(cropZoom?.value || '1');
             return baseScale * zoom;
        };

        const drawCrop = () => {
            if (!cropCanvas || !cropImg) return;
            const ctx = cropCanvas.getContext('2d');
            const w = cropCanvas.width;
            const h = cropCanvas.height;
            ctx.clearRect(0,0,w,h);
            
            const scale = getEffectiveScale();
            const iw = cropImg.width * scale;
            const ih = cropImg.height * scale;
            const ix = (w - iw) / 2;
            const iy = (h - ih) / 2;
            
            // Draw image
            ctx.drawImage(cropImg, ix, iy, iw, ih);
            
            // Draw semi-transparent overlay around the selection
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            // Top
            ctx.fillRect(0, 0, w, sel.y);
            // Bottom
            ctx.fillRect(0, sel.y + sel.size, w, h - (sel.y + sel.size));
            // Left
            ctx.fillRect(0, sel.y, sel.x, sel.size);
            // Right
            ctx.fillRect(sel.x + sel.size, sel.y, w - (sel.x + sel.size), sel.size);
            
            // Draw selection border
            ctx.strokeStyle = '#3B82F6';
            ctx.lineWidth = 2;
            ctx.strokeRect(sel.x, sel.y, sel.size, sel.size);
            
            // Draw grid lines
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 1;
            ctx.moveTo(sel.x + sel.size/3, sel.y); ctx.lineTo(sel.x + sel.size/3, sel.y + sel.size);
            ctx.moveTo(sel.x + 2*sel.size/3, sel.y); ctx.lineTo(sel.x + 2*sel.size/3, sel.y + sel.size);
            ctx.moveTo(sel.x, sel.y + sel.size/3); ctx.lineTo(sel.x + sel.size, sel.y + sel.size/3);
            ctx.moveTo(sel.x, sel.y + 2*sel.size/3); ctx.lineTo(sel.x + sel.size, sel.y + 2*sel.size/3);
            ctx.stroke();

            // Draw handles
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#3B82F6';
            ctx.lineWidth = 2;
            const handleSize = 10;
            const hs2 = handleSize / 2;
            
            const handles = [
                { x: sel.x - hs2, y: sel.y - hs2 }, // nw
                { x: sel.x + sel.size - hs2, y: sel.y - hs2 }, // ne
                { x: sel.x - hs2, y: sel.y + sel.size - hs2 }, // sw
                { x: sel.x + sel.size - hs2, y: sel.y + sel.size - hs2 } // se
            ];
            
            handles.forEach(h => {
                ctx.fillRect(h.x, h.y, handleSize, handleSize);
                ctx.strokeRect(h.x, h.y, handleSize, handleSize);
            });
        };

        const openCrop = (fileOrUrl) => {
            const url = typeof fileOrUrl === 'string' ? fileOrUrl : URL.createObjectURL(fileOrUrl);
            cropImg = new Image();
            cropImg.onload = () => { 
                if (cropCanvas) {
                    const wRatio = cropCanvas.width / cropImg.width;
                    const hRatio = cropCanvas.height / cropImg.height;
                    baseScale = Math.min(wRatio, hRatio);
                    
                    sel.size = Math.min(200, Math.min(cropCanvas.width, cropCanvas.height) * 0.8);
                    sel.x = (cropCanvas.width - sel.size) / 2;
                    sel.y = (cropCanvas.height - sel.size) / 2;
                    
                    if (cropZoom) cropZoom.value = '1';
                }
                drawCrop(); 
            };
            cropImg.src = url;
            if (cropModal) { cropModal.classList.remove('hidden'); cropModal.classList.add('flex'); }
        };

        if (cropCanvas) {
            const getCanvasPoint = (e) => {
                const rect = cropCanvas.getBoundingClientRect();
                const scaleX = cropCanvas.width / rect.width;
                const scaleY = cropCanvas.height / rect.height;
                return {
                    x: (e.clientX - rect.left) * scaleX,
                    y: (e.clientY - rect.top) * scaleY
                };
            };

            const getHandle = (p) => {
                const handleSize = 15; // slightly larger for hit detection
                const hs2 = handleSize / 2;
                // Check handles: nw, ne, sw, se
                if (Math.abs(p.x - sel.x) < handleSize && Math.abs(p.y - sel.y) < handleSize) return 'nw';
                if (Math.abs(p.x - (sel.x + sel.size)) < handleSize && Math.abs(p.y - sel.y) < handleSize) return 'ne';
                if (Math.abs(p.x - sel.x) < handleSize && Math.abs(p.y - (sel.y + sel.size)) < handleSize) return 'sw';
                if (Math.abs(p.x - (sel.x + sel.size)) < handleSize && Math.abs(p.y - (sel.y + sel.size)) < handleSize) return 'se';
                return null;
            };

            cropCanvas.addEventListener('mousedown', (e) => {
                const p = getCanvasPoint(e);
                const handle = getHandle(p);
                
                if (handle) {
                    dragging = true;
                    dragMode = handle;
                    dragStartSize = sel.size;
                    dragStartPos = { x: sel.x, y: sel.y };
                    dragOffset = { x: p.x, y: p.y }; // Store initial mouse pos
                } else if (p.x >= sel.x && p.x <= sel.x + sel.size && p.y >= sel.y && p.y <= sel.y + sel.size) {
                    dragging = true;
                    dragMode = 'move';
                    dragOffset.x = p.x - sel.x;
                    dragOffset.y = p.y - sel.y;
                }
            });
            
            window.addEventListener('mouseup', () => { dragging = false; dragMode = null; });
            
            cropCanvas.addEventListener('mousemove', (e) => {
                const p = getCanvasPoint(e);
                
                // Update cursor
                if (!dragging) {
                    const handle = getHandle(p);
                    if (handle === 'nw' || handle === 'se') cropCanvas.style.cursor = 'nwse-resize';
                    else if (handle === 'ne' || handle === 'sw') cropCanvas.style.cursor = 'nesw-resize';
                    else if (p.x >= sel.x && p.x <= sel.x + sel.size && p.y >= sel.y && p.y <= sel.y + sel.size) cropCanvas.style.cursor = 'move';
                    else cropCanvas.style.cursor = 'default';
                    return;
                }

                if (dragMode === 'move') {
                    sel.x = Math.max(0, Math.min(cropCanvas.width - sel.size, p.x - dragOffset.x));
                    sel.y = Math.max(0, Math.min(cropCanvas.height - sel.size, p.y - dragOffset.y));
                } else {
                    // Resize logic while maintaining aspect ratio (square)
                    // Use Fixed Anchor point strategy
                    
                    let fixedX, fixedY; // The corner that stays stationary
                    
                    // Determine fixed anchor based on handle
                    if (dragMode === 'se') {
                        fixedX = dragStartPos.x;
                        fixedY = dragStartPos.y;
                    } else if (dragMode === 'sw') {
                        fixedX = dragStartPos.x + dragStartSize;
                        fixedY = dragStartPos.y;
                    } else if (dragMode === 'ne') {
                        fixedX = dragStartPos.x;
                        fixedY = dragStartPos.y + dragStartSize;
                    } else if (dragMode === 'nw') {
                        fixedX = dragStartPos.x + dragStartSize;
                        fixedY = dragStartPos.y + dragStartSize;
                    }

                    // Calculate proposed size based on mouse distance from anchor
                    // We want square, so we take the max distance on either axis
                    
                    let dx, dy;
                    if (dragMode === 'se') {
                        dx = p.x - fixedX;
                        dy = p.y - fixedY;
                    } else if (dragMode === 'sw') {
                        dx = fixedX - p.x;
                        dy = p.y - fixedY;
                    } else if (dragMode === 'ne') {
                        dx = p.x - fixedX;
                        dy = fixedY - p.y;
                    } else if (dragMode === 'nw') {
                        dx = fixedX - p.x;
                        dy = fixedY - p.y;
                    }
                    
                    // Use the larger dimension to determine size (expands to meet mouse)
                    let proposedSize = Math.max(dx, dy);
                    proposedSize = Math.max(50, proposedSize); // Min size constraint
                    
                    // Boundary checks (max size constraint)
                    if (dragMode === 'se') {
                        if (fixedX + proposedSize > cropCanvas.width) proposedSize = cropCanvas.width - fixedX;
                        if (fixedY + proposedSize > cropCanvas.height) proposedSize = cropCanvas.height - fixedY;
                    } else if (dragMode === 'sw') {
                        if (fixedX - proposedSize < 0) proposedSize = fixedX;
                        if (fixedY + proposedSize > cropCanvas.height) proposedSize = cropCanvas.height - fixedY;
                    } else if (dragMode === 'ne') {
                        if (fixedX + proposedSize > cropCanvas.width) proposedSize = cropCanvas.width - fixedX;
                        if (fixedY - proposedSize < 0) proposedSize = fixedY;
                    } else if (dragMode === 'nw') {
                        if (fixedX - proposedSize < 0) proposedSize = fixedX;
                        if (fixedY - proposedSize < 0) proposedSize = fixedY;
                    }
                    
                    // Apply new size and position
                    sel.size = proposedSize;
                    
                    if (dragMode === 'se') {
                        sel.x = fixedX;
                        sel.y = fixedY;
                    } else if (dragMode === 'sw') {
                        sel.x = fixedX - proposedSize;
                        sel.y = fixedY;
                    } else if (dragMode === 'ne') {
                        sel.x = fixedX;
                        sel.y = fixedY - proposedSize;
                    } else if (dragMode === 'nw') {
                        sel.x = fixedX - proposedSize;
                        sel.y = fixedY - proposedSize;
                    }
                }
                
                drawCrop();
            });

            // Add wheel zoom support (Resizes the crop box)
            cropCanvas.addEventListener('wheel', (e) => {
                e.preventDefault();
                
                // If user holds Shift, zoom the image instead
                if (e.shiftKey && cropZoom) {
                    const delta = e.deltaY > 0 ? -0.1 : 0.1;
                    let val = parseFloat(cropZoom.value);
                    val = Math.min(Math.max(val + delta, parseFloat(cropZoom.min)), parseFloat(cropZoom.max));
                    cropZoom.value = val.toFixed(2);
                    drawCrop();
                    return;
                }

                // Default: Resize crop box
                const delta = e.deltaY > 0 ? -10 : 10;
                const oldSize = sel.size;
                const newSize = Math.max(50, Math.min(Math.min(cropCanvas.width, cropCanvas.height), oldSize + delta));
                
                // Adjust position to keep center roughly stable or just resize from center?
                // Let's resize from center
                const diff = newSize - oldSize;
                sel.x -= diff / 2;
                sel.y -= diff / 2;
                sel.size = newSize;
                
                // Clamp to bounds
                if (sel.x < 0) sel.x = 0;
                if (sel.y < 0) sel.y = 0;
                if (sel.x + sel.size > cropCanvas.width) sel.x = cropCanvas.width - sel.size;
                if (sel.y + sel.size > cropCanvas.height) sel.y = cropCanvas.height - sel.size;
                
                drawCrop();
            }, { passive: false });
        }
        
        if (cropZoom) cropZoom.addEventListener('input', drawCrop);
        if (cropCancel) cropCancel.addEventListener('click', () => { if (cropModal) { cropModal.classList.add('hidden'); cropModal.classList.remove('flex'); } });
        
        if (cropApply) cropApply.addEventListener('click', async () => {
            if (!cropCanvas || !cropImg) return;
            const scale = getEffectiveScale();
            const w = cropCanvas.width;
            const h = cropCanvas.height;
            const iw = cropImg.width * scale;
            const ih = cropImg.height * scale;
            const ix = (w - iw) / 2;
            const iy = (h - ih) / 2;
            
            const sx = (sel.x - ix) / scale;
            const sy = (sel.y - iy) / scale;
            const sSize = sel.size / scale;
            
            const out = document.createElement('canvas');
            const outSize = 256;
            out.width = outSize; out.height = outSize;
            const octx = out.getContext('2d');
            octx.drawImage(cropImg, sx, sy, sSize, sSize, 0, 0, outSize, outSize);
            
            out.toBlob((blob) => {
                if (!blob) return;
                const url = URL.createObjectURL(blob);
                avatarPrev.src = url;
                avatarPrev.classList.remove('hidden');
                avatarIcon.classList.add('hidden');
                if (fileNameDisplay) { fileNameDisplay.textContent = '已裁剪头像'; }
                window.dashboardController._croppedAvatarBlob = blob;
                if (cropModal) { cropModal.classList.add('hidden'); cropModal.classList.remove('flex'); }
            }, 'image/png');
        });
        if (avatarInput) {
            avatarInput.addEventListener('change', () => {
                const file = avatarInput.files && avatarInput.files[0];
                if (!file) return;
                // Don't show preview immediately, open crop first
                if (fileNameDisplay) {
                    fileNameDisplay.textContent = file.name;
                    fileNameDisplay.classList.remove('text-gray-400');
                    fileNameDisplay.classList.add('text-gray-700');
                }
                openCrop(file);
            });
        }
        if (cropOpenBtn) {
            cropOpenBtn.addEventListener('click', () => {
                const src = avatarPrev && avatarPrev.src ? avatarPrev.src : null;
                if (src) openCrop(src);
            });
        }

        // 下一步/跳过逻辑
        const next1 = document.getElementById('onb-next-1');
        const skip1 = document.getElementById('onb-skip-1');
        const pwd = document.getElementById('onb-password');
        const pwd2 = document.getElementById('onb-password-confirm');
        const next2 = document.getElementById('onb-next-2');
        const skip2 = document.getElementById('onb-skip-2');
        const finish = document.getElementById('onb-finish');
        const skip3 = document.getElementById('onb-skip-3');

        // 省市区三级联动逻辑已移除


        const notify = (msg, type='info') => { try { ui.showNotification(msg, type); } catch(_) { console.log(msg); } };
        const doSetPassword = async () => {
            try {
                if (!pwd || !pwd2) return true; // nothing to do
                const p = (pwd.value||'').trim(); const c = (pwd2.value||'').trim();
                if (!p) { notify('请输入密码', 'warning'); return false; }
                if (p.length < 6) { notify('密码至少6位', 'warning'); return false; }
                if (p !== c) { notify('两次输入不一致', 'warning'); return false; }
                if (typeof userAuthInstance !== 'undefined' && userAuthInstance.setPassword) {
                    const res = await userAuthInstance.setPassword(p);
                    if (!res || res.success === false) { notify(res && res.message ? res.message : '设置密码失败', 'error'); return false; }
                    localStorage.setItem('passwordSet','1');
                }
                return true;
            } catch(e) { notify('设置密码失败', 'error'); return false; }
        };
        const doSavePersonal = async () => {
            try {
                const username = (document.getElementById('onb-username')?.value||'').trim();
                const phone = (document.getElementById('onb-phone')?.value||'').trim();
                const file = window.dashboardController._croppedAvatarBlob || (avatarInput && avatarInput.files && avatarInput.files[0] ? avatarInput.files[0] : null);
                const updates = {};
                if (username) updates.username = username;
                if (phone) updates.phone = phone;
                if (file && window.userAuthInstance && typeof window.userAuthInstance.uploadAvatar === 'function') {
                    try {
                        const r = await window.userAuthInstance.uploadAvatar(file);
                        if (r && r.success && r.data && r.data.avatar) {
                            updates.avatar = r.data.avatar;
                        }
                    } catch (_) {}
                }
                if (Object.keys(updates).length === 0) return true;
                if (typeof userAuthInstance !== 'undefined' && userAuthInstance.updateProfile) {
                    const res = await userAuthInstance.updateProfile(updates);
                    if (!res || res.success === false) { notify(res && res.message ? res.message : '保存个人信息失败', 'error'); return false; }
                } else {
                    const info = JSON.parse(localStorage.getItem('userInfo')||'{}');
                    info.user = Object.assign({}, info.user||{}, updates);
                    localStorage.setItem('userInfo', JSON.stringify(info));
                }
                return true;
            } catch(e) { notify('保存个人信息失败', 'error'); return false; }
        };
        const doSaveCompany = async () => {
            try {
                const name = (document.getElementById('onb-company-name')?.value||'').trim();
                const contact = (document.getElementById('onb-contact-name')?.value||'').trim();
                const phone = (document.getElementById('onb-contact-phone')?.value||'').trim();
                const addr = (document.getElementById('onb-address')?.value||'').trim();
                
                // 省市区字段已移除
                if (!name || !contact || !phone) { notify('请完整填写必填项', 'warning'); return false; }
                
                const payload = { name, contact, phone, address:addr };
                if (this.resumeData && this.resumeData.apiRequest) {
                    try { await this.resumeData.apiRequest('/company/profile', 'PUT', payload); }
                    catch(e) {
                        const cp = Object.assign({}, payload, { updatedAt: new Date().toISOString() });
                        localStorage.setItem('companyProfile', JSON.stringify(cp));
                    }
                }
                return true;
            } catch(e) { notify('保存企业信息失败', 'error'); return false; }
        };

        if (next1) next1.addEventListener('click', async () => { const ok = await doSetPassword(); if (ok) { showStep(1); } });
        if (skip1) skip1.addEventListener('click', () => { showStep(1); });
        if (next2) next2.addEventListener('click', async () => { const ok = await doSavePersonal(); if (ok) { showStep(2); } });
        if (skip2) skip2.addEventListener('click', () => { showStep(2); });
        if (finish) finish.addEventListener('click', async () => { const ok = await doSaveCompany(); if (ok) { notify('设置完成', 'success'); localStorage.setItem('firstSetupRequired','0'); close(); } });
        if (skip3) skip3.addEventListener('click', () => { localStorage.setItem('firstSetupRequired','0'); close(); });

        // 触发判断逻辑
        const checkAndShow = () => {
            try {
                // 1. 获取用户信息
                const info = JSON.parse(localStorage.getItem('userInfo')||'{}');
                const u = info.user||{};

                // 2. 如果用户已有 company_id，说明已完成企业入驻，不再弹窗
                if (u.company_id) {
                    localStorage.setItem('firstSetupRequired', '0');
                    return;
                }

                // 3. 检查本地存储的公司信息
                const cpRaw = localStorage.getItem('companyProfile');
                if (cpRaw) {
                    // 本地有公司信息，也不弹
                    localStorage.setItem('firstSetupRequired', '0');
                    return;
                }

                // 4. 只有明确标记为需要设置时才弹窗
                // 注意：注册成功后应设置 firstSetupRequired = 1
                const fs = localStorage.getItem('firstSetupRequired');
                if (fs === '1') {
                    open();
                }
            } catch(e) { console.error('Onboarding check failed:', e); }
        };
        
        // 延迟一点执行，确保其他初始化完成
        setTimeout(checkAndShow, 500);
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    window.dashboardController = new DashboardController();
});
