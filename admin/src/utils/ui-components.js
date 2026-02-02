/**
 * UI组件库 - Admin适配版 (无Tailwind依赖)
 * 提供现代化的交互组件和动画效果
 */

class UIComponents {
    constructor() {
        this.init();
    }

    init() {
        this.injectStyles();
        this.setupNotificationSystem();
        this.setupModalSystem();
    }

    injectStyles() {
        if (document.getElementById('ui-components-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'ui-components-styles';
        style.textContent = `
            /* Notification Styles */
            .ui-notification-container {
                position: fixed;
                top: 1rem;
                right: 1rem;
                z-index: 9999;
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
                pointer-events: none;
            }
            
            .ui-notification {
                pointer-events: auto;
                display: flex;
                align-items: center;
                gap: 0.75rem;
                padding: 1rem;
                border-radius: 0.5rem;
                color: white;
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
                max-width: 24rem;
                width: 100%;
                transform: translateX(400px);
                opacity: 0;
                transition: all 0.3s ease;
                animation: uiSlideInRight 0.3s ease forwards;
            }
            
            .ui-notification.hide {
                animation: uiSlideOutRight 0.3s ease forwards;
            }
            
            @keyframes uiSlideInRight {
                to { transform: translateX(0); opacity: 1; }
            }
            
            @keyframes uiSlideOutRight {
                to { transform: translateX(400px); opacity: 0; }
            }
            
            .ui-notification-success { background: linear-gradient(135deg, #10b981, #059669); }
            .ui-notification-error { background: linear-gradient(135deg, #ef4444, #dc2626); }
            .ui-notification-warning { background: linear-gradient(135deg, #f59e0b, #d97706); }
            .ui-notification-info { background: linear-gradient(135deg, #3b82f6, #1d4ed8); }
            
            .ui-notification-close {
                background: transparent;
                border: none;
                color: white;
                cursor: pointer;
                padding: 0.25rem;
                margin-left: auto;
                opacity: 0.8;
            }
            
            .ui-notification-close:hover { opacity: 1; }

            /* Modal Styles */
            .ui-modal-container {
                position: fixed;
                inset: 0;
                z-index: 9998;
                display: none;
                align-items: center;
                justify-content: center;
            }
            
            .ui-modal-container.active {
                display: flex;
            }
            
            .ui-modal-backdrop {
                position: fixed;
                inset: 0;
                background-color: rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(4px);
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            
            .ui-modal-backdrop.active {
                opacity: 1;
            }
            
            .ui-modal-content {
                position: relative;
                background-color: white;
                border-radius: 0.75rem;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                width: 100%;
                max-width: 32rem;
                margin: 1rem;
                transform: scale(0.95) translateY(10px);
                opacity: 0;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                overflow: hidden;
            }
            
            .ui-modal-content.active {
                transform: scale(1) translateY(0);
                opacity: 1;
            }
            
            .ui-modal-body {
                padding: 1.5rem;
                text-align: center;
            }
            
            .ui-modal-icon {
                margin: 0 auto;
                display: flex;
                height: 3rem;
                width: 3rem;
                align-items: center;
                justify-content: center;
                border-radius: 9999px;
                margin-bottom: 1rem;
            }
            
            .ui-modal-title {
                font-size: 1.125rem;
                font-weight: 600;
                line-height: 1.5rem;
                color: #111827;
                margin-bottom: 0.5rem;
            }
            
            .ui-modal-text {
                font-size: 0.875rem;
                color: #6b7280;
            }
            
            .ui-modal-footer {
                background-color: #f9fafb;
                padding: 0.75rem 1rem;
                display: flex;
                flex-direction: row-reverse;
                gap: 0.75rem;
                border-bottom-left-radius: 0.75rem;
                border-bottom-right-radius: 0.75rem;
            }
            
            .ui-btn {
                display: inline-flex;
                justify-content: center;
                border-radius: 0.5rem;
                padding: 0.5rem 0.75rem;
                font-size: 0.875rem;
                font-weight: 600;
                box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
                cursor: pointer;
                transition: all 0.2s;
                border: 1px solid transparent;
            }
            
            .ui-btn:active { transform: scale(0.98); }
            
            .ui-btn-primary {
                background-color: #2563eb;
                color: white;
            }
            .ui-btn-primary:hover { background-color: #1d4ed8; }
            
            .ui-btn-danger {
                background-color: #dc2626;
                color: white;
            }
            .ui-btn-danger:hover { background-color: #b91c1c; }
            
            .ui-btn-warning {
                background-color: #f59e0b;
                color: white;
            }
            .ui-btn-warning:hover { background-color: #d97706; }
            
            .ui-btn-white {
                background-color: white;
                color: #111827;
                border-color: #d1d5db;
            }
            .ui-btn-white:hover { background-color: #f9fafb; }
            
            .ui-input {
                display: block;
                width: 100%;
                border-radius: 0.5rem;
                border: 1px solid #d1d5db;
                padding: 0.625rem;
                color: #111827;
                font-size: 0.875rem;
                margin-top: 1rem;
            }
            
            .ui-input:focus {
                outline: 2px solid #2563eb;
                border-color: #2563eb;
            }
        `;
        document.head.appendChild(style);
    }

    setupNotificationSystem() {
        if (!document.getElementById('ui-notification-container')) {
            const container = document.createElement('div');
            container.id = 'ui-notification-container';
            container.className = 'ui-notification-container';
            document.body.appendChild(container);
        }
    }

    setupModalSystem() {
        if (document.getElementById('ui-modal-container')) return;

        const container = document.createElement('div');
        container.id = 'ui-modal-container';
        container.className = 'ui-modal-container';
        container.innerHTML = `
            <div class="ui-modal-backdrop" id="ui-modal-backdrop"></div>
            <div class="ui-modal-content" id="ui-modal-content">
                <!-- Content -->
            </div>
        `;
        document.body.appendChild(container);
    }

    showNotification(message, type = 'info', duration = 3000) {
        const container = document.getElementById('ui-notification-container');
        if (!container) {
            this.setupNotificationSystem();
            return this.showNotification(message, type, duration);
        }

        let msg = message;
        if (msg && typeof msg === 'object') {
            if (typeof msg.message === 'string') {
                msg = msg.code ? `${msg.code}: ${msg.message}` : msg.message;
            } else {
                try { msg = JSON.stringify(msg); } catch (_) { msg = String(msg); }
            }
        }
        if (msg === null || msg === undefined) msg = '';
        if (typeof msg !== 'string') msg = String(msg);
        
        const notification = document.createElement('div');
        const icons = {
            success: '✓',
            error: '✕',
            warning: '!',
            info: 'i'
        };
        
        notification.className = `ui-notification ui-notification-${type}`;
        notification.innerHTML = `
            <div style="font-weight: bold; font-size: 1.2rem;">${icons[type]}</div>
            <div style="flex: 1; font-weight: 500;">${msg}</div>
            <button class="ui-notification-close">✕</button>
        `;
        
        container.appendChild(notification);
        
        if (duration > 0) {
            setTimeout(() => this.hideNotification(notification), duration);
        }
        
        notification.querySelector('.ui-notification-close').onclick = () => {
            this.hideNotification(notification);
        };
    }

    hideNotification(notification) {
        notification.classList.add('hide');
        setTimeout(() => notification.remove(), 300);
    }

    showModal(content, options = {}) {
        const container = document.getElementById('ui-modal-container');
        const contentArea = document.getElementById('ui-modal-content');
        const backdrop = document.getElementById('ui-modal-backdrop');
        
        contentArea.innerHTML = content;
        container.classList.add('active');
        
        // Force reflow
        void container.offsetWidth;
        
        backdrop.classList.add('active');
        contentArea.classList.add('active');
        
        const close = () => {
            this.hideModal();
            if (options.onClose) options.onClose();
        };

        if (options.closeOnBackdrop) {
            // Remove old listeners
            const newBackdrop = backdrop.cloneNode(true);
            backdrop.parentNode.replaceChild(newBackdrop, backdrop);
            newBackdrop.classList.add('active'); // Ensure active class is kept
            newBackdrop.addEventListener('click', close);
        }

        document.body.style.overflow = 'hidden';
    }

    hideModal() {
        const container = document.getElementById('ui-modal-container');
        const contentArea = document.getElementById('ui-modal-content');
        const backdrop = document.querySelector('.ui-modal-backdrop'); // Re-select as it might have been replaced
        
        contentArea.classList.remove('active');
        backdrop.classList.remove('active');
        
        setTimeout(() => {
            container.classList.remove('active');
            contentArea.innerHTML = '';
            document.body.style.overflow = '';
        }, 300);
    }

    showConfirm(message, onConfirm, onCancel, options = {}) {
        const { title = '确认', type = 'warning' } = options;
        const icons = {
            warning: '<div class="ui-modal-icon" style="background-color: #fef3c7; color: #d97706;"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width:1.5rem;height:1.5rem;"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg></div>',
            info: '<div class="ui-modal-icon" style="background-color: #dbeafe; color: #2563eb;"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width:1.5rem;height:1.5rem;"><path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg></div>',
            danger: '<div class="ui-modal-icon" style="background-color: #fee2e2; color: #dc2626;"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width:1.5rem;height:1.5rem;"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg></div>'
        };
        
        const btnClass = type === 'danger' ? 'ui-btn-danger' : 'ui-btn-primary';
        
        const content = `
            <div class="ui-modal-body">
                ${icons[type] || icons.warning}
                <h3 class="ui-modal-title">${title}</h3>
                <div class="ui-modal-text">
                    <p>${message}</p>
                </div>
            </div>
            <div class="ui-modal-footer">
                <button type="button" class="ui-btn ${btnClass} btn-confirm">
                    确定
                </button>
                <button type="button" class="ui-btn ui-btn-white btn-cancel">
                    取消
                </button>
            </div>
        `;

        this.showModal(content, { closeOnBackdrop: true, onClose: onCancel });
        
        const confirmBtn = document.querySelector('#ui-modal-content .btn-confirm');
        const cancelBtn = document.querySelector('#ui-modal-content .btn-cancel');
        
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
    
    showAlert(message, options = {}) {
        this.showConfirm(message, options.onConfirm, null, { ...options, title: options.title || '提示', type: options.type || 'info' });
        // Hide cancel button for alert
        setTimeout(() => {
            const cancelBtn = document.querySelector('#ui-modal-content .btn-cancel');
            if (cancelBtn) cancelBtn.style.display = 'none';
        }, 0);
    }
}

export const ui = new UIComponents();
export default ui;
