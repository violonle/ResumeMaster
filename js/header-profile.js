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

        const user = this.getUserInfo();
        const html = this.generateHTML(user);

        let container;
        if (containerSelector) {
            container = document.querySelector(containerSelector);
        }

        // Fallback: Try to find the standard header right section
        if (!container) {
            // Strategy 1: Look for ID 'header-right-section'
            container = document.getElementById('header-right-section');
            
            // Strategy 2: Look for the last flex item in header
            if (!container) {
                const headers = document.getElementsByTagName('header');
                if (headers.length > 0) {
                    const header = headers[0];
                    // Find the flex container that usually holds right-side items
                    const flexContainers = header.querySelectorAll('.flex.items-center.justify-between > div:last-child');
                    if (flexContainers.length > 0) {
                        container = flexContainers[0];
                        // If we are guessing the container, we might want to be careful about replacing
                        // But for dashboard.html, replacing is correct (it replaces bell/user icons)
                    }
                }
            }
        }

        if (container) {
            if (append) {
                const wrapper = document.createElement('div');
                wrapper.innerHTML = html;
                // Append the children of wrapper to container
                while (wrapper.firstChild) {
                    container.appendChild(wrapper.firstChild);
                }
            } else {
                container.innerHTML = html;
            }
            this.attachEvents();
        } else {
            console.warn('HeaderProfile: Container not found. Please provide a valid selector or ensure standard header structure.');
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
                
                return {
                    username: displayName || 'Guest',
                    role: user.role === 'admin' ? 'HR经理' : 'HR专员',
                    enterpriseName: user.enterpriseName || user.company_name || '争湃·简历大师企业版',
                    avatar: user.avatar || '',
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
            avatar: '',
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
        } catch (_) {}
        const name = rawName || '显示ID';
        const role = user.role;
        const enterprise = user.enterpriseName;
        const avatarUrl = user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0D8ABC&color=fff`;

        return `
            <div class="flex items-center space-x-4 ml-4">
                <!-- Notifications -->
                <a href="/pages/settings.html" class="p-2 rounded-lg hover:bg-gray-100 relative group transition-colors" title="通知">
                    <i class="fas fa-bell text-gray-600 text-lg"></i>
                    <span class="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                </a>
                
                <!-- User Profile Dropdown -->
                <div class="relative z-50">
                    <button id="header-user-btn" class="flex items-center space-x-3 p-1.5 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none border border-transparent hover:border-gray-200">
                        <img src="${avatarUrl}" alt="Avatar" class="w-8 h-8 rounded-full object-cover border border-gray-200">
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
                                <img src="${avatarUrl}" class="w-10 h-10 rounded-full object-cover border border-gray-200">
                                <div class="overflow-hidden">
                                    <p class="text-sm font-semibold text-gray-900 truncate">${name}</p>
                                    <p class="text-xs text-gray-500 truncate">${user.email || '未绑定邮箱'}</p>
                                </div>
                            </div>
                        </div>
                        
                        <div class="py-1">
                            <a href="/pages/account-settings.html" class="group flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                                <div class="w-8 flex justify-center"><i class="fas fa-user-cog text-gray-900"></i></div>
                                账号设置
                            </a>
                            <a href="/pages/company-management.html" class="group flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                                <div class="w-8 flex justify-center"><i class="fas fa-building text-gray-900"></i></div>
                                企业设置
                            </a>
                            <a href="/pages/subscription.html" class="group flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                                <div class="w-8 flex justify-center"><i class="fas fa-file-invoice-dollar text-gray-900"></i></div>
                                订阅与财务
                            </a>
                        </div>
                        
                        <div class="border-t border-gray-100 py-1">
                            <a href="/pages/settings.html" class="group flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                                <div class="w-8 flex justify-center"><i class="fas fa-bell text-gray-900"></i></div>
                                通知设置
                            </a>
                            <a href="/pages/security-backup.html" class="group flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                                <div class="w-8 flex justify-center"><i class="fas fa-shield-alt text-gray-900"></i></div>
                                安全与备份
                            </a>
                        </div>

                        <div class="border-t border-gray-100 py-1">
                            <button id="header-logout-btn" class="w-full text-left group flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
                                <div class="w-8 flex justify-center"><i class="fas fa-sign-out-alt text-red-400 group-hover:text-red-600"></i></div>
                                退出登录
                            </button>
                        </div>
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
