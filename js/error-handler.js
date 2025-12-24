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
                errorDiv.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 max-w-sm';
                document.body.appendChild(errorDiv);
            }
            
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
            
            // 5秒后自动隐藏
            setTimeout(() => {
                if (errorDiv) {
                    errorDiv.style.display = 'none';
                }
            }, 5000);
        }
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
                successDiv.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 max-w-sm';
                document.body.appendChild(successDiv);
            }
            
            successDiv.textContent = message;
            successDiv.style.display = 'block';
            
            // 3秒后自动隐藏
            setTimeout(() => {
                if (successDiv) {
                    successDiv.style.display = 'none';
                }
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
                loadingDiv.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
                loadingDiv.innerHTML = `
                    <div class="bg-white p-6 rounded-lg shadow-xl flex items-center">
                        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-4"></div>
                        <span class="text-gray-700">${message}</span>
                    </div>
                `;
                document.body.appendChild(loadingDiv);
            } else {
                loadingDiv.style.display = 'flex';
                // 更新消息
                const messageSpan = loadingDiv.querySelector('span');
                if (messageSpan) {
                    messageSpan.textContent = message;
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