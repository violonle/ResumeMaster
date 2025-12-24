/**
 * 简历模板系统
 * 提供多种专业简历模板和自定义功能
 */

class ResumeTemplateSystem {
    constructor() {
        this.templates = this.getDefaultTemplates();
        this.customTemplates = [];
        this.currentTemplate = null;
        this.init();
    }

    init() {
        this.loadCustomTemplates();
        this.setupTemplatePreview();
        this.setupTemplateEditor();
    }

    /**
     * 获取默认简历模板
     */
    getDefaultTemplates() {
        return [
            {
                id: 'modern-professional',
                name: '现代专业',
                category: 'professional',
                description: '适合IT、金融、咨询等行业',
                preview: this.generateModernProfessionalPreview(),
                structure: {
                    sections: ['header', 'summary', 'experience', 'education', 'skills'],
                    colors: {
                        primary: '#2563eb',
                        secondary: '#64748b',
                        accent: '#0ea5e9'
                    },
                    fonts: {
                        heading: 'Inter',
                        body: 'Inter'
                    }
                }
            },
            {
                id: 'creative-designer',
                name: '创意设计',
                category: 'creative',
                description: '适合设计师、艺术家、创意工作者',
                preview: this.generateCreativeDesignerPreview(),
                structure: {
                    sections: ['header', 'portfolio', 'experience', 'education', 'skills', 'awards'],
                    colors: {
                        primary: '#7c3aed',
                        secondary: '#ec4899',
                        accent: '#f59e0b'
                    },
                    fonts: {
                        heading: 'Playfair Display',
                        body: 'Inter'
                    }
                }
            },
            {
                id: 'executive-classic',
                name: '高管经典',
                category: 'executive',
                description: '适合高级管理职位、C级高管',
                preview: this.generateExecutiveClassicPreview(),
                structure: {
                    sections: ['header', 'executive-summary', 'leadership', 'experience', 'education', 'board-memberships'],
                    colors: {
                        primary: '#1f2937',
                        secondary: '#6b7280',
                        accent: '#d97706'
                    },
                    fonts: {
                        heading: 'Times New Roman',
                        body: 'Georgia'
                    }
                }
            },
            {
                id: 'fresh-graduate',
                name: '应届毕业生',
                category: 'entry-level',
                description: '适合毕业生、实习生、初级职位',
                preview: this.generateFreshGraduatePreview(),
                structure: {
                    sections: ['header', 'objective', 'education', 'projects', 'skills', 'activities'],
                    colors: {
                        primary: '#059669',
                        secondary: '#10b981',
                        accent: '#3b82f6'
                    },
                    fonts: {
                        heading: 'Inter',
                        body: 'Inter'
                    }
                }
            },
            {
                id: 'tech-developer',
                name: '技术开发',
                category: 'technical',
                description: '适合程序员、工程师、技术专家',
                preview: this.generateTechDeveloperPreview(),
                structure: {
                    sections: ['header', 'technical-summary', 'experience', 'projects', 'skills', 'certifications'],
                    colors: {
                        primary: '#0891b2',
                        secondary: '#0e7490',
                        accent: '#06b6d4'
                    },
                    fonts: {
                        heading: 'Fira Code',
                        body: 'Inter'
                    }
                }
            },
            {
                id: 'academic-researcher',
                name: '学术研究',
                category: 'academic',
                description: '适合研究员、教授、学术职位',
                preview: this.generateAcademicResearcherPreview(),
                structure: {
                    sections: ['header', 'research-summary', 'publications', 'experience', 'education', 'grants', 'conferences'],
                    colors: {
                        primary: '#7c2d12',
                        secondary: '#92400e',
                        accent: '#b45309'
                    },
                    fonts: {
                        heading: 'Times New Roman',
                        body: 'Times New Roman'
                    }
                }
            }
        ];
    }

    /**
     * 生成现代专业模板预览
     */
    generateModernProfessionalPreview() {
        return `
            <div class="template-preview modern-professional">
                <div class="preview-header bg-blue-600 text-white p-4">
                    <h3 class="text-lg font-bold">张三</h3>
                    <p class="text-sm opacity-90">高级软件工程师</p>
                </div>
                <div class="preview-content p-4 text-sm">
                    <div class="mb-3">
                        <h4 class="font-semibold text-gray-800 mb-1">专业总结</h4>
                        <p class="text-gray-600 text-xs">5年软件开发经验，专注于前端技术和用户体验...</p>
                    </div>
                    <div class="mb-3">
                        <h4 class="font-semibold text-gray-800 mb-1">工作经历</h4>
                        <p class="text-gray-600 text-xs">腾讯科技 - 前端开发工程师 (2020-至今)</p>
                    </div>
                    <div>
                        <h4 class="font-semibold text-gray-800 mb-1">技能</h4>
                        <div class="flex flex-wrap gap-1">
                            <span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">React</span>
                            <span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">Vue</span>
                            <span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">TypeScript</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 生成创意设计模板预览
     */
    generateCreativeDesignerPreview() {
        return `
            <div class="template-preview creative-designer">
                <div class="preview-header bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4">
                    <h3 class="text-lg font-bold">李四</h3>
                    <p class="text-sm opacity-90">UI/UX 设计师</p>
                </div>
                <div class="preview-content p-4 text-sm">
                    <div class="mb-3">
                        <h4 class="font-semibold text-gray-800 mb-1">设计理念</h4>
                        <p class="text-gray-600 text-xs">创造美观且功能性的用户界面，提升用户体验...</p>
                    </div>
                    <div class="mb-3">
                        <h4 class="font-semibold text-gray-800 mb-1">项目经验</h4>
                        <p class="text-gray-600 text-xs">阿里巴巴 - 高级UI设计师 (2019-至今)</p>
                    </div>
                    <div>
                        <h4 class="font-semibold text-gray-800 mb-1">设计技能</h4>
                        <div class="flex flex-wrap gap-1">
                            <span class="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded">Figma</span>
                            <span class="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded">Sketch</span>
                            <span class="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded">Photoshop</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 生成高管经典模板预览
     */
    generateExecutiveClassicPreview() {
        return `
            <div class="template-preview executive-classic">
                <div class="preview-header bg-gray-800 text-white p-4 border-b-4 border-yellow-500">
                    <h3 class="text-lg font-bold">王五</h3>
                    <p class="text-sm opacity-90">首席执行官</p>
                </div>
                <div class="preview-content p-4 text-sm">
                    <div class="mb-3">
                        <h4 class="font-semibold text-gray-800 mb-1">高管总结</h4>
                        <p class="text-gray-600 text-xs">15年企业管理经验，擅长战略规划和团队领导...</p>
                    </div>
                    <div class="mb-3">
                        <h4 class="font-semibold text-gray-800 mb-1">管理经验</h4>
                        <p class="text-gray-600 text-xs">华为技术 - 副总裁 (2015-至今)</p>
                    </div>
                    <div>
                        <h4 class="font-semibold text-gray-800 mb-1">领导技能</h4>
                        <div class="flex flex-wrap gap-1">
                            <span class="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">战略规划</span>
                            <span class="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">团队建设</span>
                            <span class="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">业务拓展</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 生成应届毕业生模板预览
     */
    generateFreshGraduatePreview() {
        return `
            <div class="template-preview fresh-graduate">
                <div class="preview-header bg-green-600 text-white p-4">
                    <h3 class="text-lg font-bold">赵六</h3>
                    <p class="text-sm opacity-90">应届毕业生</p>
                </div>
                <div class="preview-content p-4 text-sm">
                    <div class="mb-3">
                        <h4 class="font-semibold text-gray-800 mb-1">职业目标</h4>
                        <p class="text-gray-600 text-xs">寻求软件开发实习机会，应用所学知识...</p>
                    </div>
                    <div class="mb-3">
                        <h4 class="font-semibold text-gray-800 mb-1">教育背景</h4>
                        <p class="text-gray-600 text-xs">清华大学 - 计算机科学学士 (2024届)</p>
                    </div>
                    <div>
                        <h4 class="font-semibold text-gray-800 mb-1">项目技能</h4>
                        <div class="flex flex-wrap gap-1">
                            <span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">Java</span>
                            <span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">Python</span>
                            <span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">数据结构</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 生成技术开发模板预览
     */
    generateTechDeveloperPreview() {
        return `
            <div class="template-preview tech-developer">
                <div class="preview-header bg-cyan-600 text-white p-4">
                    <h3 class="text-lg font-bold">孙七</h3>
                    <p class="text-sm opacity-90">全栈开发工程师</p>
                </div>
                <div class="preview-content p-4 text-sm">
                    <div class="mb-3">
                        <h4 class="font-semibold text-gray-800 mb-1">技术总结</h4>
                        <p class="text-gray-600 text-xs">精通前后端开发，专注于云原生和微服务架构...</p>
                    </div>
                    <div class="mb-3">
                        <h4 class="font-semibold text-gray-800 mb-1">开发经验</h4>
                        <p class="text-gray-600 text-xs">字节跳动 - 高级全栈工程师 (2018-至今)</p>
                    </div>
                    <div>
                        <h4 class="font-semibold text-gray-800 mb-1">技术栈</h4>
                        <div class="flex flex-wrap gap-1">
                            <span class="bg-cyan-100 text-cyan-800 text-xs px-2 py-1 rounded">Node.js</span>
                            <span class="bg-cyan-100 text-cyan-800 text-xs px-2 py-1 rounded">React</span>
                            <span class="bg-cyan-100 text-cyan-800 text-xs px-2 py-1 rounded">Docker</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 生成学术研究模板预览
     */
    generateAcademicResearcherPreview() {
        return `
            <div class="template-preview academic-researcher">
                <div class="preview-header bg-amber-700 text-white p-4">
                    <h3 class="text-lg font-bold">周八</h3>
                    <p class="text-sm opacity-90">研究员 / 副教授</p>
                </div>
                <div class="preview-content p-4 text-sm">
                    <div class="mb-3">
                        <h4 class="font-semibold text-gray-800 mb-1">研究方向</h4>
                        <p class="text-gray-600 text-xs">人工智能、机器学习、深度学习在医疗领域的应用...</p>
                    </div>
                    <div class="mb-3">
                        <h4 class="font-semibold text-gray-800 mb-1">学术经历</h4>
                        <p class="text-gray-600 text-xs">中科院自动化所 - 副研究员 (2016-至今)</p>
                    </div>
                    <div>
                        <h4 class="font-semibold text-gray-800 mb-1">研究领域</h4>
                        <div class="flex flex-wrap gap-1">
                            <span class="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded">深度学习</span>
                            <span class="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded">医疗AI</span>
                            <span class="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded">计算机视觉</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 设置模板预览
     */
    setupTemplatePreview() {
        // 模板预览相关的交互逻辑
        document.addEventListener('click', (e) => {
            const templateCard = e.target.closest('.template-card');
            if (templateCard) {
                const templateId = templateCard.dataset.templateId;
                this.selectTemplate(templateId);
            }
        });
    }

    /**
     * 选择模板
     */
    selectTemplate(templateId) {
        const template = this.templates.find(t => t.id === templateId);
        if (template) {
            this.currentTemplate = template;
            this.highlightSelectedTemplate(templateId);
            this.updateTemplatePreview(template);
            this.showNotification(`已选择模板: ${template.name}`, 'success');
        }
    }

    /**
     * 高亮选中的模板
     */
    highlightSelectedTemplate(templateId) {
        document.querySelectorAll('.template-card').forEach(card => {
            card.classList.remove('ring-2', 'ring-blue-500', 'shadow-lg');
        });
        
        const selectedCard = document.querySelector(`[data-template-id="${templateId}"]`);
        if (selectedCard) {
            selectedCard.classList.add('ring-2', 'ring-blue-500', 'shadow-lg');
        }
    }

    /**
     * 更新模板预览
     */
    updateTemplatePreview(template) {
        const previewContainer = document.getElementById('template-preview-container');
        if (previewContainer) {
            previewContainer.innerHTML = template.preview;
        }
    }

    /**
     * 设置模板编辑器
     */
    setupTemplateEditor() {
        // 模板编辑器相关的交互逻辑
        const editorContainer = document.getElementById('template-editor');
        if (editorContainer) {
            this.initializeColorPicker();
            this.initializeFontSelector();
            this.initializeSectionManager();
        }
    }

    /**
     * 初始化颜色选择器
     */
    initializeColorPicker() {
        const colorInputs = document.querySelectorAll('.color-input');
        colorInputs.forEach(input => {
            input.addEventListener('change', (e) => {
                const colorType = e.target.dataset.colorType;
                const color = e.target.value;
                this.updateTemplateColor(colorType, color);
            });
        });
    }

    /**
     * 初始化字体选择器
     */
    initializeFontSelector() {
        const fontSelectors = document.querySelectorAll('.font-selector');
        fontSelectors.forEach(selector => {
            selector.addEventListener('change', (e) => {
                const fontType = e.target.dataset.fontType;
                const font = e.target.value;
                this.updateTemplateFont(fontType, font);
            });
        });
    }

    /**
     * 初始化段落管理器
     */
    initializeSectionManager() {
        const sectionToggles = document.querySelectorAll('.section-toggle');
        sectionToggles.forEach(toggle => {
            toggle.addEventListener('change', (e) => {
                const section = e.target.dataset.section;
                const enabled = e.target.checked;
                this.toggleTemplateSection(section, enabled);
            });
        });
    }

    /**
     * 更新模板颜色
     */
    updateTemplateColor(colorType, color) {
        if (this.currentTemplate) {
            this.currentTemplate.structure.colors[colorType] = color;
            this.updateTemplatePreview(this.currentTemplate);
        }
    }

    /**
     * 更新模板字体
     */
    updateTemplateFont(fontType, font) {
        if (this.currentTemplate) {
            this.currentTemplate.structure.fonts[fontType] = font;
            this.updateTemplatePreview(this.currentTemplate);
        }
    }

    /**
     * 切换模板段落
     */
    toggleTemplateSection(section, enabled) {
        if (this.currentTemplate) {
            const index = this.currentTemplate.structure.sections.indexOf(section);
            if (enabled && index === -1) {
                this.currentTemplate.structure.sections.push(section);
            } else if (!enabled && index > -1) {
                this.currentTemplate.structure.sections.splice(index, 1);
            }
            this.updateTemplatePreview(this.currentTemplate);
        }
    }

    /**
     * 获取模板列表
     */
    getTemplates() {
        return [...this.templates, ...this.customTemplates];
    }

    /**
     * 获取分类模板
     */
    getTemplatesByCategory(category) {
        return this.getTemplates().filter(template => template.category === category);
    }

    /**
     * 保存自定义模板
     */
    saveCustomTemplate(template) {
        const customTemplate = {
            ...template,
            id: `custom-${Date.now()}`,
            category: 'custom'
        };
        this.customTemplates.push(customTemplate);
        this.saveCustomTemplates();
        this.showNotification('自定义模板已保存', 'success');
    }

    /**
     * 加载自定义模板
     */
    loadCustomTemplates() {
        const saved = localStorage.getItem('customTemplates');
        if (saved) {
            try {
                this.customTemplates = JSON.parse(saved);
            } catch (error) {
                console.error('加载自定义模板失败:', error);
            }
        }
    }

    /**
     * 保存自定义模板到本地存储
     */
    saveCustomTemplates() {
        localStorage.setItem('customTemplates', JSON.stringify(this.customTemplates));
    }

    /**
     * 导出模板
     */
    exportTemplate(templateId) {
        const template = this.getTemplates().find(t => t.id === templateId);
        if (template) {
            const dataStr = JSON.stringify(template, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${template.name}-template.json`;
            link.click();
            URL.revokeObjectURL(url);
            this.showNotification('模板已导出', 'success');
        }
    }

    /**
     * 导入模板
     */
    importTemplate(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const template = JSON.parse(e.target.result);
                this.saveCustomTemplate(template);
            } catch (error) {
                this.showNotification('模板导入失败，请检查文件格式', 'error');
            }
        };
        reader.readAsText(file);
    }

    /**
     * 显示通知
     */
    showNotification(message, type = 'info') {
        if (window.uiComponents && window.uiComponents.showNotification) {
            window.uiComponents.showNotification(message, type);
        } else if (window.ui && window.ui.showNotification) {
            window.ui.showNotification(message, type);
        } else {
            // 备用通知方式 - 创建临时通知元素
            const div = document.createElement('div');
            div.style.cssText = 'position:fixed;top:20px;right:20px;padding:15px 25px;background:#fff;box-shadow:0 4px 12px rgba(0,0,0,0.15);border-radius:8px;z-index:9999;font-family:system-ui,-apple-system,sans-serif;animation:slideIn 0.3s ease-out;';
            div.textContent = message;
            
            // 根据类型设置简单的左边框颜色
            const colors = { success: '#10B981', error: '#EF4444', warning: '#F59E0B', info: '#3B82F6' };
            div.style.borderLeft = `4px solid ${colors[type] || colors.info}`;
            
            document.body.appendChild(div);
            setTimeout(() => {
                div.style.opacity = '0';
                div.style.transition = 'opacity 0.3s';
                setTimeout(() => div.remove(), 300);
            }, 3000);
        }
    }

    /**
     * 获取当前模板
     */
    getCurrentTemplate() {
        return this.currentTemplate;
    }

    /**
     * 应用模板到简历数据
     */
    applyTemplateToResume(resumeData, template = this.currentTemplate) {
        if (!template) {
            this.showNotification('请先选择一个模板', 'warning');
            return resumeData;
        }

        return {
            ...resumeData,
            template: {
                id: template.id,
                name: template.name,
                structure: template.structure
            },
            styling: {
                colors: template.structure.colors,
                fonts: template.structure.fonts,
                sections: template.structure.sections
            }
        };
    }
}

// 创建全局简历模板系统实例
window.resumeTemplateSystem = new ResumeTemplateSystem();