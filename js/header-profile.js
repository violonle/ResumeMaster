/**
 * Unified Header Profile Component
 * Renders the user profile section in the header with avatar, info, and dropdown menu.
 */
class HeaderProfile {
    /**
     * Initialize the header profile component
     * @param {string} containerSelector - CSS selector for the container element. If null, tries to find a default location.
     * @param {boolean} append - If true, appends to container instead of replacing content. Default false.
     */
    static init(containerSelector = null, append = false) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init(containerSelector, append));
            return;
        }

        // 先尝试更新一次用户信息以获取最新订阅状态
        if (window.userAuthInstance && window.userAuthInstance.isLoggedIn()) {
            window.userAuthInstance.checkAuth().then(() => {
                this.render(containerSelector, append);
            }).catch(() => {
                this.render(containerSelector, append);
            });
        } else {
            this.render(containerSelector, append);
        }
    }

    /**
     * 执行实际的渲染逻辑
     */
    static render(containerSelector = null, append = false) {
        const user = this.getUserInfo();
        const html = this.generateHTML(user);

        let container;
        if (containerSelector) {
            container = document.querySelector(containerSelector);
        }

        // Fallback: Try to find the standard header right section
        if (!container) {
            container = document.getElementById('header-right-section');
            if (!container) {
                const headers = document.getElementsByTagName('header');
                if (headers.length > 0) {
                    const header = headers[0];
                    const flexContainers = header.querySelectorAll('.flex.items-center.justify-between > div:last-child');
                    if (flexContainers.length > 0) {
                        container = flexContainers[0];
                    }
                }
            }
        }

        if (container) {
            if (append) {
                const wrapper = document.createElement('div');
                wrapper.innerHTML = html;
                while (wrapper.firstChild) {
                    container.appendChild(wrapper.firstChild);
                }
            } else {
                container.innerHTML = html;
            }
            this.attachEvents();
        }
    }

    static getUserInfo() {
        try {
            const stored = localStorage.getItem('userInfo');
            if (stored) {
                const data = JSON.parse(stored);
                // Handle both nested {user: {...}} and flat user object structures
                const user = data.user || data;

                // If username is empty, try to use phone number (masked)
                let displayName = user.username;
                if (!displayName && user.phone) {
                    displayName = user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
                }

                // Role mapping based on subscription levels
                let roleDisplay = '普通用户';
                let enterpriseDisplay = '争湃·简历大师免费版';

                switch (user.role) {
                    case 'admin':
                        roleDisplay = '管理员';
                        enterpriseDisplay = '争湃·简历大师管理后台';
                        break;
                    case 'enterprise':
                        roleDisplay = '企业成员';
                        enterpriseDisplay = user.enterpriseName || user.company_name || '争湃·简历大师企业版';
                        break;
                    case 'premium':
                        roleDisplay = '专业会员';
                        enterpriseDisplay = '争湃·简历大师专业版';
                        break;
                    default: // 'user'
                        roleDisplay = '普通用户';
                        enterpriseDisplay = '争湃·简历大师免费版';
                }

                return {
                    username: displayName || 'Guest',
                    role: roleDisplay,
                    enterpriseName: enterpriseDisplay,
                    avatar: user.avatar || '/avatars/avatar.svg',
                    email: user.email || ''
                };
            }
        } catch (e) {
            console.error('Error reading user info:', e);
        }
        return {
            username: 'Guest',
            role: 'HR专员',
            enterpriseName: '未认证企业',
            avatar: '/avatars/avatar.svg',
            email: ''
        };
    }

    static getDisplayId() {
        try {
            const stored = localStorage.getItem('userInfo');
            const data = stored ? JSON.parse(stored) : {};
            const u = data.user || data;
            let uid = u.userId || u.id || u.uid || null;
            if (uid) return `用户${uid}`;
            const seed = (u.phone || u.email || u.username || '');
            let h = 0;
            for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
            const digits = (u.phone || '').replace(/\D/g, '');
            const part1 = digits && digits.length >= 4 ? digits.slice(-4) : String(1000 + (h % 9000));
            const part2 = String(1000 + ((h >>> 13) % 9000));
            return `用户${part1}-${part2}`;
        } catch (_) {
            const a = 1000 + Math.floor(Math.random() * 9000);
            const b = 1000 + Math.floor(Math.random() * 9000);
            return `用户${a}-${b}`;
        }
    }

    static generateHTML(user) {
        let rawName = '';
        try {
            const s = localStorage.getItem('userInfo');
            if (s) {
                const d = JSON.parse(s);
                const u = d.user || d;
                const un = (u.username || '').trim();
                if (un) rawName = un;
            }
        } catch (_) { }
        const name = rawName || '显示ID';
        const role = user.role;
        const enterprise = user.enterpriseName;

        // 默认头像路径
        const fallbackAvatar = "/avatars/avatar.svg";

        // 由于 ui-avatars.com 在国内可能也不稳定，我们改用本地生成的 Base64 头像（简单的文字头像）
        const generateInitialAvatar = (name) => {
            if (typeof ui !== 'undefined' && ui.renderAvatar) {
                // 用户头像不属于候选人
                return ui.renderAvatar(user.avatar, name, 'w-8 h-8', 'rounded-full', false);
            }
            // ... 保持原有 canvas 回退逻辑不变
            try {
                const canvas = document.createElement('canvas');
                canvas.width = 128;
                canvas.height = 128;
                const ctx = canvas.getContext('2d');

                // 背景
                const colors = ['#3b82f6', '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#14b8a6'];
                let hash = 0;
                for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
                ctx.fillStyle = colors[Math.abs(hash) % colors.length];
                ctx.fillRect(0, 0, 128, 128);

                // 文字
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 64px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                let displayName = '';
                const chineseMatch = name.match(/[\u4e00-\u9fa5]/g);
                if (chineseMatch && chineseMatch.length >= 2) {
                    displayName = chineseMatch.slice(0, 2).join('');
                } else {
                    displayName = name.substring(0, 2).toUpperCase();
                }
                ctx.fillText(displayName, 64, 64);

                return canvas.toDataURL('image/png');
            } catch (e) {
                return fallbackAvatar;
            }
        };

        const avatarUrl = user.avatar || generateInitialAvatar(name);
        const isHtml = avatarUrl.trim().startsWith('<');

        return `
            <div class="flex items-center space-x-4 ml-4">
                <!-- User Profile Dropdown -->
                <div class="relative z-50">
                    <button id="header-user-btn" class="flex items-center space-x-3 p-1.5 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none border border-transparent hover:border-gray-200">
                        ${isHtml ? avatarUrl : `<img src="${avatarUrl}" onerror="this.src='${fallbackAvatar}';this.onerror=null;" alt="Avatar" class="w-8 h-8 rounded-full object-cover">`}
                        <div class="text-left hidden md:block">
                            <p class="text-sm font-semibold text-gray-900 leading-none">${name} <span class="font-normal text-gray-500 text-xs"> ${role}</span></p>
                            <p class="text-xs text-gray-500 mt-0.5">${enterprise}</p>
                        </div>
                        <i class="fas fa-chevron-down text-xs text-gray-600 ml-1"></i>
                    </button>

                    <!-- Dropdown Menu -->
                    <div id="header-user-menu" class="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-100 py-2 hidden transform transition-all duration-200 origin-top-right">
                        <div class="px-4 py-3 border-b border-gray-50 bg-gray-50/50">
                            <div class="flex items-center space-x-3">
                                ${isHtml ? avatarUrl.replace(/w-\d+ h-\d+/, 'w-10 h-10') : `<img src="${avatarUrl}" onerror="this.src='${fallbackAvatar}';this.onerror=null;" class="w-10 h-10 rounded-full object-cover">`}
                                <div class="overflow-hidden">
                                    <p class="text-sm font-semibold text-gray-900 truncate">${name}</p>
                                    <p class="text-xs text-gray-500 truncate">${user.email || '未绑定邮箱'}</p>
                                </div>
                            </div>
                        </div>
                        
                        <a href="user-profile.html" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center">
                            <i class="fas fa-user-circle w-5 mr-2 text-gray-400"></i>个人设置
                        </a>
                        <a href="company-management.html" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center">
                            <i class="fas fa-building w-5 mr-2 text-gray-400"></i>企业设置
                        </a>
                        <a href="subscription.html" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center">
                            <i class="fas fa-credit-card w-5 mr-2 text-gray-400"></i>订阅与财务
                        </a>
                        <a href="settings.html" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center">
                            <i class="fas fa-cog w-5 mr-2 text-gray-400"></i>系统设置
                        </a>
                        <div class="border-t border-gray-100 my-1"></div>
                        <a href="#" id="header-logout-btn" class="block px-4 py-2 text-sm text-red-600 hover:bg-gray-100 flex items-center">
                            <i class="fas fa-sign-out-alt w-5 mr-2 text-red-400"></i>退出登录
                        </a>
                    </div>
                </div>
            </div>
        `;
    }

    static attachEvents() {
        const btn = document.getElementById('header-user-btn');
        const menu = document.getElementById('header-user-menu');
        const logoutBtn = document.getElementById('header-logout-btn');

        if (btn && menu) {
            let timeoutId;

            const show = () => {
                clearTimeout(timeoutId);
                menu.classList.remove('hidden');
            };

            const hide = () => {
                timeoutId = setTimeout(() => {
                    menu.classList.add('hidden');
                }, 300); // 300ms delay to prevent accidental closing
            };

            // Click to toggle
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (menu.classList.contains('hidden')) {
                    show();
                } else {
                    menu.classList.add('hidden');
                }
            });

            // Hover events with delay
            btn.addEventListener('mouseenter', show);
            btn.addEventListener('mouseleave', hide);
            menu.addEventListener('mouseenter', show);
            menu.addEventListener('mouseleave', hide);

            // Close when clicking outside
            document.addEventListener('click', (e) => {
                if (!btn.contains(e.target) && !menu.contains(e.target)) {
                    menu.classList.add('hidden');
                }
            });
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                // Check if ui component is available globally
                if (typeof ui !== 'undefined' && ui.showConfirm) {
                    ui.showConfirm('确定要退出登录吗？', () => this.logout());
                } else if (confirm('确定要退出登录吗？')) {
                    this.logout();
                }
            });
        }
    }

    static logout() {
        localStorage.removeItem('userInfo');
        localStorage.removeItem('token');
        window.location.href = '/pages/login.html';
    }
}
