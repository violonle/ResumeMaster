/**
 * 页面整合工具
 * 用于将现有页面整合到统一布局框架中
 */

class PageIntegration {
    constructor() {
        this.layoutTemplate = null;
        this.currentPage = null;
        this.init();
    }

    init() {
        this.loadLayoutTemplate();
        this.setupPageIntegration();
    }

    /**
     * 加载布局模板
     */
    async loadLayoutTemplate() {
        try {
            // 优先使用简约清新布局
            const response = await fetch('/layouts/unified-layout-clean.html');
            if (response.ok) {
                this.layoutTemplate = await response.text();
            } else {
                // 回退到原始布局
                const fallbackResponse = await fetch('/layouts/unified-layout.html');
                if (fallbackResponse.ok) {
                    this.layoutTemplate = await fallbackResponse.text();
                } else {
                    console.error('无法加载布局模板');
                }
            }
        } catch (error) {
            console.error('加载布局模板失败:', error);
        }
    }

    /**
     * 设置页面整合
     */
    setupPageIntegration() {
        // 延迟执行，确保页面完全加载
        setTimeout(() => {
            // 检查当前页面是否需要整合
            if (this.shouldIntegratePage()) {
                this.integrateCurrentPage();
            }
        }, 500);
    }

    /**
     * 判断当前页面是否需要整合
     */
    shouldIntegratePage() {
        const currentPath = window.location.pathname;
        
        // 排除已经使用统一布局的页面
        if (currentPath === '/pages/unified-example.html' || 
            currentPath === '/pages/smart-dashboard.html' ||
            currentPath === '/pages/template-center.html' ||
            currentPath === '/pages/analytics-dashboard.html' ||
            currentPath === '/pages/advanced-search.html' ||
            currentPath === '/pages/data-management.html') {
            return false;
        }
        
        const pagesToIntegrate = [
            '/pages/dashboard.html',
            '/pages/ai-generator.html',
            '/pages/account-settings.html',
            '/pages/company-management.html',
            '/pages/subscription.html',
            '/pages/login.html'
        ];
        
        return pagesToIntegrate.includes(currentPath);
    }

    /**
     * 整合当前页面
     */
    async integrateCurrentPage() {
        if (!this.layoutTemplate) {
            await this.loadLayoutTemplate();
        }

        const currentContent = this.extractPageContent();
        const pageInfo = this.getPageInfo();
        
        const integratedHtml = this.layoutTemplate
            .replace(/\{\{PAGE_TITLE\}\}/g, pageInfo.title)
            .replace(/\{\{PAGE_SUBTITLE\}\}/g, pageInfo.subtitle)
            .replace(/\{\{PAGE_CONTENT\}\}/g, currentContent);

        // 替换整个页面内容
        document.open();
        document.write(integratedHtml);
        document.close();
    }

    /**
     * 提取页面内容
     */
    extractPageContent() {
        // 获取主要内容区域
        const contentSelectors = [
            'main',
            '.container',
            '.content',
            '#content',
            '.main-content',
            'body > div:not(.sidebar):not(.header)'
        ];

        for (const selector of contentSelectors) {
            const element = document.querySelector(selector);
            if (element) {
                // 移除导航和头部元素
                const cleanContent = this.cleanContent(element.innerHTML);
                return cleanContent;
            }
        }

        // 如果找不到主要内容，返回body内容
        return this.cleanContent(document.body.innerHTML);
    }

    /**
     * 清理内容
     */
    cleanContent(content) {
        // 移除导航、头部、脚本和样式元素
        const unwantedElements = [
            /<nav[^>]*>[\s\S]*?<\/nav>/gi,
            /<header[^>]*>[\s\S]*?<\/header>/gi,
            /<script[^>]*>[\s\S]*?<\/script>/gi,
            /<style[^>]*>[\s\S]*?<\/style>/gi,
            /<link[^>]*>/gi,
            /<meta[^>]*>/gi
        ];

        let cleanedContent = content;
        unwantedElements.forEach(regex => {
            cleanedContent = cleanedContent.replace(regex, '');
        });

        return cleanedContent.trim();
    }

    /**
     * 获取页面信息
     */
    getPageInfo() {
        const path = window.location.pathname;
        const pageInfos = {
            '/pages/dashboard.html': {
                title: '简历管理',
                subtitle: '管理和编辑您的简历'
            },
            '/pages/ai-generator.html': {
                title: '智能生成',
                subtitle: 'AI智能生成简历内容'
            },
            '/pages/user-profile.html': {
                title: '用户中心',
                subtitle: '管理个人信息和账户设置'
            },
            '/pages/settings.html': {
                title: '系统设置',
                subtitle: '配置系统参数和偏好'
            },
            '/pages/login.html': {
                title: '登录',
                subtitle: '登录到简历助手'
            },
        };

        return pageInfos[path] || {
            title: '页面',
            subtitle: ''
        };
    }

    /**
     * 创建统一页面
     */
    createUnifiedPage(pageConfig) {
        const { title, subtitle, content, scripts = [], styles = [] } = pageConfig;

        let pageHtml = this.layoutTemplate
            .replace(/\{\{PAGE_TITLE\}\}/g, title)
            .replace(/\{\{PAGE_SUBTITLE\}\}/g, subtitle)
            .replace(/\{\{PAGE_CONTENT\}\}/g, content);

        // 添加额外的样式
        if (styles.length > 0) {
            const styleTags = styles.map(style => 
                `<link href="${style}" rel="stylesheet">`
            ).join('\n');
            pageHtml = pageHtml.replace('</head>', `${styleTags}\n</head>`);
        }

        // 添加额外的脚本
        if (scripts.length > 0) {
            const scriptTags = scripts.map(script => 
                `<script src="${script}"></script>`
            ).join('\n');
            pageHtml = pageHtml.replace('</body>', `${scriptTags}\n</body>`);
        }

        return pageHtml;
    }

    /**
     * 应用统一样式
     */
    applyUnifiedStyles() {
        // 添加统一的设计系统类
        const body = document.body;
        body.classList.add('unified-page');
        
        // 应用统一的卡片样式
        const cards = document.querySelectorAll('.card, .panel, .box');
        cards.forEach(card => {
            card.classList.add('glass-card');
        });

        // 应用统一的按钮样式
        const buttons = document.querySelectorAll('button, .btn, .button');
        buttons.forEach(button => {
            if (!button.classList.contains('btn-primary') && 
                !button.classList.contains('btn-secondary') &&
                !button.classList.contains('btn-success') &&
                !button.classList.contains('btn-warning') &&
                !button.classList.contains('btn-error')) {
                button.classList.add('btn-primary');
            }
        });

        // 应用统一的输入框样式
        const inputs = document.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            input.classList.add('form-input');
        });
    }

    /**
     * 统一页面布局
     */
    unifyPageLayout() {
        // 确保页面有统一的间距和布局
        const mainContent = document.querySelector('.main-content, main, .content, .container');
        if (mainContent) {
            mainContent.classList.add('p-6');
        }

        // 添加统一的头部样式
        const headers = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        headers.forEach(header => {
            header.classList.add('text-gray-800', 'font-semibold');
        });

        // 统一表格样式
        const tables = document.querySelectorAll('table');
        tables.forEach(table => {
            table.classList.add('w-full', 'border-collapse', 'bg-white', 'rounded-lg', 'overflow-hidden', 'shadow-sm');
        });

        const tableHeaders = document.querySelectorAll('th');
        tableHeaders.forEach(th => {
            th.classList.add('px-6', 'py-3', 'bg-gray-50', 'text-left', 'text-xs', 'font-medium', 'text-gray-500', 'uppercase', 'tracking-wider');
        });

        const tableCells = document.querySelectorAll('td');
        tableCells.forEach(td => {
            td.classList.add('px-6', 'py-4', 'whitespace-nowrap', 'text-sm', 'text-gray-900');
        });
    }

    /**
     * 检查页面一致性
     */
    checkPageConsistency() {
        const issues = [];

        // 检查导航一致性
        const navItems = document.querySelectorAll('.sidebar-nav-item');
        if (navItems.length === 0) {
            issues.push('缺少导航菜单');
        }

        // 检查样式一致性 - 支持玻璃卡片和简约卡片
        const cards = document.querySelectorAll('.card, .panel, .box');
        cards.forEach((card, index) => {
            if (!card.classList.contains('glass-card') && !card.classList.contains('clean-card')) {
                issues.push(`卡片 ${index + 1} 缺少统一样式`);
            }
        });

        // 检查响应式设计
        const responsiveElements = document.querySelectorAll('.container, .main-content, .content-body');
        let hasResponsiveLayout = false;
        responsiveElements.forEach((element) => {
            if (element.classList.contains('max-w-7xl') && element.classList.contains('mx-auto')) {
                hasResponsiveLayout = true;
            }
        });
        
        if (!hasResponsiveLayout && responsiveElements.length > 0) {
            issues.push('主内容区域可能缺少响应式布局');
        }

        return issues;
    }

    /**
     * 生成页面整合报告
     */
    generateIntegrationReport() {
        const report = {
            timestamp: new Date().toISOString(),
            currentPage: window.location.pathname,
            layoutTemplateLoaded: !!this.layoutTemplate,
            issues: this.checkPageConsistency(),
            recommendations: this.getRecommendations()
        };

        return report;
    }

    /**
     * 获取改进建议
     */
    getRecommendations() {
        const recommendations = [];

        // 检查是否使用了统一的设计系统
        const designSystemLink = document.querySelector('link[href*="design-system"]');
        if (!designSystemLink) {
            recommendations.push('建议添加设计系统样式表');
        }

        // 检查是否使用了统一的组件
        const uiComponentsScript = document.querySelector('script[src*="ui-components"]');
        if (!uiComponentsScript) {
            recommendations.push('建议加载UI组件库');
        }

        // 检查响应式设计
        const viewport = document.querySelector('meta[name="viewport"]');
        if (!viewport || !viewport.content.includes('width=device-width')) {
            recommendations.push('建议添加响应式viewport标签');
        }

        return recommendations;
    }

    /**
     * 批量整合页面
     */
    async batchIntegratePages(pageConfigs) {
        const results = [];

        for (const config of pageConfigs) {
            try {
                const unifiedPage = this.createUnifiedPage(config);
                results.push({
                    page: config.title,
                    success: true,
                    html: unifiedPage
                });
            } catch (error) {
                results.push({
                    page: config.title,
                    success: false,
                    error: error.message
                });
            }
        }

        return results;
    }
}

// 初始化页面整合工具
window.pageIntegration = new PageIntegration();

// 页面加载完成后执行整合
window.addEventListener('load', function() {
    // 延迟执行以确保所有资源加载完成
    setTimeout(() => {
        if (window.pageIntegration) {
            try {
                // 应用统一样式
                window.pageIntegration.applyUnifiedStyles();
                window.pageIntegration.unifyPageLayout();
                
                // 生成整合报告
                const report = window.pageIntegration.generateIntegrationReport();
                console.log('页面整合报告:', report);
                
                // 显示整合结果
                if (report.issues.length > 0) {
                    console.warn('发现页面一致性问题:', report.issues);
                }
                
                if (report.recommendations.length > 0) {
                    console.info('改进建议:', report.recommendations);
                }
            } catch (error) {
                console.error('页面整合失败:', error);
            }
        }
    }, 1000);
});

// 导出给其他脚本使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PageIntegration;
}
