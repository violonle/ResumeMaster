/**
 * UI组件库 - 增强用户体验
 * 提供现代化的交互组件和动画效果
 */

class UIComponents {
    constructor() {
        this.init();
    }

    init() {
        this.setupNotificationSystem();
        this.setupLoadingStates();
        this.setupModalSystem();
        this.setupTooltipSystem();
        this.setupFooter();
    }

    /**
     * 全局页脚注入 - 确保全站版权信息一致性
     */
    setupFooter() {
        try {
            const inject = () => {
                // 检查是否已存在包含版权信息的页脚
                const bodyText = document.body.innerText;
                if (bodyText.includes('鲁ICP备2023016452号')) {
                    return;
                }

                const footer = document.createElement('footer');
                footer.className = 'py-6 text-center text-gray-400 text-xs mt-auto border-t border-gray-100 w-full bg-white bg-opacity-50';
                footer.innerHTML = `
                    <div class="container mx-auto px-4">
                        <p>云璞网科 © 2018-2025  <a href="https://beian.miit.gov.cn/" target="_blank" class="hover:text-blue-500 transition-colors">鲁ICP备2023016452号</a></p>
                    </div>
                `;

                // 尝试找到主内容区域
                const mainContent = document.getElementById('main-content') || document.querySelector('main');
                
                if (mainContent) {
                    // 确保父容器是 flex 布局以支持 mt-auto 效果
                    const parent = mainContent.parentElement;
                    if (parent) {
                        parent.classList.add('flex', 'flex-col', 'min-h-screen');
                    }
                    mainContent.classList.add('flex-1');
                    mainContent.after(footer);
                } else {
                    document.body.classList.add('flex', 'flex-col', 'min-h-screen');
                    document.body.appendChild(footer);
                }
            };

            if (document.readyState === 'complete') inject();
            else window.addEventListener('load', inject);
        } catch (error) {
            console.warn('页脚注入失败:', error);
        }
    }

    /**
     * 通知系统 (Toast)
     */
    setupNotificationSystem() {
        try {
            // 检查是否已存在通知容器
            let notificationContainer = document.getElementById('notification-container');
            if (!notificationContainer) {
                notificationContainer = document.createElement('div');
                notificationContainer.id = 'notification-container';
                notificationContainer.className = 'fixed top-4 right-4 z-[110] space-y-2';
                
                const mount = () => document.body.appendChild(notificationContainer);
                if (document.body) mount();
                else document.addEventListener('DOMContentLoaded', mount);
            }

            // 添加通知样式
            const style = document.createElement('style');
            style.textContent = `
                .notification {
                    transform: translateX(400px);
                    opacity: 0;
                    transition: all 0.3s ease;
                    animation: slideInRight 0.3s ease forwards;
                }
                .notification.hide {
                    animation: slideOutRight 0.3s ease forwards;
                }
                @keyframes slideInRight {
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOutRight {
                    to { transform: translateX(400px); opacity: 0; }
                }
                .notification-success { background: linear-gradient(135deg, #10b981, #059669); }
                .notification-error { background: linear-gradient(135deg, #ef4444, #dc2626); }
                .notification-warning { background: linear-gradient(135deg, #6366f1, #4f46e5); }
                .notification-info { background: linear-gradient(135deg, #3b82f6, #1d4ed8); }
            `;
            document.head.appendChild(style);
        } catch (error) {
            console.warn('通知系统初始化失败:', error);
        }
    }

    /**
     * 显示通知
     * @param {string} message - 通知消息
     * @param {string} type - 通知类型 (success, error, warning, info)
     * @param {number} duration - 显示时长（毫秒）
     */
    showNotification(message, type = 'info', duration = 3000) {
        try {
            const container = document.getElementById('notification-container');
            if (!container) {
                this.setupNotificationSystem();
                return;
            }
            
            const notification = document.createElement('div');
            const icons = {
                success: 'fa-check-circle',
                error: 'fa-exclamation-circle',
                warning: 'fa-exclamation-triangle',
                info: 'fa-info-circle'
            };
            
            notification.className = `notification notification-${type} text-white p-4 rounded-lg shadow-lg max-w-sm flex items-center space-x-3 pointer-events-auto`;
            notification.innerHTML = `
                <i class="fas ${icons[type]} text-xl"></i>
                <div class="flex-1 font-medium">${message}</div>
                <button class="notification-close text-white hover:text-gray-200 focus:outline-none">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            container.appendChild(notification);
            
            // 自动移除
            if (duration > 0) {
                setTimeout(() => this.hideNotification(notification), duration);
            }
            
            // 手动关闭
            const closeButton = notification.querySelector('.notification-close');
            if (closeButton) {
                closeButton.addEventListener('click', () => this.hideNotification(notification));
            }
        } catch (error) {
            console.error('显示通知失败:', error);
        }
    }

    showToast(message, type = 'info', duration = 3000) {
        this.showNotification(message, type, duration);
    }

    hideNotification(notification) {
        notification.classList.add('hide');
        setTimeout(() => notification.remove(), 300);
    }

    /**
     * 全局加载状态管理
     */
    showLoading(message = '正在处理...') {
        try {
            let loader = document.getElementById('global-loader');
            if (!loader) {
                loader = document.createElement('div');
                loader.id = 'global-loader';
                loader.className = 'fixed inset-0 z-[200] flex items-center justify-center bg-white/60 backdrop-blur-[2px] transition-opacity duration-300 opacity-0';
                loader.innerHTML = `
                    <div class="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center space-y-4 border border-gray-100 max-w-xs w-full mx-4">
                        <div class="relative">
                            <div class="w-12 h-12 border-4 border-blue-100 rounded-full"></div>
                            <div class="w-12 h-12 border-4 border-blue-600 rounded-full border-t-transparent animate-spin absolute inset-0"></div>
                        </div>
                        <p class="text-gray-600 font-medium text-center" id="global-loader-message">${message}</p>
                    </div>
                `;
                document.body.appendChild(loader);
            } else {
                document.getElementById('global-loader-message').textContent = message;
            }
            
            loader.classList.remove('hidden');
            requestAnimationFrame(() => {
                loader.classList.add('opacity-100');
            });
            document.body.style.overflow = 'hidden';
        } catch (error) {
            console.error('显示加载状态失败:', error);
        }
    }

    hideLoading() {
        try {
            const loader = document.getElementById('global-loader');
            const analysisLoader = document.getElementById('analysis-loader');
            
            // Clear analysis timer if it exists
            if (this.analysisTimer) {
                clearTimeout(this.analysisTimer);
                this.analysisTimer = null;
            }
            
            if (loader) {
                loader.classList.remove('opacity-100');
                loader.classList.add('opacity-0');
                setTimeout(() => {
                    loader.classList.add('hidden');
                    if (!analysisLoader || analysisLoader.classList.contains('hidden')) {
                        document.body.style.overflow = '';
                    }
                }, 300);
            }

            if (analysisLoader) {
                analysisLoader.classList.remove('opacity-100');
                analysisLoader.classList.add('opacity-0');
                setTimeout(() => {
                    analysisLoader.classList.add('hidden');
                    if (!loader || loader.classList.contains('hidden')) {
                        document.body.style.overflow = '';
                    }
                }, 300);
            }
        } catch (error) {
            console.error('隐藏加载状态失败:', error);
        }
    }

    /**
     * 深度解析专用加载蒙层
     */
    showAnalysisLoading() {
        try {
            let loader = document.getElementById('analysis-loader');
            if (!loader) {
                loader = document.createElement('div');
                loader.id = 'analysis-loader';
                // 使用全屏白色背景+毛玻璃效果，与 resume-tools.html 保持一致
                loader.className = 'fixed inset-0 z-[300] flex flex-col items-center justify-center bg-white/90 backdrop-blur-md transition-opacity duration-300 opacity-0 p-6';
                loader.innerHTML = `
                    <div class="w-20 h-20 relative mb-8">
                        <div class="absolute inset-0 border-4 border-blue-100 rounded-full"></div>
                        <div class="absolute inset-0 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <div class="absolute inset-0 flex items-center justify-center">
                            <i class="fas fa-robot text-2xl text-blue-600 animate-pulse"></i>
                        </div>
                    </div>
                    
                    <h3 class="text-xl font-black text-gray-900 mb-2">AI 正在深度解析中...</h3>
                    <p class="text-gray-500 text-sm mb-4">这可能需要 15-30 秒，请勿刷新页面</p>
                    
                    <div id="analysis-long-wait-msg" class="hidden mb-6 text-center">
                        <p class="text-blue-600 font-bold text-sm mb-1">解析报告正在生成中...</p>
                        <p class="text-gray-400 text-xs">您可以关闭本页，稍后在“解析记录”中查看，或者刷新当前页。</p>
                    </div>
                    
                    <div class="w-full max-w-md bg-gray-100 h-2 rounded-full overflow-hidden shadow-inner mb-10">
                        <div class="progress-bar-inner h-full bg-gradient-to-r from-blue-500 to-blue-700 transition-all duration-500 ease-out" style="width: 30%"></div>
                    </div>

                    <div id="analysis-loading-actions" class="hidden flex items-center gap-4 mb-10">
                        <button id="analysis-view-results-btn" class="hidden px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100">
                            查看解析报告
                        </button>
                        <a href="javascript:location.reload()" class="px-6 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all">
                            返回深度解析
                        </a>
                        <a href="analysis-records.html" class="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100">
                            前往解析记录
                        </a>
                    </div>
                    
                    <div class="grid grid-cols-3 gap-8 w-full max-w-lg">
                        <div class="flex flex-col items-center">
                            <div class="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 mb-2">
                                <i class="fas fa-file-alt"></i>
                            </div>
                            <span class="text-[10px] font-bold text-gray-400 uppercase">读取简历</span>
                        </div>
                        <div class="flex flex-col items-center">
                            <div class="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 mb-2">
                                <i class="fas fa-brain"></i>
                            </div>
                            <span class="text-[10px] font-bold text-gray-400 uppercase">逻辑推理</span>
                        </div>
                        <div class="flex flex-col items-center">
                            <div class="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 mb-2">
                                <i class="fas fa-chart-bar"></i>
                            </div>
                            <span class="text-[10px] font-bold text-gray-400 uppercase">生成报告</span>
                        </div>
                    </div>
                `;
                document.body.appendChild(loader);
            }
            
            loader.classList.remove('hidden');
            requestAnimationFrame(() => {
                loader.classList.add('opacity-100');
            });
            document.body.style.overflow = 'hidden';

            // 2.5秒后显示手动跳转按钮
            if (this.analysisActionTimer) clearTimeout(this.analysisActionTimer);
            this.analysisActionTimer = setTimeout(() => {
                const longWaitMsg = document.getElementById('analysis-long-wait-msg');
                const loadingActions = document.getElementById('analysis-loading-actions');
                if (longWaitMsg) {
                    longWaitMsg.classList.remove('hidden');
                    longWaitMsg.classList.add('animate-fadeIn');
                }
                if (loadingActions) {
                    loadingActions.classList.remove('hidden');
                    loadingActions.classList.add('animate-fadeIn');
                }
                this.loadingActionsVisible = true;
            }, 2500);

            // 60秒后自动关闭（保险机制）
            if (this.analysisTimer) clearTimeout(this.analysisTimer);
            this.analysisTimer = setTimeout(() => {
                this.hideLoading();
            }, 60000);

        } catch (error) {
            console.error('显示深度解析加载状态失败:', error);
        }
    }

    /**
     * 加载状态管理
     */
    setupLoadingStates() {
        const style = document.createElement('style');
        style.textContent = `
            .loading-shimmer {
                background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                background-size: 200% 100%;
                animation: shimmer 1.5s infinite;
            }
            @keyframes shimmer {
                0% { background-position: -200% 0; }
                100% { background-position: 200% 0; }
            }
            .btn-loading {
                position: relative;
                color: transparent !important;
                pointer-events: none;
            }
            .btn-loading::after {
                content: '';
                position: absolute;
                width: 16px;
                height: 16px;
                top: 50%;
                left: 50%;
                margin-left: -8px;
                margin-top: -8px;
                border: 2px solid #ffffff;
                border-radius: 50%;
                border-top-color: transparent;
                animation: spin 0.8s linear infinite;
            }
            @keyframes spin { to { transform: rotate(360deg); } }
            .skeleton {
                background: #f6f7f8;
                background-image: linear-gradient(to right, #f6f7f8 0%, #edeef1 20%, #f6f7f8 40%, #f6f7f8 100%);
                background-repeat: no-repeat;
                background-size: 800px 104px;
                display: inline-block;
                position: relative;
                animation: shimmer-skeleton 1s linear infinite;
            }
            @keyframes shimmer-skeleton {
                0% { background-position: -468px 0; }
                100% { background-position: 468px 0; }
            }
        `;
        document.head.appendChild(style);
    }

    setButtonLoading(button, loading = true) {
        if (loading) {
            button.classList.add('btn-loading');
            button.disabled = true;
        } else {
            button.classList.remove('btn-loading');
            button.disabled = false;
        }
    }

    /**
     * 模态框系统 (Alert, Confirm, Prompt)
     */
    setupModalSystem() {
        if (document.getElementById('modal-container')) return;

        const modalContainer = document.createElement('div');
        modalContainer.id = 'modal-container';
        modalContainer.className = 'fixed inset-0 z-[100] hidden';
        modalContainer.innerHTML = `
            <div class="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" id="modal-backdrop"></div>
            <div class="fixed inset-0 z-10 overflow-y-auto">
                <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                    <div id="modal-content" class="relative transform overflow-hidden rounded-xl bg-white text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-lg border border-gray-100">
                        <!-- Content -->
                    </div>
                </div>
            </div>
        `;
        
        const mount = () => document.body.appendChild(modalContainer);
        if (document.body) mount();
        else document.addEventListener('DOMContentLoaded', mount);

        const style = document.createElement('style');
        style.textContent = `
            .modal-enter-active {
                opacity: 1;
                transform: scale(1) translateY(0);
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }
            .modal-exit-active {
                opacity: 0;
                transform: scale(0.95) translateY(10px);
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            }
            .btn-click-effect { transition: transform 0.1s; }
            .btn-click-effect:active { transform: scale(0.95); }
        `;
        document.head.appendChild(style);
    }

    showModal(content, options = {}) {
        const container = document.getElementById('modal-container');
        const contentArea = document.getElementById('modal-content');
        const backdrop = document.getElementById('modal-backdrop');
        
        contentArea.innerHTML = content;
        container.classList.remove('hidden');
        
        const newBackdrop = backdrop.cloneNode(true);
        backdrop.parentNode.replaceChild(newBackdrop, backdrop);
        
        if (options.closeOnBackdrop) {
            newBackdrop.addEventListener('click', () => {
                this.hideModal();
                if (options.onClose) options.onClose();
            });
        }

        requestAnimationFrame(() => {
            newBackdrop.classList.add('opacity-100');
            contentArea.classList.remove('modal-exit-active');
            contentArea.classList.add('modal-enter-active');
        });
        document.body.style.overflow = 'hidden';
    }

    hideModal() {
        const container = document.getElementById('modal-container');
        const contentArea = document.getElementById('modal-content');
        const backdrop = document.getElementById('modal-backdrop');
        
        contentArea.classList.remove('modal-enter-active');
        contentArea.classList.add('modal-exit-active');
        backdrop.classList.remove('opacity-100');
        
        setTimeout(() => {
            container.classList.add('hidden');
            contentArea.classList.remove('modal-exit-active');
            contentArea.innerHTML = '';
            document.body.style.overflow = '';
        }, 200);
    }

    showAlert(message, options = {}) {
        const { title = '提示', type = 'info', onConfirm } = options;
        const icons = {
            success: '<div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100"><i class="fas fa-check text-green-600 text-xl"></i></div>',
            error: '<div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100"><i class="fas fa-times text-red-600 text-xl"></i></div>',
            warning: '<div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100"><i class="fas fa-exclamation text-indigo-600 text-xl"></i></div>',
            info: '<div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100"><i class="fas fa-info text-blue-600 text-xl"></i></div>'
        };

        const content = `
            <div class="p-6">
                <div class="text-center">
                    ${icons[type] || icons.info}
                    <h3 class="mt-4 text-lg font-semibold leading-6 text-gray-900">${title}</h3>
                    <div class="mt-2">
                        <p class="text-sm text-gray-500">${message}</p>
                    </div>
                </div>
            </div>
            <div class="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 rounded-b-xl">
                <button type="button" class="btn-confirm inline-flex w-full justify-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 sm:ml-3 sm:w-auto btn-click-effect">
                    确定
                </button>
            </div>
        `;

        this.showModal(content, { closeOnBackdrop: false });
        const confirmBtn = document.querySelector('#modal-content .btn-confirm');
        confirmBtn.focus();
        confirmBtn.onclick = () => {
            this.hideModal();
            if (onConfirm) onConfirm();
        };
    }

    showConfirm(message, onConfirm, onCancel, options = {}) {
        const { title = '确认', type = 'warning' } = options;
        const icons = {
            warning: '<div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100"><i class="fas fa-exclamation-triangle text-yellow-600 text-xl"></i></div>',
            info: '<div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100"><i class="fas fa-question text-blue-600 text-xl"></i></div>',
            danger: '<div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100"><i class="fas fa-exclamation-triangle text-red-600 text-xl"></i></div>'
        };
        const confirmBtnClass = type === 'danger' ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500';

        const content = `
            <div class="p-6">
                <div class="text-center">
                    ${icons[type] || icons.warning}
                    <h3 class="mt-4 text-lg font-semibold leading-6 text-gray-900">${title}</h3>
                    <div class="mt-2">
                        <p class="text-sm text-gray-500">${message}</p>
                    </div>
                </div>
            </div>
            <div class="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 rounded-b-xl">
                <button type="button" class="btn-confirm inline-flex w-full justify-center rounded-lg ${confirmBtnClass} px-3 py-2 text-sm font-semibold text-white shadow-sm sm:ml-3 sm:w-auto btn-click-effect">
                    确定
                </button>
                <button type="button" class="btn-cancel mt-3 inline-flex w-full justify-center rounded-lg bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto btn-click-effect">
                    取消
                </button>
            </div>
        `;

        this.showModal(content, { closeOnBackdrop: true, onClose: onCancel });
        const confirmBtn = document.querySelector('#modal-content .btn-confirm');
        const cancelBtn = document.querySelector('#modal-content .btn-cancel');
        confirmBtn.focus();
        
        confirmBtn.onclick = () => {
            this.hideModal();
            if (onConfirm) onConfirm();
        };
        cancelBtn.onclick = () => {
            this.hideModal();
            if (onCancel) onCancel();
        };
    }

    showPrompt(message, onConfirm, onCancel, options = {}) {
        const { title = '请输入', defaultValue = '', placeholder = '', inputType = 'text' } = options;
        const content = `
            <div class="p-6">
                <div class="text-center sm:text-left">
                    <h3 class="text-lg font-semibold leading-6 text-gray-900 mb-4">${title}</h3>
                    <p class="text-sm text-gray-500 mb-4">${message}</p>
                    <div>
                        <input type="${inputType}" id="prompt-input" class="block w-full rounded-lg border-0 py-2.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 px-3" placeholder="${placeholder}" value="${defaultValue}">
                    </div>
                </div>
            </div>
            <div class="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 rounded-b-xl">
                <button type="button" class="btn-confirm inline-flex w-full justify-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 sm:ml-3 sm:w-auto btn-click-effect">
                    确定
                </button>
                <button type="button" class="btn-cancel mt-3 inline-flex w-full justify-center rounded-lg bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto btn-click-effect">
                    取消
                </button>
            </div>
        `;

        this.showModal(content, { closeOnBackdrop: true, onClose: onCancel });
        const input = document.getElementById('prompt-input');
        const confirmBtn = document.querySelector('#modal-content .btn-confirm');
        const cancelBtn = document.querySelector('#modal-content .btn-cancel');
        
        input.focus();
        if (defaultValue) input.select();
        
        input.onkeyup = (e) => { if (e.key === 'Enter') confirmBtn.click(); };
        confirmBtn.onclick = () => {
            const value = input.value;
            this.hideModal();
            if (onConfirm) onConfirm(value);
        };
        cancelBtn.onclick = () => {
            this.hideModal();
            if (onCancel) onCancel();
        };
    }

    /**
     * 工具提示系统
     */
    setupTooltipSystem() {
        const tooltipContainer = document.createElement('div');
        tooltipContainer.id = 'tooltip-container';
        tooltipContainer.className = 'fixed z-50 pointer-events-none hidden';
        
        const mount = () => document.body.appendChild(tooltipContainer);
        if (document.body) mount();
        else document.addEventListener('DOMContentLoaded', mount);

        const style = document.createElement('style');
        style.textContent = `
            .tooltip {
                background: rgba(0, 0, 0, 0.9);
                color: white;
                padding: 6px 10px;
                border-radius: 4px;
                font-size: 12px;
                white-space: nowrap;
                position: absolute;
                transform: translateY(-100%);
                margin-top: -8px;
            }
            .tooltip::after {
                content: '';
                position: absolute;
                bottom: -4px;
                left: 50%;
                margin-left: -4px;
                border-width: 4px 4px 0;
                border-style: solid;
                border-color: rgba(0, 0, 0, 0.9) transparent transparent transparent;
            }
        `;
        document.head.appendChild(style);

        // 全局委托
        document.addEventListener('mouseover', (e) => {
            const target = e.target.closest('[data-tooltip]');
            if (target) {
                this.showTooltip(target, target.getAttribute('data-tooltip'));
            }
        });
        document.addEventListener('mouseout', (e) => {
            const target = e.target.closest('[data-tooltip]');
            if (target) {
                this.hideTooltip();
            }
        });
    }

    showTooltip(element, text) {
        const container = document.getElementById('tooltip-container');
        if (!container) return;
        
        container.innerHTML = `<div class="tooltip">${text}</div>`;
        container.classList.remove('hidden');
        
        const rect = element.getBoundingClientRect();
        const tooltip = container.firstElementChild;
        
        // 简单定位
        tooltip.style.left = (rect.left + rect.width / 2 - tooltip.offsetWidth / 2) + 'px';
        tooltip.style.top = rect.top + 'px';
    }

    hideTooltip() {
        const container = document.getElementById('tooltip-container');
        if (container) container.classList.add('hidden');
    }

    // Helper Methods
    createSkeleton(type, count = 1) {
        const skeletons = {
            card: `<div class="bg-white rounded-lg p-6 shadow-sm mb-4"><div class="flex items-center mb-4"><div class="skeleton w-12 h-12 rounded-full"></div><div class="ml-4 flex-1"><div class="skeleton h-4 w-32 mb-2"></div><div class="skeleton h-3 w-24"></div></div></div><div class="skeleton h-4 w-full mb-2"></div><div class="skeleton h-4 w-3/4"></div></div>`,
            list: `<div class="bg-white rounded-lg p-4 shadow-sm mb-3"><div class="flex items-center"><div class="skeleton w-10 h-10 rounded-lg"></div><div class="ml-3 flex-1"><div class="skeleton h-4 w-32 mb-1"></div><div class="skeleton h-3 w-24"></div></div><div class="skeleton w-16 h-6 rounded"></div></div></div>`,
            text: `<div class="skeleton h-4 w-full mb-2"></div>`
        };
        return Array(count).fill(skeletons[type] || skeletons.text).join('');
    }

    createProgressBar(progress, color = 'blue') {
        const colors = { blue: 'bg-blue-600', green: 'bg-green-600', red: 'bg-red-600' };
        return `<div class="w-full bg-gray-200 rounded-full h-2.5"><div class="${colors[color]||colors.blue} h-2.5 rounded-full" style="width: ${progress}%"></div></div>`;
    }

    createStarRating(rating, max = 5) {
        let html = '<div class="flex text-yellow-400">';
        for (let i = 1; i <= max; i++) {
            if (i <= rating) html += '<i class="fas fa-star"></i>';
            else if (i - 0.5 <= rating) html += '<i class="fas fa-star-half-alt"></i>';
            else html += '<i class="far fa-star text-gray-300"></i>';
        }
        html += '</div>';
        return html;
    }

    smoothScrollTo(target) {
        const el = typeof target === 'string' ? document.querySelector(target) : target;
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    /**
     * 渲染头像，如果无头像则显示文字占位符
     * @param {string} avatarUrl - 头像URL
     * @param {string} name - 用户名/企业名
     * @param {string} sizeClass - 尺寸类 (e.g., 'w-12 h-12')
     * @param {string} roundedClass - 圆角类 (e.g., 'rounded-full')
     * @param {boolean} isCandidate - 是否为候选人 (候选人头像会略微放大且无边框阴影)
     */
    renderAvatar(avatarUrl, name, sizeClass = 'w-10 h-10', roundedClass = 'rounded-full', isCandidate = false) {
        // 候选人样式定制：放大一点
        let finalSizeClass = sizeClass;
        let extraClasses = 'object-cover'; // 移除所有头像的 border 和 shadow-sm
        
        if (isCandidate) {
            // 如果是候选人，且使用的是默认 w-10 尺寸，则放大到 w-12
            if (sizeClass === 'w-10 h-10') finalSizeClass = 'w-12 h-12';
            else if (sizeClass === 'w-8 h-8') finalSizeClass = 'w-10 h-10';
        }

        // 如果有真实的头像URL，则显示图片
        if (avatarUrl && avatarUrl.trim() !== '' && 
            !avatarUrl.includes('banner1.jpg') && 
            !avatarUrl.includes('pravatar.cc') &&
            !avatarUrl.includes('placeholder')) {
            return `<img src="${avatarUrl}" alt="${name}" class="${finalSizeClass} ${roundedClass} ${extraClasses}">`;
        }
        
        // 默认头像逻辑
        let finalAvatarUrl = '';
        if (isCandidate) {
            // 候选人：随机分配头像 (01.png - 10.png)
            // 使用名称进行哈希，确保同一个人的头像是一致的
            let avatarIndex = 1;
            if (name) {
                let hash = 0;
                for (let i = 0; i < name.length; i++) {
                    hash = name.charCodeAt(i) + ((hash << 5) - hash);
                }
                avatarIndex = Math.abs(hash % 10) + 1;
            } else {
                avatarIndex = Math.floor(Math.random() * 10) + 1;
            }
            const avatarFile = avatarIndex.toString().padStart(2, '0') + '.png';
            finalAvatarUrl = `/dist/avatar/${avatarFile}`;
        } else {
            // 平台用户：统一使用 dist/avatar01.png
            finalAvatarUrl = '/dist/avatar01.png';
        }

        return `<img src="${finalAvatarUrl}" alt="${name}" class="${finalSizeClass} ${roundedClass} ${extraClasses}">`;
    }
}

// Initialize
window.uiComponents = new UIComponents();
window.ui = window.uiComponents;

// Override window.alert
window.alert = function(message) {
    window.ui.showAlert(message);
};

// window.confirm and window.prompt cannot be safely overridden due to async nature.
// Developers should use ui.showConfirm and ui.showPrompt instead.
