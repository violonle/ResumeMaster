; (function () {
  // 自动加载 UI Components
  if (!document.querySelector('script[src*="ui-components.js"]')) {
    const script = document.createElement('script');
    script.src = '/js/ui-components.js';
    document.head.appendChild(script);
  }

  const DEFAULT_ITEMS = [
    { href: 'dashboard.html', icon: 'fas fa-home', label: '工作台', key: 'dashboard' },
    { href: 'librarypool.html', icon: 'fas fa-folder-open', label: '人才库', key: 'librarypool' },
    { href: 'job-management.html', icon: 'fas fa-briefcase', label: '职位管理', key: 'job' },
    { href: 'recruitment-flow.html', icon: 'fas fa-project-diagram', label: '招聘流程', key: 'recruitment-flow' },
    { href: 'resume-tools.html', icon: 'fas fa-tools', label: '简历解析与对比', key: 'resume-tools' },
    { href: 'data-analysis.html', icon: 'fas fa-chart-bar', label: '招聘数据分析', key: 'analysis' }
  ];

  const DEFAULT_QA = [
    { icon: 'fas fa-plus', label: '发布职位', onClick: () => location.href = 'job-posting.html' },
    { icon: 'fas fa-envelope', label: '邮箱导入', onClick: () => {
      if (location.pathname.includes('librarypool.html')) {
        if (typeof openLibraryEmailImportModal === 'function') {
          openLibraryEmailImportModal();
        }
      } else {
        sessionStorage.setItem('openEmailImportOnLoad', 'true');
        location.href = 'librarypool.html';
      }
    }},
    { icon: 'fas fa-file-alt', label: '简历解析', onClick: () => location.href = 'resume-upload-pc.html' },
  ];

  function baseName(url) {
    try {
      const u = url.split('?')[0];
      const p = u.split('/');
      return p[p.length - 1] || u
    } catch (e) {
      return url
    }
  }

  function guessActive() {
    const f = baseName(location.pathname);
    const m = {
      'dashboard.html': 'dashboard',
      'librarypool.html': 'librarypool',
      'resume-management.html': 'librarypool',
      'job-management.html': 'job',
      'recruitment-flow.html': 'recruitment-flow',
      'resume-tools.html': 'resume-tools',
      'resume-upload-pc.html': 'resume-tools',
      'comparison.html': 'resume-tools',
      'ai-assistant.html': 'resume-tools',
      'assistant-chat.html': 'dashboard',
      'data-analysis.html': 'analysis',
      'data-management.html': 'analysis',
      'advanced-search.html': 'librarypool',
      'company-management.html': 'company',
      'admin-finance.html': 'finance',
      'subscription.html': 'finance',
      'checkout.html': 'finance',
      'admin-invoices.html': 'finance',
      'job-posting.html': 'job',
      'job-detail.html': 'job',
      'resume-details.html': 'librarypool',
      'resume-analysis-result.html': 'resume-tools',
      'resume-compare-results.html': 'resume-tools',
      'profile.html': 'profile',
      'account-settings.html': 'profile',
      'settings.html': 'profile',
      'security-backup.html': 'profile'
    };
    return m[f] || null
  }

  class SidebarManager {
    constructor(cfg) {
      this.cfg = cfg;
      this.sidebar = document.querySelector(cfg.mount) || document.getElementById('sidebar');
      this.main = document.getElementById('main-content') || document.getElementById('main');
      this.overlay = document.getElementById('sidebar-overlay');
      this.topToggle = document.getElementById('sidebar-toggle');
      this.lock = false;
      this.isMobile = false;
    }

    ensureOverlay() {
      if (!this.overlay) {
        this.overlay = document.createElement('div');
        this.overlay.id = 'sidebar-overlay';
        this.overlay.className = 'sidebar-overlay';
        document.body.appendChild(this.overlay);
      }
    }

    renderTemplate() {
      if (!this.sidebar) {
        const wrap = document.createElement('div');
        wrap.innerHTML = this.cfg.templateHTML;
        document.body.insertBefore(wrap.firstElementChild, document.body.firstChild);
        this.sidebar = document.getElementById('sidebar');
      } else {
        this.sidebar.innerHTML = this.cfg.innerHTML;
      }
    }

    renderContent() {
      const qa = this.cfg.quickActions || DEFAULT_QA;
      const items = this.cfg.items || DEFAULT_ITEMS;
      const active = this.cfg.active || guessActive();
      const qaWrap = this.sidebar.querySelector('#sidebar-quick-actions');
      const navWrap = this.sidebar.querySelector('#sidebar-nav');

      if (qaWrap) {
        qaWrap.innerHTML = qa.map(q => `<button class="quick-action-button flex items-center px-3 py-2 text-sm text-gray-900 rounded-lg hover:bg-gray-50"><i class="${q.icon} mr-3"></i><span>${q.label}</span></button>`).join('');
        qaWrap.querySelectorAll('.quick-action-button').forEach((btn, i) => {
          btn.addEventListener('click', e => {
            e.preventDefault();
            const f = qa[i];
            if (f && typeof f.onClick === 'function') f.onClick();
          })
        });
      }

      if (navWrap) {
        navWrap.innerHTML = items.map(it => `<a href="${it.href}" class="nav-item-modern flex items-center px-4 py-2.5 text-sm rounded-lg hover:bg-gray-50 text-gray-900 mb-1 ${active === it.key ? 'active text-blue-700 bg-blue-50 font-medium' : ''}"><i class="${it.icon} mr-3 w-5 text-center"></i><span>${it.label}</span></a>`).join('');
      }

      if (this.cfg.options && this.cfg.options.hideSubscription) {
        const sub = this.sidebar.querySelector('#sidebar-subscription');
        if (sub) { sub.remove() }
      }
    }

    bind() {
      const innerToggle = this.sidebar.querySelector('#sidebar-toggle-inner');
      this.topToggle && this.topToggle.addEventListener('click', e => { e.preventDefault(); this.toggle() });
      innerToggle && innerToggle.addEventListener('click', e => { e.preventDefault(); this.toggle() });
      this.ensureOverlay();
      this.overlay.addEventListener('click', () => this.closeMobile());
      document.addEventListener('keydown', e => { if (e.key === 'Escape') this.closeMobile() });
      window.addEventListener('resize', () => this.handleResize());
      this.handleResize();

      const logoutBtn = this.sidebar.querySelector('#sidebar-logout-btn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
          e.preventDefault();
          try {
            if (window.userAuthInstance && typeof window.userAuthInstance.logout === 'function') {
              window.userAuthInstance.logout();
            } else {
              try { localStorage.removeItem('userInfo'); } catch (_) { }
            }
          } catch (_) { }
          location.href = '/pages/login.html';
        });
      }
      this.updateSubscriptionCard();
    }

    handleResize() {
      this.isMobile = window.innerWidth < 768;
      if (this.isMobile) {
        this.sidebar.classList.remove('sidebar-collapsed');
        this.closeMobile(true);
      } else {
        this.overlay.classList.remove('visible');
        this.openDesktop(true);
      }
    }

    toggle() {
      if (this.lock) return;
      this.lock = true;
      setTimeout(() => this.lock = false, 300);
      this.isMobile ? (this.isOpenMobile() ? this.closeMobile() : this.openMobile()) : (this.isCollapsedDesktop() ? this.openDesktop() : this.collapseDesktop());
    }

    isOpenMobile() { return this.sidebar.classList.contains('sidebar-open') }
    isCollapsedDesktop() { return this.sidebar.classList.contains('sidebar-collapsed') }
    openMobile() { this.sidebar.classList.add('sidebar-open'); this.overlay.classList.add('visible') }
    closeMobile(skip) { this.sidebar.classList.remove('sidebar-open'); this.overlay.classList.remove('visible') }
    collapseDesktop(skip) {
      this.sidebar.classList.add('sidebar-collapsed');
      document.body.classList.add('sidebar-collapsed-root');
      this.sidebar.classList.remove('w-280');
      if (this.main) { this.main.classList.add('main-content-collapsed') }
    }
    openDesktop(skip) {
      this.sidebar.classList.remove('sidebar-collapsed');
      document.body.classList.remove('sidebar-collapsed-root');
      this.sidebar.classList.add('w-280');
      if (this.main) { this.main.classList.remove('main-content-collapsed') }
    }

    async updateSubscriptionCard(){
      try{
        const titleEl = this.sidebar.querySelector('#sidebar-sub-title');
        const statusEl = this.sidebar.querySelector('#sidebar-sub-status');
        const progressEl = this.sidebar.querySelector('#sidebar-sub-progress');
        const renewEl = this.sidebar.querySelector('#sidebar-sub-renew');
        if (!titleEl || !statusEl || !progressEl || !renewEl) return;
        const lsToken = (function(){ try{ return (JSON.parse(localStorage.getItem('userInfo')||'{}').token)||null }catch(_){ return null } })();
        const uaToken = (typeof userAuthInstance !== 'undefined' && typeof userAuthInstance.getToken === 'function') ? (userAuthInstance.getToken()||null) : null;
        const token = uaToken || lsToken;
        const headers = token ? { Authorization: 'Bearer '+token } : {};
        const [cur, usage] = await Promise.all([
          fetch('/api/subscription/current', { headers }).then(r=>r.json()).catch(()=>null),
          fetch('/api/subscription/usage', { headers }).then(r=>r.json()).catch(()=>null)
        ]);
        const data = cur && cur.data ? cur.data : { hasSubscription:false };
        if (!data.hasSubscription){
          titleEl.textContent = '订阅专业版';
          statusEl.textContent = '未订阅';
          statusEl.className = 'text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full font-medium';
          progressEl.style.width = '0%';
          renewEl.innerHTML = '<div class="mt-3"><p class="text-sm text-gray-600 mb-3 text-center">让您的工作轻松，效率加倍</p><a href="/pages/subscription.html" class="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors">立即订阅</a></div>';
          return;
        }
        const expired = !!data.isExpired;
        const planName = data.planType && data.planType.includes('pro') ? '专业版订阅' : (data.planType && data.planType.includes('basic') ? '基础版订阅' : '订阅');
        titleEl.textContent = planName;
        statusEl.textContent = expired ? '已过期' : '活跃';
        statusEl.className = expired ? 'text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full font-medium' : 'text-xs text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full font-medium';
        const days = typeof data.daysRemaining === 'number' ? Math.max(0, data.daysRemaining) : 0;
        renewEl.textContent = `距离下次续费还有 ${days} 天`;
        let pct = 0;
        const u = usage && usage.data ? usage.data : null;
        if (u && u.limits && typeof u.limits.total === 'number' && u.limits.total > 0){
          const used = u.usage && typeof u.usage.totalUsage === 'number' ? u.usage.totalUsage : 0;
          pct = Math.round(Math.min(100, (used / u.limits.total) * 100));
        } else {
          const start = data.startedAt ? new Date(data.startedAt) : null;
          const end = data.expiresAt ? new Date(data.expiresAt) : null;
          if (start && end){
            const totalMs = end - start;
            const usedMs = Date.now() - start.getTime();
            if (totalMs > 0) pct = Math.round(Math.max(0, Math.min(100, (usedMs/totalMs)*100)));
          }
        }
        progressEl.style.width = `${pct}%`;
      }catch(_){ }
    }
  }

  function buildInnerHTML() {
    return fetch('/components/sidebar.html')
      .then(r => r.text())
      .catch(() => `<div class="p-6"><div id="sidebar-header" class="flex items-center justify-between p-4 border-b border-gray-200 mb-6"><div id="sidebar-logo" class="flex items-center"><div class="w-10 h-10 bg-[#111827] rounded-lg flex items-center justify-center"><i class="fas fa-briefcase text-white text-lg"></i></div><div class="ml-3 sidebar-text"><h1 class="text-lg font-bold text-gray-900">争湃·简历大师</h1><p class="text-xs text-gray-500">JobHuntly</p></div></div><button class="flex items-center px-3 py-2 text-sm text-gray-900 rounded-lg hover:bg-gray-50" id="sidebar-toggle-inner"><i class="fas fa-bars text-gray-900"></i></button></div><div class="mb-6"><h3 class="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-3 px-3">快速操作</h3><div id="sidebar-quick-actions" class="space-y-2"></div></div><nav class="space-y-1"><h3 class="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-3 px-3">导航</h3><div id="sidebar-nav"></div></nav><div id="sidebar-subscription" class="mt-8 p-4 gradient-card rounded-lg"><div class="flex items-center justify-between mb-2"><span class="text-sm font-medium text-gray-900">专业版订阅</span><span id="sidebar-sub-status" class="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">活跃</span></div><div class="w-full bg-gray-200 rounded-full h-2 mb-2"><div id="sidebar-sub-progress" class="bg-blue-500 h-2 rounded-full" style="width:68%"></div></div><p id="sidebar-sub-renew" class="text-xs text-gray-600">距离下次续费还有 12 天</p></div></div>`);
  }

  const Sidebar = {
    init(config) {
      const cfg = Object.assign({ mount: '#sidebar', items: DEFAULT_ITEMS, quickActions: DEFAULT_QA, active: guessActive(), options: {} }, config || {});
      const sm = new SidebarManager({ mount: cfg.mount, items: cfg.items, quickActions: cfg.quickActions, active: cfg.active, options: cfg.options, templateHTML: '', innerHTML: '' });
      return buildInnerHTML().then(html => {
        let inner = html;
        if (/^\s*<aside[\s\S]*?>[\s\S]*<\/aside>\s*$/i.test(html)) {
          inner = html.replace(/^\s*<aside[\s\S]*?>/i, '').replace(/<\/aside>\s*$/i, '')
        }
        sm.cfg.innerHTML = inner;
        sm.renderTemplate();
        sm.renderContent();
        sm.bind();
        return sm
      })
    }
  }

  window.Sidebar = Sidebar;
})();
