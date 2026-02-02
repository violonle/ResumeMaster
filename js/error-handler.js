/**
 * 全局错误处理模块
 * 提供统一的错误显示、成功消息和加载状态管理
 */

class ErrorHandler {
    /**
     * 显示错误消息
     * @param {string} message - 错误消息
     * @param {string} elementId - 可选的元素ID，用于显示错误消息
     */
    static showError(message, elementId = null) {
        // 如果 message 是对象且包含 status，尝试作为 API 错误处理
        if (typeof message === 'object' && message !== null && (message.status || message.message)) {
            return this.handleApiError(message);
        }

        if (elementId) {
            // 在指定元素中显示错误
            const element = document.getElementById(elementId);
            if (element) {
                element.textContent = message;
                element.className = 'text-red-500 text-sm mt-1';
                element.style.display = 'block';
                
                // 5秒后自动隐藏
                setTimeout(() => {
                    element.style.display = 'none';
                }, 5000);
            }
        } else {
            // 显示全局错误消息
            let errorDiv = document.getElementById('global-error-message');
            if (!errorDiv) {
                errorDiv = document.createElement('div');
                errorDiv.id = 'global-error-message';
                errorDiv.className = 'fixed top-6 right-6 bg-white border-l-4 border-red-500 text-gray-900 px-6 py-4 rounded-xl shadow-2xl z-[100] max-w-sm transform translate-x-full transition-transform duration-300 ease-out flex items-center space-x-3';
                document.body.appendChild(errorDiv);
                
                // 添加图标
                const icon = document.createElement('div');
                icon.className = 'w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center flex-shrink-0';
                icon.innerHTML = '<i class="fas fa-circle-xmark text-lg"></i>';
                errorDiv.appendChild(icon);
                
                const content = document.createElement('div');
                content.className = 'flex-1';
                
                const title = document.createElement('h4');
                title.className = 'text-sm font-black text-gray-900 mb-0.5';
                title.textContent = '操作失败';
                content.appendChild(title);
                
                const text = document.createElement('p');
                text.id = 'global-error-text';
                text.className = 'text-xs font-bold text-gray-500 leading-relaxed';
                content.appendChild(text);
                
                errorDiv.appendChild(content);
            }
            
            const errorText = document.getElementById('global-error-text');
            if (errorText) errorText.textContent = message;
            
            errorDiv.style.display = 'flex';
            setTimeout(() => {
                errorDiv.classList.remove('translate-x-full');
            }, 10);
            
            // 5秒后自动隐藏
            if (window._errorTimer) clearTimeout(window._errorTimer);
            window._errorTimer = setTimeout(() => {
                errorDiv.classList.add('translate-x-full');
                setTimeout(() => {
                    errorDiv.style.display = 'none';
                }, 300);
            }, 5000);
        }
    }

    /**
     * 处理 API 错误并返回友好提示
     * @param {Object} error - 错误对象
     * @returns {string} - 友好提示消息
     */
    static handleApiError(error) {
        let message = '请求发生未知错误，请稍后重试';
        
        if (error && error.status) {
            switch (error.status) {
                case 400: message = error.message || '请求参数有误，请检查输入'; break;
                case 401: message = '您的会话已过期，请重新登录'; break;
                case 403: message = '您没有权限执行此操作'; break;
                case 404: message = '请求的资源不存在'; break;
                case 500: message = '服务器内部错误，请稍后重试'; break;
                case 502: message = '网关错误，服务器可能正在维护'; break;
                case 503: message = '服务暂不可用，请稍后再试'; break;
                case 504: message = '请求超时，请检查网络连接'; break;
                default: message = error.message || `请求失败 (${error.status})`;
            }
        } else if (error && error.message) {
            if (error.message.includes('Failed to fetch')) {
                message = '网络连接失败，请检查您的网络';
            } else {
                message = error.message;
            }
        }
        
        // 调用显示错误
        this.showError(message);
        return message;
    }
    
    /**
     * 显示成功消息
     * @param {string} message - 成功消息
     * @param {string} elementId - 可选的元素ID，用于显示成功消息
     */
    static showSuccess(message, elementId = null) {
        if (elementId) {
            // 在指定元素中显示成功消息
            const element = document.getElementById(elementId);
            if (element) {
                element.textContent = message;
                element.className = 'text-green-500 text-sm mt-1';
                element.style.display = 'block';
                
                // 3秒后自动隐藏
                setTimeout(() => {
                    element.style.display = 'none';
                }, 3000);
            }
        } else {
            // 显示全局成功消息
            let successDiv = document.getElementById('global-success-message');
            if (!successDiv) {
                successDiv = document.createElement('div');
                successDiv.id = 'global-success-message';
                successDiv.className = 'fixed top-6 right-6 bg-white border-l-4 border-emerald-500 text-gray-900 px-6 py-4 rounded-xl shadow-2xl z-[100] max-w-sm transform translate-x-full transition-transform duration-300 ease-out flex items-center space-x-3';
                document.body.appendChild(successDiv);
                
                // 添加图标
                const icon = document.createElement('div');
                icon.className = 'w-10 h-10 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center flex-shrink-0';
                icon.innerHTML = '<i class="fas fa-circle-check text-lg"></i>';
                successDiv.appendChild(icon);
                
                const content = document.createElement('div');
                content.className = 'flex-1';
                
                const title = document.createElement('h4');
                title.className = 'text-sm font-black text-gray-900 mb-0.5';
                title.textContent = '操作成功';
                content.appendChild(title);
                
                const text = document.createElement('p');
                text.id = 'global-success-text';
                text.className = 'text-xs font-bold text-gray-500 leading-relaxed';
                content.appendChild(text);
                
                successDiv.appendChild(content);
            }
            
            const successText = document.getElementById('global-success-text');
            if (successText) successText.textContent = message;
            
            successDiv.style.display = 'flex';
            setTimeout(() => {
                successDiv.classList.remove('translate-x-full');
            }, 10);
            
            // 3秒后自动隐藏
            if (window._successTimer) clearTimeout(window._successTimer);
            window._successTimer = setTimeout(() => {
                successDiv.classList.add('translate-x-full');
                setTimeout(() => {
                    successDiv.style.display = 'none';
                }, 300);
            }, 3000);
        }
    }
    
    /**
     * 显示或隐藏加载状态
     * @param {boolean} show - 是否显示加载状态
     * @param {string} message - 加载消息
     */
    static showLoading(show = true, message = '加载中...') {
        let loadingDiv = document.getElementById('global-loading');
        if (show) {
            if (!loadingDiv) {
                loadingDiv = document.createElement('div');
                loadingDiv.id = 'global-loading';
                loadingDiv.className = 'fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-[200] transition-opacity duration-300';
                loadingDiv.innerHTML = `
                    <div class="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center space-y-4 max-w-xs w-full">
                        <div class="relative w-16 h-16">
                            <div class="absolute inset-0 rounded-full border-4 border-blue-50"></div>
                            <div class="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
                        </div>
                        <div class="text-center">
                            <h4 class="text-sm font-black text-gray-900 mb-1">正在处理</h4>
                            <p class="text-xs font-bold text-gray-500 loading-message">${message}</p>
                        </div>
                    </div>
                `;
                document.body.appendChild(loadingDiv);
            } else {
                loadingDiv.style.display = 'flex';
                const messageP = loadingDiv.querySelector('.loading-message');
                if (messageP) {
                    messageP.textContent = message;
                }
            }
        } else if (loadingDiv) {
            loadingDiv.style.display = 'none';
        }
    }
    
    /**
     * 在按钮上显示加载状态
     * @param {HTMLElement} button - 按钮元素
     * @param {boolean} loading - 是否显示加载状态
     * @param {string} loadingText - 加载时显示的文本
     */
    static setButtonLoading(button, loading = true, loadingText = '处理中...') {
        if (loading) {
            button.setAttribute('data-original-text', button.innerHTML);
            button.innerHTML = `<div class="flex items-center"><div class="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>${loadingText}</div>`;
            button.disabled = true;
        } else {
            const originalText = button.getAttribute('data-original-text');
            if (originalText) {
                button.innerHTML = originalText;
            }
            button.disabled = false;
        }
    }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ErrorHandler;
} else {
    window.ErrorHandler = ErrorHandler;
}