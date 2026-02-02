/**
 * 简历解析器 - 争湃·简历大师
 * 负责处理简历文件上传、解析和数据提取
 */

class ResumeParser {
    constructor(config = {}) {
        this.config = {
            dropZoneId: 'drop-zone',
            fileInputId: 'file-input',
            analyzeBtnId: 'analyze-btn',
            fileListId: 'file-list',
            ...config
        };
        this.supportedFormats = ['pdf', 'doc', 'docx', 'txt'];
        this.maxFileSize = 10 * 1024 * 1024; // 10MB
        this.uploadQueue = [];
        this.parsedData = null;
        
        this.initializeEventListeners();
    }

    /**
     * 初始化事件监听器
     */
    initializeEventListeners() {
        // 文件拖拽上传
        const dropZone = document.getElementById(this.config.dropZoneId);
        if (dropZone) {
            dropZone.addEventListener('dragover', this.handleDragOver.bind(this));
            dropZone.addEventListener('dragleave', this.handleDragLeave.bind(this));
            dropZone.addEventListener('drop', this.handleDrop.bind(this));
            dropZone.addEventListener('click', () => {
                const fileInput = document.getElementById(this.config.fileInputId);
                if (fileInput) fileInput.click();
            });
        }

        // 文件选择
        const fileInput = document.getElementById(this.config.fileInputId);
        if (fileInput) {
            fileInput.addEventListener('change', this.handleFileSelect.bind(this));
        }

        // 分析按钮
        const analyzeBtn = document.getElementById(this.config.analyzeBtnId);
        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', this.startAnalysis.bind(this));
        }
    }

    /**
     * 处理拖拽悬停
     */
    handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.add('drag-over');
    }

    /**
     * 处理拖拽离开
     */
    handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.remove('drag-over');
    }

    /**
     * 处理文件拖拽放置
     */
    handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.remove('drag-over');
        
        const files = Array.from(e.dataTransfer.files);
        this.processFiles(files);
    }

    /**
     * 处理文件选择
     */
    handleFileSelect(e) {
        const files = Array.from(e.target.files);
        this.processFiles(files);
    }

    /**
     * 处理文件列表
     */
    processFiles(files) {
        files.forEach(file => {
            if (this.validateFile(file)) {
                this.addToUploadQueue(file);
            }
        });
        
        this.updateFileList();
        this.updateAnalyzeButton();
    }

    /**
     * 验证文件
     */
    validateFile(file) {
        // 检查文件大小
        if (file.size > this.maxFileSize) {
            this.showError(`文件 "${file.name}" 超过最大限制 (10MB)`);
            return false;
        }

        // 检查文件格式
        const extension = file.name.split('.').pop().toLowerCase();
        if (!this.supportedFormats.includes(extension)) {
            this.showError(`不支持的文件格式: ${extension}`);
            return false;
        }

        return true;
    }

    /**
     * 添加到上传队列
     */
    addToUploadQueue(file) {
        const fileData = {
            id: Date.now() + Math.random(),
            file: file,
            name: file.name,
            size: file.size,
            type: file.type,
            status: 'pending', // pending, uploading, completed, error
            progress: 0,
            parsedData: null
        };
        
        this.uploadQueue.push(fileData);
    }

    /**
     * 更新文件列表显示
     */
    updateFileList() {
        const fileList = document.getElementById(this.config.fileListId);
        if (!fileList) return;

        fileList.innerHTML = '';
        
        this.uploadQueue.forEach(fileData => {
            const fileItem = this.createFileItem(fileData);
            fileList.appendChild(fileItem);
        });
    }

    /**
     * 创建文件项元素
     */
    createFileItem(fileData) {
        const div = document.createElement('div');
        div.className = 'file-item bg-white p-4 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors';
        div.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3">
                    <div class="file-icon">
                        ${this.getFileIcon(fileData.name)}
                    </div>
                    <div>
                        <h4 class="font-medium text-gray-900">${fileData.name}</h4>
                        <p class="text-sm text-gray-500">${this.formatFileSize(fileData.size)}</p>
                    </div>
                </div>
                <div class="flex items-center space-x-2">
                    <div class="status-indicator status-${fileData.status}">
                        ${this.getStatusIcon(fileData.status)}
                    </div>
                    <button class="remove-file text-red-500 hover:text-red-700" data-file-id="${fileData.id}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="progress-bar mt-3" style="display: ${fileData.status === 'uploading' ? 'block' : 'none'}">
                <div class="bg-gray-200 rounded-full h-2">
                    <div class="bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: ${fileData.progress}%"></div>
                </div>
            </div>
        `;

        // 添加删除按钮事件
        const removeBtn = div.querySelector('.remove-file');
        removeBtn.addEventListener('click', () => {
            this.removeFile(fileData.id);
        });

        return div;
    }

    /**
     * 获取文件图标
     */
    getFileIcon(filename) {
        const extension = filename.split('.').pop().toLowerCase();
        const icons = {
            pdf: '<svg class="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path d="M4 18h12V6l-4-4H4v16z"/></svg>',
            doc: '<svg class="w-8 h-8 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path d="M4 18h12V6l-4-4H4v16z"/></svg>',
            docx: '<svg class="w-8 h-8 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path d="M4 18h12V6l-4-4H4v16z"/></svg>',
            txt: '<svg class="w-8 h-8 text-gray-500" fill="currentColor" viewBox="0 0 20 20"><path d="M4 18h12V6l-4-4H4v16z"/></svg>'
        };
        return icons[extension] || icons.txt;
    }

    /**
     * 获取状态图标
     */
    getStatusIcon(status) {
        const icons = {
            pending: '<svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>',
            uploading: '<svg class="w-5 h-5 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>',
            completed: '<svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>',
            error: '<svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>'
        };
        return icons[status] || icons.pending;
    }

    /**
     * 格式化文件大小
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * 移除文件
     */
    removeFile(fileId) {
        this.uploadQueue = this.uploadQueue.filter(file => file.id !== fileId);
        this.updateFileList();
        this.updateAnalyzeButton();
    }

    /**
     * 更新分析按钮状态
     */
    updateAnalyzeButton() {
        const analyzeBtn = document.getElementById(this.config.analyzeBtnId);
        if (!analyzeBtn) return;

        const hasFiles = this.uploadQueue.length > 0;
        analyzeBtn.disabled = !hasFiles;
        analyzeBtn.className = hasFiles 
            ? 'w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors'
            : 'w-full bg-gray-300 text-gray-500 py-3 px-6 rounded-lg font-medium cursor-not-allowed';
    }

    /**
     * 开始分析
     */
    async startAnalysis() {
        if (this.uploadQueue.length === 0) {
            this.showError('请先导入简历文件文件');
            return;
        }

        // 显示分析模态框
        this.showAnalysisModal();

        try {
            // 逐个处理文件
            for (let fileData of this.uploadQueue) {
                await this.processFile(fileData);
            }

            setTimeout(() => {
                var fn = (typeof window.renderSingleAnalysisResult==='function') ? window.renderSingleAnalysisResult : null;
                if (fn) fn();
                this.hideAnalysisModal();
            }, 2000);

        } catch (error) {
            console.error('分析过程中出现错误:', error);
            this.showError('分析过程中出现错误，请重试');
            this.hideAnalysisModal();
        }
    }

    /**
     * 处理单个文件
     */
    async processFile(fileData) {
        // 更新状态为上传中
        fileData.status = 'uploading';
        this.updateFileList();

        // 模拟文件上传进度
        for (let progress = 0; progress <= 100; progress += 10) {
            fileData.progress = progress;
            this.updateFileList();
            await this.delay(100);
        }

        // 模拟文件解析
        const parsedData = await this.parseResumeContent(fileData.file);
        fileData.parsedData = parsedData;
        fileData.status = 'completed';
        
        // 保存到本地存储
        this.saveToLocalStorage(fileData);
        
        this.updateFileList();
    }

    /**
     * 解析简历内容
     */
    async parseResumeContent(file) {
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            const result = await resumeDataManager.apiRequest('/ai/upload', 'POST', formData, false);
            return result.data;
        } catch (error) {
            console.error('简历解析失败:', error);
            throw error;
        }
    }

    /**
     * 保存到本地存储
     */
    saveToLocalStorage(fileData) {
        const existingData = JSON.parse(localStorage.getItem('resumeAnalysisData') || '[]');
        existingData.push({
            id: fileData.id,
            fileName: fileData.name,
            uploadTime: new Date().toISOString(),
            parsedData: fileData.parsedData
        });
        localStorage.setItem('resumeAnalysisData', JSON.stringify(existingData));
    }

    /**
     * 显示分析模态框
     */
    showAnalysisModal() {
        const modal = document.getElementById('analysis-modal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    }

    /**
     * 隐藏分析模态框
     */
    hideAnalysisModal() {
        const modal = document.getElementById('analysis-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    }

    /**
     * 显示错误信息
     */
    showError(message) {
        // 创建错误提示
        const errorDiv = document.createElement('div');
        errorDiv.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
        errorDiv.textContent = message;
        
        document.body.appendChild(errorDiv);
        
        // 3秒后自动移除
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 3000);
    }

    /**
     * 延迟函数
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 初始化简历解析器
document.addEventListener('DOMContentLoaded', () => {
    window.resumeParser = new ResumeParser();
});

// 导出类供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ResumeParser;
}
