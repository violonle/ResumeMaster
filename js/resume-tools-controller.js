/**
 * Resume Tools Controller
 * Unifies Resume Parsing and Comparison functionalities
 */

(function() {
    // Shared State
    const state = {
        parsing: {
            uploadedFiles: [], // Files waiting to be uploaded/parsed
            selectedResumes: [], // Resumes selected from library or successfully uploaded
            analysisResults: new Map(), // resumeId -> result
            isAnalyzing: false
        },
        comparison: {
            selectedResumes: [], // Resumes selected for comparison
            result: null
        }
    };

    // DOM Elements Cache
    const dom = {};

    function init() {
        cacheDOM();
        bindEvents();
        initSidebar();
        
        // Initialize Header Profile
        if (typeof HeaderProfile !== 'undefined' && HeaderProfile.init) {
            HeaderProfile.init('#header-right-section');
        }
        
        // Initialize sub-controllers
        initParsingController();
        initComparisonController();
        
        // Check URL params for initial view
        const urlParams = new URLSearchParams(window.location.search);
        const view = urlParams.get('view');
        if (view === 'comparison') {
            switchView('comparison-view');
        } else {
            switchView('parsing-view');
        }
    }

    function cacheDOM() {
        // Navigation
        dom.tabs = document.querySelectorAll('.nav-tab');
        dom.views = document.querySelectorAll('.view-section');

        // Parsing View
        dom.parsing = {
            uploadBtn: document.getElementById('upload-resume-btn'),
            listContainer: document.getElementById('selected-resume-list'),
            analyzeBtn: document.getElementById('analyze-btn'),
            addToAnalysisListBtn: document.getElementById('add-to-analysis-list-btn'),
            selectedCount: document.getElementById('selected-resume-count'),
            analysisListCount: document.getElementById('analysis-list-count'),
            libraryAnalyzeCount: document.getElementById('library-analyze-count'),
            
            // Upload Modal
            modal: document.getElementById('upload-modal'),
            closeModalBtn: document.getElementById('close-upload-modal'),
            cancelModalBtn: document.getElementById('cancel-upload-modal'),
            confirmModalBtn: document.getElementById('confirm-upload-btn'),
            dropZone: document.getElementById('modal-drop-zone'),
            fileInput: document.getElementById('modal-file-input'),
            fileList: document.getElementById('modal-file-list'),
            fileListContainer: document.getElementById('modal-file-list-container'),
            clearFilesBtn: document.getElementById('modal-clear-files-btn'),
            
            // Library in Modal
            libraryList: document.getElementById('library-resume-list'),
            librarySearch: document.getElementById('library-search-input'),
            libraryFilterPos: document.getElementById('library-position-filter'),
            libraryFilterSort: document.getElementById('library-sort-filter'),
            libraryPrevBtn: document.getElementById('library-prev-page-btn'),
            libraryNextBtn: document.getElementById('library-next-page-btn'),
            libraryPageStart: document.getElementById('library-page-info-start'),
            libraryPageEnd: document.getElementById('library-page-info-end'),
            libraryFilteredCount: document.getElementById('library-filtered-count'),
            librarySelectedCount: document.getElementById('library-selected-count'),
            
            // Results
            singleResult: document.getElementById('single-analysis-result'),
            analysisPreview: document.getElementById('analysis-preview')
        };

        // Comparison View
        dom.comparison = {
            container: document.getElementById('selected-resumes-container'),
            emptyState: document.getElementById('empty-state'),
            selectedCount: document.getElementById('selected-count'),
            uploadArea: document.getElementById('upload-area'),
            fileInput: document.getElementById('file-input'), // Comparison file input
            importBtn: document.getElementById('import-from-library-btn'),
            clearBtn: document.getElementById('clear-all-btn'),
            compareBtn: document.getElementById('compare-btn'),
            resultsSection: document.getElementById('comparisonResults'),
            
            // Library Modal for Comparison
            libraryModal: document.getElementById('library-modal'),
            libCloseBtn: document.getElementById('close-library-modal'),
            libCancelBtn: document.getElementById('cancel-library-modal'),
            libImportBtn: document.getElementById('import-selected-btn'),
            libList: document.getElementById('resume-list'),
            libSearch: document.getElementById('resume-search-input'),
            libSelectAll: document.getElementById('select-all-btn'),
            libClearSel: document.getElementById('clear-selection-btn')
        };
    }

    function initSidebar() {
        if (window.Sidebar) {
            Sidebar.init({ mount: '#sidebar', active: 'resume-tools' });
        }
    }

    function bindEvents() {
        // Tab Switching
        window.switchView = function(viewId) {
            dom.tabs.forEach(tab => {
                if(tab.dataset.target === viewId) tab.classList.add('active');
                else tab.classList.remove('active');
            });
            dom.views.forEach(view => {
                if(view.id === viewId) view.classList.add('active');
                else view.classList.remove('active');
            });
        };
    }

    // ==========================================================================
    // Parsing Controller
    // ==========================================================================
    
    let libraryState = {
        page: 1,
        pageSize: 10,
        total: 0,
        items: [],
        selectedIds: new Set(), // IDs selected in the modal
        tempUploadedFiles: []   // Files uploaded in the modal
    };

    function initParsingController() {
        // Open Modal
        dom.parsing.uploadBtn.addEventListener('click', () => {
            resetLibraryState();
            openModal(dom.parsing.modal);
            loadLibraryData();
        });

        // Close Modal
        [dom.parsing.closeModalBtn, dom.parsing.cancelModalBtn].forEach(btn => {
            if(btn) btn.addEventListener('click', () => closeModal(dom.parsing.modal));
        });

        // File Upload in Modal
        if (dom.parsing.dropZone) {
            dom.parsing.dropZone.addEventListener('click', () => dom.parsing.fileInput.click());
            dom.parsing.dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dom.parsing.dropZone.classList.add('border-blue-500', 'bg-blue-50'); });
            dom.parsing.dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); dom.parsing.dropZone.classList.remove('border-blue-500', 'bg-blue-50'); });
            dom.parsing.dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dom.parsing.dropZone.classList.remove('border-blue-500', 'bg-blue-50');
                handleModalFiles(e.dataTransfer.files);
            });
        }
        if (dom.parsing.fileInput) {
            dom.parsing.fileInput.addEventListener('change', (e) => handleModalFiles(e.target.files));
        }

        if (dom.parsing.clearFilesBtn) {
            dom.parsing.clearFilesBtn.addEventListener('click', () => {
                libraryState.tempUploadedFiles = [];
                renderModalFileList();
                updateModalConfirmBtn();
            });
        }

        // Library Navigation
        if(dom.parsing.libraryPrevBtn) dom.parsing.libraryPrevBtn.addEventListener('click', () => changeLibraryPage(-1));
        if(dom.parsing.libraryNextBtn) dom.parsing.libraryNextBtn.addEventListener('click', () => changeLibraryPage(1));
        
        // Search & Filter
        const debouncedLoad = debounce(loadLibraryData, 300);
        if(dom.parsing.librarySearch) dom.parsing.librarySearch.addEventListener('input', debouncedLoad);
        if(dom.parsing.libraryFilterPos) dom.parsing.libraryFilterPos.addEventListener('change', loadLibraryData);
        if(dom.parsing.libraryFilterSort) dom.parsing.libraryFilterSort.addEventListener('change', loadLibraryData);

        // Confirm Selection
        dom.parsing.confirmModalBtn.addEventListener('click', confirmParsingSelection);

        // Analyze Button
        dom.parsing.analyzeBtn.addEventListener('click', startParsingAnalysis);
        
        // Add to Analysis List (just a visual confirmation in this flow)
        dom.parsing.addToAnalysisListBtn.addEventListener('click', () => {
             // Logic to move checked items from main list to "Analysis List" if we implemented that separation
             // For now, we assume "Selected Resumes" ARE the analysis list.
             ui.showNotification('已加入分析清单', 'success');
             dom.parsing.analyzeBtn.disabled = false;
        });
    }

    // --- Modal Logic ---

    function resetLibraryState() {
        libraryState.selectedIds.clear();
        libraryState.tempUploadedFiles = [];
        libraryState.page = 1;
        renderModalFileList();
        updateModalConfirmBtn();
    }

    function handleModalFiles(fileList) {
        const files = Array.from(fileList);
        const validFiles = files.filter(f => {
            const ext = f.name.split('.').pop().toLowerCase();
            return ['pdf', 'doc', 'docx', 'txt'].includes(ext) && f.size <= 10 * 1024 * 1024;
        });
        
        if (validFiles.length < files.length) {
            ui.showNotification('部分文件格式不支持或超过10MB', 'warning');
        }

        libraryState.tempUploadedFiles = [...libraryState.tempUploadedFiles, ...validFiles].slice(0, 5);
        renderModalFileList();
        updateModalConfirmBtn();
    }

    function renderModalFileList() {
        const container = dom.parsing.fileList;
        container.innerHTML = '';
        if (libraryState.tempUploadedFiles.length === 0) {
            dom.parsing.fileListContainer.classList.add('hidden');
            return;
        }
        dom.parsing.fileListContainer.classList.remove('hidden');
        
        libraryState.tempUploadedFiles.forEach((file, idx) => {
            const div = document.createElement('div');
            div.className = 'flex items-center justify-between p-2 bg-gray-50 rounded border';
            div.innerHTML = `
                <div class="flex items-center space-x-2 truncate">
                    <i class="fas fa-file text-gray-400"></i>
                    <span class="text-sm text-gray-700 truncate">${file.name}</span>
                </div>
                <button class="text-red-500 hover:text-red-700" data-idx="${idx}"><i class="fas fa-times"></i></button>
            `;
            div.querySelector('button').addEventListener('click', () => {
                libraryState.tempUploadedFiles.splice(idx, 1);
                renderModalFileList();
                updateModalConfirmBtn();
            });
            container.appendChild(div);
        });
    }

    async function loadLibraryData() {
        if (!window.resumeDataManager) return;
        
        const query = dom.parsing.librarySearch.value;
        const posFilter = dom.parsing.libraryFilterPos.value;
        const sort = dom.parsing.libraryFilterSort.value;

        try {
            let allResults = await window.resumeDataManager.getTalentPoolResumes();
            
            if (query) {
                const lowerQuery = query.toLowerCase();
                allResults = allResults.filter(r => {
                    const name = (r.name || '').toLowerCase();
                    const position = (r.position || r.jobTitle || '').toLowerCase();
                    return name.includes(lowerQuery) || position.includes(lowerQuery);
                });
            }
            
            if (posFilter) {
                allResults = allResults.filter(r => {
                    const pos = (r.position || r.jobTitle || '').toLowerCase();
                    const filter = posFilter.toLowerCase();
                    return pos.includes(filter);
                });
            }
            
            if (sort === 'time-desc') {
                allResults.sort((a, b) => {
                    const da = new Date(a.created_at || a.upload_date || 0);
                    const db = new Date(b.created_at || b.upload_date || 0);
                    return db - da;
                });
            }

            libraryState.total = allResults.length;
            const maxPage = Math.ceil(libraryState.total / libraryState.pageSize) || 1;
            if (libraryState.page > maxPage) libraryState.page = 1;

            const start = (libraryState.page - 1) * libraryState.pageSize;
            libraryState.items = allResults.slice(start, start + libraryState.pageSize);

            renderLibraryList();
            updatePagination();
        } catch (e) {
            console.error(e);
            ui.showNotification('加载简历库失败', 'error');
        }
    }

    function renderLibraryList() {
        const container = dom.parsing.libraryList;
        container.innerHTML = '';
        
        if (libraryState.items.length === 0) {
            container.innerHTML = '<div class="text-center py-8 text-gray-400">暂无简历数据</div>';
            return;
        }

        libraryState.items.forEach(item => {
            const div = document.createElement('div');
            const isSelected = libraryState.selectedIds.has(item.id);
            div.className = `flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200 hover:border-blue-300'}`;
            div.onclick = () => toggleLibrarySelection(item.id, div);
            
            div.innerHTML = `
                <div class="flex items-center space-x-3">
                    <div class="w-8 h-8 rounded-full flex items-center justify-center ${isSelected ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}">
                        <i class="fas fa-user"></i>
                    </div>
                    <div>
                        <div class="text-sm font-medium text-gray-900">${item.name || '未命名简历'}</div>
                        <div class="text-xs text-gray-500">${item.position || '未分类'} • ${new Date(item.updated_at || item.created_at).toLocaleDateString()}</div>
                    </div>
                </div>
                <div class="text-blue-600 ${isSelected ? '' : 'hidden'}"><i class="fas fa-check-circle"></i></div>
            `;
            container.appendChild(div);
        });
        
        dom.parsing.libraryFilteredCount.textContent = `共找到 ${libraryState.total} 份简历`;
    }

    function toggleLibrarySelection(id, el) {
        if (libraryState.selectedIds.has(id)) {
            libraryState.selectedIds.delete(id);
        } else {
            libraryState.selectedIds.add(id);
        }
        renderLibraryList(); // Re-render to update UI (simplest way)
        updateModalConfirmBtn();
    }

    function changeLibraryPage(delta) {
        const newPage = libraryState.page + delta;
        if (newPage > 0 && newPage <= Math.ceil(libraryState.total / libraryState.pageSize)) {
            libraryState.page = newPage;
            loadLibraryData();
        }
    }

    function updatePagination() {
        const totalPages = Math.ceil(libraryState.total / libraryState.pageSize);
        dom.parsing.libraryPrevBtn.disabled = libraryState.page === 1;
        dom.parsing.libraryNextBtn.disabled = libraryState.page >= totalPages;
        
        const start = (libraryState.page - 1) * libraryState.pageSize + 1;
        const end = Math.min(libraryState.page * libraryState.pageSize, libraryState.total);
        dom.parsing.libraryPageStart.textContent = libraryState.total > 0 ? start : 0;
        dom.parsing.libraryPageEnd.textContent = end;
    }

    function updateModalConfirmBtn() {
        const count = libraryState.selectedIds.size + libraryState.tempUploadedFiles.length;
        dom.parsing.confirmModalBtn.disabled = count === 0;
        dom.parsing.confirmModalBtn.textContent = count > 0 ? `确定 (已选${count})` : '确定';
        dom.parsing.librarySelectedCount.textContent = `已选择 ${libraryState.selectedIds.size} 份`;
    }

    async function confirmParsingSelection() {
        // 1. Process Uploaded Files using ResumeUploadHandler
        const uploadedItems = [];
        
        if (libraryState.tempUploadedFiles.length > 0) {
            const uploadHandler = new ResumeUploadHandler({
                uploadEndpoint: '/library/upload',
                apiRequest: async (endpoint, method, data) => {
                    const response = await fetch(endpoint, {
                        method: method,
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                        },
                        body: JSON.stringify(data)
                    });
                    return await response.json();
                },
                onSuccess: (result, file) => {
                    uploadedItems.push({
                        id: result.data.id,
                        name: file.name,
                        source: 'upload',
                        status: 'pending',
                        created_at: new Date().toISOString()
                    });
                },
                onError: (error, file) => {
                    console.error('Upload failed:', error);
                    ui.showNotification(`上传 ${file.name} 失败: ${error.message}`, 'error');
                },
                onProgress: (current, total, file) => {
                    console.log(`正在上传 (${current + 1}/${total}): ${file.name}`);
                }
            });

            try {
                await uploadHandler.uploadFiles(libraryState.tempUploadedFiles);
            } catch (error) {
                console.error('Upload process failed:', error);
            }
        }

        // 2. Process Library Selections
        const libraryItems = [];
        for (const id of libraryState.selectedIds) {
            try {
                const response = await fetch(`/api/resumes/${id}`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });
                
                const result = await response.json();
                if (!result.success) {
                    throw new Error(result.error?.message || '获取简历失败');
                }
                
                libraryItems.push({
                    id: result.data.id,
                    name: result.data.name || result.data.fileName,
                    source: 'library',
                    status: 'pending',
                    created_at: result.data.createdAt
                });
            } catch (error) {
                console.error('Fetch resume failed:', error);
            }
        }
        
        // Add to Main Parsing List
        const newItems = [
            ...uploadedItems,
            ...Array.from(libraryState.selectedIds).map(id => {
                const item = libraryState.items.find(i => i.id === id) || { id, name: '简历#'+id, source: 'library' };
                return { ...item, status: 'ready' };
            })
        ];

        state.parsing.selectedResumes = [...state.parsing.selectedResumes, ...newItems];
        renderMainParsingList();
        closeModal(dom.parsing.modal);
        ui.showNotification(`成功添加 ${newItems.length} 份简历`, 'success');
    }

    // --- Main Parsing View Logic ---

    function renderMainParsingList() {
        const container = dom.parsing.listContainer;
        container.innerHTML = '';
        
        if (state.parsing.selectedResumes.length === 0) {
            container.innerHTML = '<div class="text-center py-8 text-gray-400">暂无已选简历</div>';
            dom.parsing.analyzeBtn.disabled = true;
            dom.parsing.addToAnalysisListBtn.disabled = true;
            dom.parsing.selectedCount.textContent = '已选择 0 份简历';
            dom.parsing.analysisListCount.textContent = '0';
            dom.parsing.libraryAnalyzeCount.textContent = '0';
            return;
        }

        state.parsing.selectedResumes.forEach((item, idx) => {
            const div = document.createElement('div');
            div.className = 'flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:shadow-md transition-shadow';
            div.innerHTML = `
                <div class="flex items-center space-x-4">
                    <div class="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                        <i class="fas ${item.source === 'upload' ? 'fa-file-upload' : 'fa-database'}"></i>
                    </div>
                    <div>
                        <h4 class="font-medium text-gray-900">${item.name}</h4>
                        <div class="text-xs text-gray-500">${item.source === 'upload' ? '本地上传' : '人才库'} • ${item.status === 'completed' ? '已解析' : '待解析'}</div>
                    </div>
                </div>
                <div class="flex items-center space-x-3">
                    ${item.status === 'completed' ? '<button class="text-blue-600 hover:underline text-sm view-result-btn">查看结果</button>' : ''}
                    <button class="text-gray-400 hover:text-red-500 remove-item-btn"><i class="fas fa-trash"></i></button>
                </div>
            `;
            
            div.querySelector('.remove-item-btn').addEventListener('click', () => {
                state.parsing.selectedResumes.splice(idx, 1);
                renderMainParsingList();
            });
            
            if (item.status === 'completed') {
                div.querySelector('.view-result-btn').addEventListener('click', () => showSingleAnalysisResult(item));
            }

            container.appendChild(div);
        });

        const count = state.parsing.selectedResumes.length;
        dom.parsing.selectedCount.textContent = `已选择 ${count} 份简历`;
        dom.parsing.analysisListCount.textContent = count;
        dom.parsing.libraryAnalyzeCount.textContent = count;
        dom.parsing.analyzeBtn.disabled = count === 0;
        dom.parsing.addToAnalysisListBtn.disabled = count === 0;
    }

    async function startParsingAnalysis() {
        if (state.parsing.isAnalyzing) return;
        state.parsing.isAnalyzing = true;
        
        // Show progress UI
        dom.parsing.analysisPreview.classList.remove('hidden');
        dom.parsing.analyzeBtn.disabled = true;
        dom.parsing.analyzeBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>正在解析...';

        try {
            // Process each item
            for (let item of state.parsing.selectedResumes) {
                // 1. 优先检查后端是否已有结果
                if (item.resumeId) {
                    try {
                        const existingResult = await window.resumeDataManager.getLatestAnalysis(item.resumeId);
                        if (existingResult) {
                            console.log('[Parsing] Found existing result for', item.resumeId);
                            item.status = 'completed';
                            item.analysisResult = existingResult;
                            continue;
                        }
                    } catch (err) {
                        console.warn('Check existing analysis failed for', item.resumeId, err);
                    }
                }

                if (item.status === 'completed') continue;
                
                // Update item status visually
                item.status = 'analyzing';
                
                try {
                    // Call actual API for analysis
                    const response = await fetch(`/api/aiAnalysis/analyze/${item.resumeId}`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('token')}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    const result = await response.json();
                    if (!result.success) {
                        throw new Error(result.error?.message || '分析失败');
                    }
                    
                    item.status = 'completed';
                    item.analysisResult = result.data;
                } catch (error) {
                    console.error('分析失败:', error);
                    item.status = 'error';
                    item.analysisError = error.message;
                }
            }
            
            ui.showNotification('深度解析任务已启动，正在后台处理', 'success');
            renderMainParsingList();
            
            // Show result of the last analyzed item
            const lastItem = state.parsing.selectedResumes[state.parsing.selectedResumes.length - 1];
            if (lastItem) showSingleAnalysisResult(lastItem);

        } catch (e) {
            console.error(e);
            ui.showNotification('解析过程中发生错误', 'error');
        } finally {
            state.parsing.isAnalyzing = false;
            dom.parsing.analyzeBtn.disabled = false;
            dom.parsing.analyzeBtn.innerHTML = '<i class="fas fa-cog mr-2"></i>开始解析 (' + state.parsing.selectedResumes.length + ')';
            dom.parsing.analysisPreview.classList.add('hidden');
        }
    }

    function showSingleAnalysisResult(item) {
        const res = item.analysisResult;
        if (!res) return;

        dom.parsing.singleResult.classList.remove('hidden');
        dom.parsing.singleResult.scrollIntoView({ behavior: 'smooth' });

        // Populate Data
        document.getElementById('sar-name').textContent = res.personalInfo.name;
        document.getElementById('sar-sub').textContent = `${res.education[0]?.school || '未知院校'} / ${res.experience[0]?.company || '未知公司'} / ${res.personalInfo.location || ''}`;
        
        // Score
        const scoreEl = document.getElementById('sar-score-val');
        const badgeEl = document.getElementById('sar-score-badge');
        if (res.scores && res.scores.overall) {
            scoreEl.textContent = res.scores.overall;
            badgeEl.classList.remove('hidden');
        }

        // Basic Info
        const basicInfoHTML = `
            <div class="flex justify-between border-b pb-2"><span>姓名</span><span class="font-medium">${res.personalInfo.name}</span></div>
            <div class="flex justify-between border-b pb-2 pt-2"><span>电话</span><span class="font-medium">${res.personalInfo.phone}</span></div>
            <div class="flex justify-between border-b pb-2 pt-2"><span>邮箱</span><span class="font-medium">${res.personalInfo.email}</span></div>
            <div class="flex justify-between pt-2"><span>工作年限</span><span class="font-medium">${res.personalInfo.yearsOfExperience || '3'}年</span></div>
        `;
        document.getElementById('sar-basic').innerHTML = basicInfoHTML;

        // Radar Chart
        if (window.ChartUtils) {
             const radarContainer = document.getElementById('sar-radar');
             radarContainer.innerHTML = '<canvas id="sar-radar-canvas"></canvas>';
             ChartUtils.createRadarChart(
                 document.getElementById('sar-radar-canvas'), 
                 { labels: Object.keys(res.scores.dimensions), data: Object.values(res.scores.dimensions), label: '能力评分' }
             );
        }

        // Lists
        renderList('sar-strengths', res.evaluation.strengths);
        renderList('sar-weaknesses', res.evaluation.weaknesses);
        renderList('sar-advices', res.evaluation.advice);
        
        document.getElementById('sar-summary').textContent = res.summary;
    }

    function renderList(id, items) {
        const ul = document.getElementById(id);
        if (ul) ul.innerHTML = items.map(i => `<li>${i}</li>`).join('');
    }

    // ==========================================================================
    // Comparison Controller
    // ==========================================================================

    function initComparisonController() {
        // Upload Button in Comparison View (Hidden file input)
        dom.comparison.uploadArea.addEventListener('click', () => dom.comparison.fileInput.click());
        dom.comparison.fileInput.addEventListener('change', (e) => handleComparisonFiles(e.target.files));

        // Import from Library
        dom.comparison.importBtn.addEventListener('click', () => {
            openModal(dom.comparison.libraryModal);
            // Re-use logic or init comparison library logic
            // For simplicity, we assume similar logic to parsing but separate state if needed
        });

        // Compare Button
        dom.comparison.compareBtn.addEventListener('click', startComparison);
        
        // Clear Button
        dom.comparison.clearBtn.addEventListener('click', () => {
             state.comparison.selectedResumes = [];
             renderComparisonList();
        });

        // Job Selection
        const jobSelect = document.getElementById('job-select');
        if (jobSelect) {
            jobSelect.addEventListener('change', updateSelectedJobSummary);
            loadJobsForSelect();
        }
        const jobJd = document.getElementById('job-jd-input');
        if (jobJd) {
            jobJd.addEventListener('input', updateSelectedJobSummary);
        }

        // Initialize ResumeComparison instance if available (optional, or we manage state manually)
        // We'll manage state manually here for full control
        renderComparisonList();
    }

    async function handleComparisonFiles(fileList) {
        for (const file of fileList) {
            try {
                const formData = new FormData();
                formData.append('resume', file);
                
                const response = await fetch('/api/ai/upload', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: formData
                });
                
                const result = await response.json();
                if (!result.success) {
                    throw new Error(result.error?.message || '上传失败');
                }
                
                state.comparison.selectedResumes.push({
                    id: result.data.id,
                    name: file.name,
                    file: file,
                    resumeId: result.data.id
                });
            } catch (error) {
                console.error('Upload failed:', error);
                ui.showNotification(`上传 ${file.name} 失败: ${error.message}`, 'error');
            }
        }
        renderComparisonList();
    }

    function renderComparisonList() {
        const container = dom.comparison.container;
        const list = state.comparison.selectedResumes;
        
        container.innerHTML = '';
        dom.comparison.selectedCount.textContent = `${list.length}份简历`;
        
        if (list.length === 0) {
            dom.comparison.emptyState.style.display = 'block';
            dom.comparison.compareBtn.disabled = true;
            dom.comparison.compareBtn.classList.add('opacity-50', 'cursor-not-allowed');
            dom.comparison.compareBtn.classList.remove('btn-primary');
            return;
        }

        dom.comparison.emptyState.style.display = 'none';
        dom.comparison.compareBtn.disabled = list.length < 2;
        if (list.length >= 2) {
             dom.comparison.compareBtn.classList.remove('opacity-50', 'cursor-not-allowed');
             dom.comparison.compareBtn.classList.add('btn-primary');
        }

        list.forEach((item, idx) => {
             const div = document.createElement('div');
             div.className = 'selected-resume-item bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between';
             div.innerHTML = `
                 <div class="flex items-center space-x-3">
                     <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                         <i class="fas fa-file-alt text-blue-600"></i>
                     </div>
                     <div>
                         <h4 class="font-medium text-gray-900">${item.name}</h4>
                         <p class="text-sm text-gray-600">ID: ${item.id}</p>
                     </div>
                 </div>
                 <button class="text-red-500 hover:text-red-700 remove-btn"><i class="fas fa-times"></i></button>
             `;
             div.querySelector('.remove-btn').addEventListener('click', () => {
                 state.comparison.selectedResumes.splice(idx, 1);
                 renderComparisonList();
             });
             container.appendChild(div);
        });
    }

    async function startComparison() {
        if (state.comparison.selectedResumes.length < 2) return;
        
        dom.comparison.compareBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>正在对比...';
        dom.comparison.compareBtn.disabled = true;

        try {
            const resumeIds = state.comparison.selectedResumes.map(r => r.resumeId);
            
            const response = await fetch('/api/ai/compare-resumes', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ resumeIds })
            });
            
            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error?.message || '对比失败');
            }
            
            const comparisonResult = result.data;

            dom.comparison.resultsSection.classList.remove('hidden');
            dom.comparison.resultsSection.scrollIntoView({ behavior: 'smooth' });
            
            if (window.renderCandidateGrid) window.renderCandidateGrid(comparisonResult);
            if (window.initComparisonRadar) window.initComparisonRadar(comparisonResult);
            if (window.renderSummary) window.renderSummary(comparisonResult);
            if (window.updateComparisonTable) window.updateComparisonTable(comparisonResult);
            
            setupExportButtons();
        } catch (error) {
            console.error('对比失败:', error);
            ui.showNotification('对比过程中发生错误: ' + error.message, 'error');
        } finally {
            dom.comparison.compareBtn.innerHTML = '<i class="fas fa-search mr-2"></i>开始对比分析';
            dom.comparison.compareBtn.disabled = false;
        }
    }

    // ==========================================================================
    // Utilities
    // ==========================================================================

    function openModal(modal) {
        if(modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    }

    function closeModal(modal) {
        if(modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Add missing render functions if they are not global
    window.initComparisonRadar = function(result) {
        const ctx = document.getElementById('comparisonRadarChart');
        if (!ctx) return;
        
        const datasets = result.resumes.map((r, i) => {
            const colors = ['rgba(59, 130, 246, 0.5)', 'rgba(16, 185, 129, 0.5)', 'rgba(139, 92, 246, 0.5)'];
            const borderColors = ['rgb(59, 130, 246)', 'rgb(16, 185, 129)', 'rgb(139, 92, 246)'];
            return {
                label: r.name,
                data: result.dimensions.map(d => r.scores[d]),
                backgroundColor: colors[i % colors.length],
                borderColor: borderColors[i % borderColors.length],
                pointBackgroundColor: borderColors[i % borderColors.length],
            };
        });

        new Chart(ctx, {
            type: 'radar',
            data: {
                labels: result.dimensions.map(d => ChartUtils.getDimensionLabel(d)),
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 100,
                        ticks: { stepSize: 20 }
                    }
                }
            }
        });
    };

    // Run Initialization
    document.addEventListener('DOMContentLoaded', init);

    // ==========================================================================
    // Comparison View Renderers & Helpers
    // ==========================================================================

    window.loadJobsForSelect = async function() {
        try {
            const api = window.resumeDataManager;
            if (!api) return;
            const jobs = await api.getAllJobs();
            const sel = document.getElementById('job-select');
            if (!sel) return;
            sel.innerHTML = '<option value="">不选择职位</option>' + (jobs||[]).map(j=>{
                const title = j.title || ('职位#'+j.id);
                return `<option value="${j.id}" data-title="${title}" data-desc="${(j.description||'').replace(/"/g,'&quot;')}">${title}</option>`;
            }).join('');
            window.updateSelectedJobSummary();
        } catch(e){ console.warn('加载职位失败', e); }
    };

    window.getTargetJob = function() {
        const sel = document.getElementById('job-select');
        const jd = document.getElementById('job-jd-input');
        const id = sel && sel.value ? parseInt(sel.value) : null;
        const title = sel && sel.selectedOptions && sel.selectedOptions[0] ? (sel.selectedOptions[0].dataset.title||'') : '';
        const desc = (jd && jd.value && jd.value.trim()) ? jd.value.trim() : (sel && sel.selectedOptions && sel.selectedOptions[0] ? (sel.selectedOptions[0].dataset.desc||'') : '');
        if (!id && !desc) return null;
        return { id:id||null, title:title||null, description:desc||'' };
    };

    window.updateSelectedJobSummary = function() {
        const sum = document.getElementById('selected-job-summary');
        if (!sum) return;
        const tj = window.getTargetJob();
        if (!tj) { sum.textContent = '未选择职位；可从下拉选择或输入JD以提升匹配准确性'; return; }
        const title = tj.title ? tj.title : (tj.id ? ('职位#'+tj.id) : '自定义JD');
        const jdText = (tj.description||'').slice(0, 80);
        sum.textContent = `已选择：${title}${jdText ? '｜JD：' + jdText + (tj.description.length>80?'...':'') : ''}`;
    };

    window.renderCandidateGrid = function(comparisonResult) {
        const grid = document.getElementById('candidateGrid');
        if (!grid) return;
        const count = Array.isArray(comparisonResult.resumes) ? comparisonResult.resumes.length : 0;
        let cls = 'grid grid-cols-1 gap-6';
        if (count === 2) { cls += ' md:grid-cols-2'; }
        else if (count === 3) { cls += ' sm:grid-cols-2 lg:grid-cols-3'; }
        else if (count >= 4) { cls += ' sm:grid-cols-2 lg:grid-cols-4'; }
        grid.className = cls;
        
        const avg = (scores)=>{ const arr=Object.values(scores||{}).filter(v=>typeof v==='number'&&!isNaN(v)); if(!arr.length) return NaN; return Math.round(arr.reduce((s,v)=>s+v,0)/arr.length) };
        const ranks = comparisonResult.resumes.map((r,i)=>({i,score:Number.isFinite(r.overall)?r.overall:avg(r.scores||{})})).sort((a,b)=> (isNaN(b.score)?-Infinity:b.score) - (isNaN(a.score)?-Infinity:a.score));
        const rankIndexMap = new Map(ranks.map((r,idx)=>[r.i,idx]));
        
        const colors = [
            { bgIcon:'bg-blue-100', icon:'text-blue-600' },
            { bgIcon:'bg-green-100', icon:'text-green-600' },
            { bgIcon:'bg-purple-100', icon:'text-purple-600' },
            { bgIcon:'bg-orange-100', icon:'text-orange-600' }
        ];
        
        const dims = (function(){
            const exist = (comparisonResult.dimensions||[]).map(String);
            const picks = ['job_match','skill_match','experience_match','learning_ability','teamwork','job_fit','skill_fit','experience_fit','basic_match','skills','experience','learning'];
            const out = [];
            for (const k of picks){ if (exist.includes(k)) { out.push(k); } if (out.length>=3) break; }
            return out.length ? out : exist.slice(0,3);
        })();
        
        grid.innerHTML = '';
        comparisonResult.resumes.forEach((r, idx)=>{
            const color = colors[idx % colors.length];
            const rank = rankIndexMap.get(idx);
            const tag = rank===0 ? '最佳' : `第${(rank||0)+1}名`;
            const bar = (key)=>{
                const raw = r.scores[key] ?? r.scores[key.toLowerCase()] ?? 0;
                const val = typeof raw==='number'? raw : (typeof raw==='object' ? (raw.score ?? 0) : 0);
                const pct = Math.max(0, Math.min(100, Math.round(val)));
                const label = ChartUtils.getDimensionLabel(key);
                return `<div class="flex justify-between text-sm text-gray-600 mb-2"><span>${label}</span><span class="text-blue-600 font-semibold">${pct}%</span></div><div class="h-2 bg-gray-200 rounded"><div class="h-2 bg-blue-600 rounded" style="width:${pct}%"></div></div>`;
            };
            const position = r.position ? `<p class="text-sm text-gray-600">${r.position}</p>` : '';
            const card = document.createElement('div');
            card.className = 'candidate-card bg-white rounded-2xl p-6 shadow-lg';
            card.innerHTML = `
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center space-x-3">
                        <div class="w-12 h-12 ${color.bgIcon} rounded-full flex items-center justify-center"><i class="fas fa-user ${color.icon} text-lg"></i></div>
                        <div><h3 class="font-bold text-gray-900">${r.name}</h3>${position}</div>
                    </div>
                    <div class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">${tag}</div>
                </div>
                ${dims.map(d=>bar(d)).join('')}
            `;
            grid.appendChild(card);
        });
    };

    window.renderSummary = function(comparisonResult){
        const avg = (scores)=>{ const arr=Object.values(scores||{}).filter(v=>typeof v==='number'&&!isNaN(v)); if(!arr.length) return NaN; return Math.round(arr.reduce((s,v)=>s+v,0)/arr.length) };
        const winner = comparisonResult.resumes.reduce((best, cur)=>{ const b=Number.isFinite(best.overall)?best.overall:avg(best.scores); const c=Number.isFinite(cur.overall)?cur.overall:avg(cur.scores); return (isNaN(b)||c>b)? cur: best });
        const w = Number.isFinite(winner.overall)? winner.overall : avg(winner.scores||{});
        // We don't have a specific summary element in the unified view design shown earlier, but if it exists:
        const el = document.getElementById('compare-summary');
        if (el) { el.textContent = `最佳候选人：${winner.name}（综合评分 ${isNaN(w)?'—':w} 分）。建议结合岗位需求安排下一轮评估与面试。`; }
    };

    window.updateComparisonTable = function(comparisonResult) {
        const table = document.getElementById('comparisonDetailTable');
        if (!table) return;
        const thead = table.querySelector('thead') || table.createTHead();
        const tbody = table.querySelector('tbody') || table.createTBody();
        thead.innerHTML = '';
        tbody.innerHTML = '';
        
        const hr = document.createElement('tr');
        hr.className = 'border-b border-gray-200';
        const th0 = document.createElement('th');
        th0.className = 'text-left py-4 px-4 font-semibold text-gray-900';
        th0.textContent = '评估维度';
        hr.appendChild(th0);
        
        const palette = ['text-blue-600','text-green-600','text-purple-600','text-orange-600','text-pink-600'];
        comparisonResult.resumes.forEach((r, idx)=>{
            const th = document.createElement('th');
            th.className = `text-center py-4 px-4 font-semibold ${palette[idx%palette.length]}`;
            th.textContent = r.name;
            hr.appendChild(th);
        });
        const the = document.createElement('thead');
        the.appendChild(hr);
        thead.replaceWith(the);
        
        const nameMap = {
            basic_match: '基础匹配度',
            experience: '经验相关度',
            skills: '技能匹配度',
            learning: '学习能力',
            potential: '发展潜力',
            teamwork: '团队合作',
            job_match: '岗位匹配度',
            skill_match: '技能匹配度',
            experience_match: '经验匹配度',
            learning_ability: '学习能力',
            culture_fit: '文化契合度'
        };
        
        const dims = (comparisonResult.dimensions && comparisonResult.dimensions.length ? comparisonResult.dimensions : ['job_match','skill_match','experience_match','culture_fit','potential']).map(d=>String(d));
        
        dims.forEach(dim=>{
            const tr = document.createElement('tr');
            tr.className = 'comparison-row hover:bg-gray-50';
            const td0 = document.createElement('td');
            td0.className = 'py-4 px-4 font-medium text-gray-900';
            td0.textContent = nameMap[dim.toLowerCase()] || dim;
            tr.appendChild(td0);
            
            comparisonResult.resumes.forEach((r, idx)=>{
                const k = dim.toLowerCase();
                const raw = r.scores[k] ?? r.scores[dim] ?? NaN;
                const val = typeof raw==='number' ? raw : (typeof raw==='object' ? (raw.score ?? NaN) : NaN);
                const isNum = typeof val==='number' && !isNaN(val);
                const pct = isNum ? Math.max(0, Math.min(100, Math.round(val))) : 0;
                const color = isNum ? ['bg-blue-500','bg-green-500','bg-purple-500','bg-orange-500','bg-pink-500'][idx%5] : 'bg-gray-300';
                
                const td = document.createElement('td');
                td.className = 'py-4 px-4 text-center';
                td.innerHTML = `
                    <div class="flex items-center justify-center space-x-2">
                        <div class="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div class="h-full ${color}" style="width: ${pct}%"></div>
                        </div>
                        <span class="text-sm font-semibold ${isNum ? palette[idx%palette.length] : 'text-gray-500'}">${isNum? val: '—'}</span>
                    </div>`;
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
    };
    
    // Export Functions
    function setupExportButtons(){
        const png = document.getElementById('download-png');
        const pdf = document.getElementById('download-pdf');
        if (png) { png.onclick = downloadPNG; }
        if (pdf) { pdf.onclick = downloadPDF; }
    }
    
    function downloadPNG(){
        const node = document.getElementById('report-root');
        if (!node) return;
        html2canvas(node).then(function(canvas){
            const link=document.createElement('a');
            link.download='简历对比报告.png';
            link.href=canvas.toDataURL('image/png');
            link.click();
        });
    }
    
    function downloadPDF(){
        const jsPDF = window.jspdf && window.jspdf.jsPDF ? window.jspdf.jsPDF : null;
        if(!jsPDF) return;
        const doc = new jsPDF('p','mm','a4');
        const node = document.getElementById('report-root');
        if (!node) return;
        html2canvas(node,{scale:2}).then(function(canvas){
            const img = canvas.toDataURL('image/png');
            const pageWidth = 210, pageHeight = 297;
            const imgWidth = pageWidth - 20;
            const imgHeight = canvas.height * imgWidth / canvas.width;
            doc.addImage(img,'PNG',10,10,imgWidth,Math.min(imgHeight,pageHeight-20));
            doc.save('简历对比报告.pdf');
        });
    }

})();
