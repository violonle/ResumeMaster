/**
 * 用户认证和权限管理模块
 * 提供登录、注册、权限验证等功能（通过API调用）
 */

class UserAuth {
    constructor() {
        this.currentUser = null;
        this.token = null;
        // 自动检测环境
        // 1. 如果在 localhost/127.0.0.1 且非 3000 端口，可能是开发环境前端，尝试连接 localhost:3000
        // 2. 如果已经在 3000 端口，使用相对路径 /api
        // 3. 生产环境下（域名访问），统一使用相对路径 /api
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const isBackendPort = window.location.port === '3000';
        
        if (isLocal && !isBackendPort) {
            this.apiBaseUrl = 'http://localhost:3000/api';
        } else {
            this.apiBaseUrl = '/api';
        }
        
        console.log('🚀 UserAuth initialized with apiBaseUrl:', this.apiBaseUrl);
        this.init();
    }

    /**
     * 初始化用户认证模块
     */
    init() {
        // 从本地存储恢复用户状态
        this.restoreUserSession();

        // 监听存储变化（多标签页同步）
        window.addEventListener('storage', (e) => {
            if (e.key === 'userInfo') {
                this.restoreUserSession();
            }
        });
    }

    // 与 ResumeDataManager 同步令牌
    syncResumeDataManager() {
        try {
            if (window.resumeDataManager && typeof window.resumeDataManager.setToken === 'function') {
                window.resumeDataManager.setToken(this.token || null);
            } else if (window.resumeDataManager) {
                window.resumeDataManager.token = this.token || null;
            }
        } catch (e) {
            console.warn('同步 ResumeDataManager 令牌失败:', e);
        }
    }

    /**
     * 发送API请求
     * @param {string} endpoint - API端点
     * @param {string} method - HTTP方法
     * @param {Object} data - 请求数据
     * @param {boolean} showLoading - 是否显示加载状态
     * @returns {Promise} - API响应
     */
    async apiRequest(endpoint, method = 'GET', data = null, showLoading = true) {
        // 显示加载状态
        if (showLoading && typeof ErrorHandler !== 'undefined') {
            ErrorHandler.showLoading(true);
        }

        const headers = {
            'Content-Type': 'application/json'
        };

        // 如果有令牌，添加到请求头
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        const options = {
            method,
            headers
        };

        // 如果有数据，添加到请求体
        if (data) {
            options.body = JSON.stringify(data);
        }

        const tryRequest = async (base) => {
            const url = `${base}${endpoint}`;
            console.log('🔍 API请求详情:', { url, method, headers, data: data ? JSON.parse(options.body) : null });
            const response = await fetch(url, options);
            const text = await response.text();

            console.log('📥 原始响应:', {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
                body: text
            });

            let result;
            try {
                result = JSON.parse(text);
            } catch (parseError) {
                console.error('❌ JSON解析失败:', parseError);
                console.error('❌ 原始响应内容:', text);
                throw new Error(`服务器返回了非JSON响应: ${text.substring(0, 200)}...`);
            }

            if (showLoading && typeof ErrorHandler !== 'undefined') { ErrorHandler.showLoading(false); }

            if (response.status === 401) {
                const serverMessage = (result && result.error && result.error.message) ? result.error.message : 'Unauthorized';
                const authEndpoints = ['/auth/login', '/auth/register', '/auth/send-code', '/auth/verify-code', '/auth/set-password'];
                if (!authEndpoints.includes(endpoint)) {
                    try {
                        window.dispatchEvent(new CustomEvent('apiUnauthorized', {
                            detail: { source: 'user-auth', endpoint }
                        }));
                    } catch (_) { }
                }
                const err = new Error(serverMessage);
                err.status = 401;
                err.url = url;
                throw err;
            }

            if (!response.ok) {
                const msg = result && result.error && result.error.message ? result.error.message : (response.statusText || '请求失败');
                const err = new Error(msg);
                err.status = response.status;
                err.url = url;
                throw err;
            }

            console.log('✅ API响应成功:', result);
            return result;
        };

        const bases = [this.apiBaseUrl, '/api'].filter(Boolean);
        let lastError;
        for (const base of bases) {
            try {
                const res = await tryRequest(base);
                this.apiBaseUrl = base;
                return res;
            } catch (err) {
                lastError = err;
                continue;
            }
        }
        if (showLoading && typeof ErrorHandler !== 'undefined') { ErrorHandler.showLoading(false); }
        console.error('❌ API请求失败:', lastError);
        if (lastError && lastError.url) { console.error('❌ 请求URL:', lastError.url); }
        if (typeof ErrorHandler !== 'undefined') { ErrorHandler.showError(lastError && lastError.message ? lastError.message : '请求失败，请稍后重试'); }
        throw lastError;
    }

    /**
     * 用户登录
     * @param {string} email - 邮箱或手机号
     * @param {string} password - 密码
     * @param {boolean} remember - 是否记住登录状态
     * @returns {Promise<Object>} 登录结果
     */
    async login(email, password, remember = false) {
        const id = String(email || '').trim();
        const isEmail = this.isValidEmail(id);
        const isPhone = /^1[3-9]\d{9}$/.test(id);
        const loginData = isEmail ? { email: id, password } : (isPhone ? { phone: id, password } : { username: id, password });

        try {
            const result = await this.apiRequest('/auth/login', 'POST', loginData);

            if (result && result.success) {
                return this.handleAuthSuccess(result);
            }

            return {
                success: false,
                message: (result && result.error && result.error.message) || '登录失败'
            };
        } catch (error) {
            console.error('登录错误:', error);
            return {
                success: false,
                message: error.message || '登录过程中发生错误'
            };
        }
    }

    handleAuthSuccess(result) {
        const userInfo = {
            user: result.data.user,
            token: result.data.token,
            isLoggedIn: true
        };
        localStorage.setItem('userInfo', JSON.stringify(userInfo));
        this.currentUser = result.data.user;
        this.token = result.data.token;
        this.syncResumeDataManager();
        this.dispatchEvent('userLogin', this.currentUser);
        return {
            success: true,
            user: result.data.user,
            token: result.data.token
        };
    }

    /**
     * 用户注册
     * @param {Object} userData - 用户数据
     * @returns {Promise<Object>} 注册结果
     */
    async register(userData) {
        try {
            const result = await this.apiRequest('/auth/register', 'POST', userData);

            if (result.success) {
                // 触发注册事件
                this.dispatchEvent('userRegister', result.data.user);

                // 注册成功后，直接保存并设置登录状态
                const userInfo = {
                    user: result.data.user,
                    token: result.data.token,
                    isLoggedIn: true
                };
                localStorage.setItem('userInfo', JSON.stringify(userInfo));
                // 标记需要进行首次设置引导
                localStorage.setItem('firstSetupRequired', '1');
                
                this.currentUser = result.data.user;
                this.token = result.data.token;
                this.dispatchEvent('userLogin', this.currentUser);

                // 同步到数据管理器
                this.syncResumeDataManager();

                return {
                    success: true,
                    user: result.data.user,
                    token: result.data.token,
                    message: result.message
                };
            } else {
                return {
                    success: false,
                    message: result.error?.message || '注册失败'
                };
            }

        } catch (error) {
            console.error('注册错误:', error);
            return {
                success: false,
                message: error.message || '注册过程中发生错误'
            };
        }
    }

    /**
     * 用户登出
     */
    logout() {
        const user = this.currentUser;

        try {
            // 发送登出请求到服务器（可选，通常服务器端不处理JWT的登出）
            fetch(`${this.apiBaseUrl}/auth/logout`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            }).catch(err => console.error('登出请求失败:', err));
        } catch (e) {
            console.error('登出请求错误:', e);
        }

        // 清除本地存储
        localStorage.removeItem('userInfo');
        sessionStorage.clear();

        this.currentUser = null;
        this.token = null;

        // 同步到数据管理器
        this.syncResumeDataManager();

        // 触发登出事件
        this.dispatchEvent('userLogout', user);
    }

    /**
     * 检查用户是否已登录
     * @returns {boolean}
     */
    isLoggedIn() {
        return this.currentUser !== null && this.token !== null;
    }

    /**
     * 获取当前用户信息
     * @returns {Object|null}
     */
    getCurrentUser() {
        return this.currentUser;
    }

    /**
     * 检查用户权限
     * @param {string} permission - 权限名称
     * @returns {boolean}
     */
    hasPermission(permission) {
        if (!this.currentUser) return false;

        const userRole = this.currentUser.role;
        const permissions = this.getRolePermissions(userRole);

        return permissions.includes(permission) || permissions.includes('*');
    }

    /**
     * 检查用户角色
     * @param {string} role - 角色名称
     * @returns {boolean}
     */
    hasRole(role) {
        return this.currentUser && this.currentUser.role === role;
    }

    /**
     * 更新用户信息
     * @param {Object} updates - 更新的字段
     * @returns {Promise<Object>}
     */
    async updateProfile(updates) {
        try {
            const result = await this.apiRequest('/auth/user', 'PUT', updates);

            if (result.success) {
                // 更新本地存储的用户信息
                const userInfo = {
                    user: result.data.user,
                    token: this.token,
                    isLoggedIn: true
                };

                localStorage.setItem('userInfo', JSON.stringify(userInfo));

                // 更新当前用户
                this.currentUser = result.data.user;

                // 触发更新事件
                this.dispatchEvent('userUpdate', result.data.user);

                return {
                    success: true,
                    user: result.data.user
                };
            } else {
                throw new Error(result.error?.message || '更新失败');
            }

        } catch (error) {
            console.error('更新用户信息错误:', error);
            return {
                success: false,
                message: error.message || '更新失败'
            };
        }
    }

    async uploadAvatar(fileOrBlob) {
        const fd = new FormData();
        fd.append('avatar', fileOrBlob, 'avatar.png');
        const headers = {};
        if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
        const bases = [this.apiBaseUrl, '/api'];
        let lastError;
        for (const base of bases) {
            try {
                const res = await fetch(`${base}/auth/user/avatar`, { method: 'POST', headers, body: fd });
                const text = await res.text();
                const json = JSON.parse(text);
                if (!res.ok) throw new Error(json && json.error && json.error.message ? json.error.message : '上传失败');
                return json;
            } catch (e) { lastError = e; }
        }
        throw lastError || new Error('上传失败');
    }

    /**
     * 修改密码
     * @param {string} oldPassword - 旧密码
     * @param {string} newPassword - 新密码
     * @returns {Promise<Object>}
     */
    async changePassword(oldPassword, newPassword) {
        // 在真实应用中，需要额外的API端点来修改密码
        // 这里暂时返回错误信息，因为当前设计中用户密码功能不是重点
        return {
            success: false,
            message: '密码修改功能需后端实现'
        };
    }

    /**
     * 设置或更新用户密码
     * @param {string} newPassword - 新密码
     * @returns {Promise<Object>}
     */
    async setPassword(newPassword) {
        try {
            const result = await this.apiRequest('/auth/set-password', 'POST', { password: newPassword });
            return result;
        } catch (error) {
            console.error('设置密码错误:', error);
            return {
                success: false,
                message: error.message || '设置密码失败'
            };
        }
    }

    /**
     * 发送手机验证码
     * @param {string} phone - 手机号
     * @returns {Promise<Object>}
     */
    async sendVerificationCode(phone) {
        try {
            const result = await this.apiRequest('/auth/send-code', 'POST', { phone });
            return result;
        } catch (error) {
            console.error('发送验证码错误:', error);
            return {
                success: false,
                message: error.message || '发送验证码失败'
            };
        }
    }

    /**
     * 手机验证码登录
     * @param {string} phone - 手机号
     * @param {string} code - 验证码
     * @returns {Promise<Object>}
     */
    async loginWithPhone(phone, code) {
        try {
            const result = await this.apiRequest('/auth/verify-code', 'POST', { phone, code });

            if (result.success) {
                // 处理登录成功逻辑（保存 token 等）
                // 注意：verifyCode 接口返回的数据结构可能与 login 略有不同，需要适配
                // 假设后端 verifyCode 返回 { success: true, data: { user, token, action } }

                const userInfo = {
                    user: result.data.user,
                    token: result.data.token,
                    isLoggedIn: true
                };
                localStorage.setItem('userInfo', JSON.stringify(userInfo));
                this.currentUser = result.data.user;
                this.token = result.data.token;
                this.syncResumeDataManager();
                this.dispatchEvent('userLogin', this.currentUser);

                return result;
            } else {
                return {
                    success: false,
                    message: result.error?.message || '登录失败'
                };
            }
        } catch (error) {
            console.error('手机号登录错误:', error);
            return {
                success: false,
                message: error.message || '登录失败'
            };
        }
    }

    /**
     * 恢复用户会话
     */
    restoreUserSession() {
        try {
            const userInfoStr = localStorage.getItem('userInfo');
            if (userInfoStr) {
                const userInfo = JSON.parse(userInfoStr);

                if (userInfo.token) {
                    const userData = userInfo.user || {
                        id: userInfo.id,
                        username: userInfo.username,
                        email: userInfo.email,
                        phone: userInfo.phone,
                        avatar: userInfo.avatar,
                        company_name: userInfo.company_name
                    };

                    if (userData) {
                        this.currentUser = userData;
                        this.token = userInfo.token;
                        this.dispatchEvent('userRestore', userData);

                        // 同步到数据管理器
                        this.syncResumeDataManager();
                    }
                }
            }
        } catch (error) {
            console.error('恢复用户会话错误:', error);
            localStorage.removeItem('userInfo');
            this.currentUser = null;
            this.token = null;
        }
    }

    /**
     * 获取当前用户信息
     * @returns {Object|null}
     */
    async fetchCurrentUser() {
        try {
            const result = await this.apiRequest('/auth/user');

            if (result.success) {
                return result.data.user;
            } else {
                return null;
            }
        } catch (error) {
            console.error('获取当前用户信息失败:', error);
            return null;
        }
    }

    /**
     * 获取角色权限
     * @param {string} role - 角色名称
     * @returns {Array}
     */
    getRolePermissions(role) {
        const permissions = {
            'admin': ['*'], // 管理员拥有所有权限
            'premium': ['upload', 'analyze', 'compare', 'export', 'advanced_features'],
            'user': ['upload', 'analyze', 'basic_export'],
            'hr': ['manage_jobs', 'view_resumes', 'analyze_resumes'],
            'guest': ['view']
        };

        return permissions[role] || permissions['guest'];
    }

    /**
     * 延迟函数
     * @param {number} ms - 延迟毫秒数
     * @returns {Promise}
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 触发自定义事件
     * @param {string} eventName - 事件名称
     * @param {*} data - 事件数据
     */
    dispatchEvent(eventName, data) {
        const event = new CustomEvent(eventName, { detail: data });
        window.dispatchEvent(event);
    }

    /**
     * 验证邮箱格式
     * @param {string} email - 邮箱或手机号
     * @returns {boolean} - 是否为邮箱格式
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    getToken() {
        return this.token;
    }
}

// 创建全局实例
const userAuthInstance = new UserAuth();
window.userAuthInstance = userAuthInstance;

// 导出模块（如果使用模块系统）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = userAuthInstance;
}

// 页面权限检查工具函数
function requireAuth(redirectUrl = '/pages/login.html') {
    if (!userAuthInstance.isLoggedIn()) {
        window.location.href = redirectUrl;
        return false;
    }
    return true;
}

function requirePermission(permission, redirectUrl = '/pages/login.html') {
    if (!userAuthInstance.isLoggedIn() || !userAuthInstance.hasPermission(permission)) {
        window.location.href = redirectUrl;
        return false;
    }
    return true;
}

function requireRole(role, redirectUrl = '/pages/login.html') {
    if (!userAuthInstance.isLoggedIn() || !userAuthInstance.hasRole(role)) {
        window.location.href = redirectUrl;
        return false;
    }
    return true;
}

// 用户状态监听器
window.addEventListener('userLogin', function (e) {
    console.log('用户登录:', e.detail);
    updateUserInterface(e.detail);
});

window.addEventListener('userLogout', function (e) {
    console.log('用户登出:', e.detail);
    updateUserInterface(null);
});

window.addEventListener('userRestore', function (e) {
    console.log('用户会话恢复:', e.detail);
    updateUserInterface(e.detail);
});

// 监听未授权事件
window.addEventListener('apiUnauthorized', function (e) {
    if (window.__authRedirecting) return;
    window.__authRedirecting = true;
    userAuthInstance.logout();
    if (!window.location.pathname.includes('login.html')) {
        window.location.href = '/pages/login.html?expired=1';
    }
});

/**
 * 更新用户界面
 * @param {Object|null} user - 用户信息
 */
function updateUserInterface(user) {
    // 更新导航栏用户信息
    const userElements = document.querySelectorAll('[data-user-info]');
    userElements.forEach(element => {
        if (user) {
            element.style.display = 'block';
            const avatar = element.querySelector('[data-user-avatar]');
            const name = element.querySelector('[data-user-name]');

            if (avatar) {
                avatar.src = user.avatar || `data:image/svg+xml,${encodeURIComponent(`
                    <svg width="40" height="40" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="20" cy="20" r="20" fill="#4ECDC4"/>
                        <text x="50%" y="50%" dy=".3em" text-anchor="middle" fill="white" font-size="20" font-family="Arial">${(user.username || 'U').charAt(0).toUpperCase()}</text>
                    </svg>
                `)}`;
            }

            if (name) {
                const un = (user.username || '').trim();
                name.textContent = un || '显示ID';
            }
        } else {
            element.style.display = 'none';
        }
    });

    // 更新登录/注册按钮
    const authButtons = document.querySelectorAll('[data-auth-buttons]');
    authButtons.forEach(element => {
        if (user) {
            element.style.display = 'none';
        } else {
            element.style.display = 'block';
        }
    });
}
