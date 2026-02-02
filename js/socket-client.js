/**
 * Socket.io Client Wrapper
 */
(function(window) {
    if (window.SocketClient) return;

    const SocketClient = {
        socket: null,
        
        /**
         * 初始化 Socket 连接
         */
        init() {
            if (this.socket) return this.socket;
            
            // 动态加载 socket.io 客户端库
            if (typeof io === 'undefined') {
                const script = document.createElement('script');
                script.src = 'https://cdn.socket.io/4.7.2/socket.io.min.js';
                script.async = true;
                script.onload = () => this._connect();
                script.onerror = () => {
                    console.error('[Socket] Failed to load socket.io from CDN, trying fallback...');
                    const fallback = document.createElement('script');
                    fallback.src = '/socket.io/socket.io.js';
                    fallback.onload = () => this._connect();
                    document.head.appendChild(fallback);
                };
                document.head.appendChild(script);
            } else {
                this._connect();
            }
        },
        
        _connect() {
            if (typeof io === 'undefined') return;
            
            // 自动判断连接地址
            const socketUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                ? 'http://localhost:3000'
                : window.location.origin;

            console.log(`[Socket] Connecting to ${socketUrl}...`);
            this.socket = io(socketUrl, {
                transports: ['websocket', 'polling'],
                reconnectionAttempts: 5,
                timeout: 10000
            });
            
            this.socket.on('connect', () => {
                console.log('[Socket] Connected to server');
            });
            
            this.socket.on('disconnect', () => {
                console.log('[Socket] Disconnected from server');
            });
            
            return this.socket;
        },
        
        /**
         * 订阅简历解析状态
         * @param {string} resumeId 
         * @param {Object} callbacks 回调函数对象
         */
        subscribeAnalysis(resumeId, callbacks = {}) {
            if (!this.socket) {
                this.init();
                // 如果 socket 还没准备好，等待连接后再执行
                setTimeout(() => this.subscribeAnalysis(resumeId, callbacks), 500);
                return;
            }
            
            const room = `resume_${resumeId}`;
            this.socket.emit('subscribe', room);
            
            if (callbacks.onProgress) {
                this.socket.on('analysis_progress', (data) => {
                    if (data.resumeId === resumeId || room === `resume_${data.resumeId}`) {
                        callbacks.onProgress(data);
                    }
                });
            }
            
            if (callbacks.onCompleted) {
                this.socket.on('analysis_completed', (data) => {
                    if (String(data.resumeId) === String(resumeId)) {
                        callbacks.onCompleted(data);
                        // 完成后自动退订
                        this.unsubscribeAnalysis(resumeId);
                    }
                });
            }
            
            if (callbacks.onFailed) {
                this.socket.on('analysis_failed', (data) => {
                    if (String(data.resumeId) === String(resumeId)) {
                        callbacks.onFailed(data);
                        this.unsubscribeAnalysis(resumeId);
                    }
                });
            }
        },
        
        unsubscribeAnalysis(resumeId) {
            if (this.socket) {
                this.socket.emit('unsubscribe', `resume_${resumeId}`);
            }
        }
    };

    // 自动初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => SocketClient.init());
    } else {
        SocketClient.init();
    }

    window.SocketClient = SocketClient;
})(window);
