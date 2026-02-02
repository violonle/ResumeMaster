/**
 * 简历对比功能模块
 * 提供简历对比的数据管理和分析功能
 */

class ResumeComparison {
    constructor(config = {}) {
        this.config = {
            containerId: 'selected-resumes',
            compareBtnId: 'compare-btn',
            ...config
        };
        this.selectedResumes = [];
        this.comparisonData = null;
        this.maxCompareCount = 5; // 最多对比5份简历
    }

    /**
     * 添加简历到对比列表
     * @param {Object} resume - 简历数据
     * @returns {boolean} - 是否添加成功
     */
    addResume(resume) {
        if (this.selectedResumes.length >= this.maxCompareCount) {
            console.warn('最多只能对比3份简历');
            return false;
        }

        if (this.selectedResumes.find(r => r.id === resume.id)) {
            console.warn('该简历已在对比列表中');
            return false;
        }

        this.selectedResumes.push(resume);
        this.updateUI();
        return true;
    }

    /**
     * 从对比列表中移除简历
     * @param {string} resumeId - 简历ID
     */
    removeResume(resumeId) {
        this.selectedResumes = this.selectedResumes.filter(r => r.id !== resumeId);
        this.updateUI();
    }

    /**
     * 清空对比列表
     */
    clearAll() {
        this.selectedResumes = [];
        this.comparisonData = null;
        this.updateUI();
    }

  /**
   * 执行简历对比分析
   * @returns {Object} - 对比结果
   */
  async performComparison() {
    if (this.selectedResumes.length < 2) {
      throw new Error('至少需要选择2份简历进行对比');
    }
    if (!window.resumeDataManager) {
      throw new Error('数据管理器未初始化');
    }
    const ids = this.selectedResumes.map(r => parseInt(r.id));
    const analysesList = await Promise.all(ids.map(id => window.resumeDataManager.getAnalysesByResumeId(id).catch(() => [])));
    const resumes = this.selectedResumes.map((resume, idx) => {
      const list = analysesList[idx] || [];
      let latest = null;
      list.forEach(a => { if (!latest || new Date(a.analysis_date) > new Date(latest.analysis_date)) latest = a });
      const dims = (latest && latest.dimensions) ? latest.dimensions : {};
      const scores = {};
      Object.keys(dims).forEach(k => { const v = dims[k]; scores[k] = typeof v === 'number' ? v : (v?.score ?? 0) });
      const overall = latest && typeof latest.overall_score === 'number' ? latest.overall_score : NaN;
      const details = latest ? { strengths: latest.strengths||[], weaknesses: latest.weaknesses||[], suggestions: latest.suggestions||[] } : { strengths:[], weaknesses:[], suggestions:[] };
      return { name: resume.name || `简历${ids[idx]}`, scores, overall, details };
    });
    const dimSet = new Set();
    resumes.forEach(r => Object.keys(r.scores).forEach(k => dimSet.add(k)));
    const dimensions = Array.from(dimSet).filter(d => !d.includes('技能') && !d.includes('skill'));
    const result = { resumes, dimensions, timestamp: new Date().toISOString() };
    result.winner = this.determineWinner(resumes);
    this.comparisonData = result;
    return result;
  }


    /**
     * 确定最佳简历
     * @param {Array} resumes - 简历列表
     * @returns {Object} - 最佳简历
     */
    determineWinner(resumes) {
        return resumes.reduce((winner, current) => {
            const winnerAvg = this.calculateAverageScore(winner.scores);
            const currentAvg = this.calculateAverageScore(current.scores);
            return currentAvg > winnerAvg ? current : winner;
        });
    }

    /**
     * 计算平均分
     * @param {Object} scores - 评分对象
     * @returns {number} - 平均分
     */
    calculateAverageScore(scores) {
        const values = Object.values(scores);
        return values.reduce((sum, score) => sum + score, 0) / values.length;
    }


    /**
     * 更新UI显示
     */
    updateUI() {
        // 更新选中的简历显示
        this.updateSelectedResumesDisplay();
        
        // 更新对比按钮状态
        this.updateCompareButtonState();
        
        // 触发自定义事件
        window.dispatchEvent(new CustomEvent('resumeSelectionChanged', {
            detail: {
                selectedResumes: this.selectedResumes,
                canCompare: this.selectedResumes.length >= 2
            }
        }));
    }

    /**
     * 更新选中简历的显示
     */
    updateSelectedResumesDisplay() {
        const container = document.getElementById(this.config.containerId);
        if (!container) return;

        container.innerHTML = '';
        
        this.selectedResumes.forEach(resume => {
            const resumeElement = this.createSelectedResumeElement(resume);
            container.appendChild(resumeElement);
        });
    }

    /**
     * 创建选中简历的DOM元素
     * @param {Object} resume - 简历数据
     * @returns {HTMLElement} - DOM元素
     */
    createSelectedResumeElement(resume) {
        const div = document.createElement('div');
        div.className = 'selected-resume-item bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between';
        
        div.innerHTML = `
            <div class="flex items-center space-x-3 mb-4">
                ${window.ui ? window.ui.renderAvatar(resume.avatar, resume.name, 'w-10 h-10', 'rounded-lg', true) : `
                    <div class="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                        <i class="fas fa-user"></i>
                    </div>
                `}
                <div>
                    <h4 class="font-medium text-gray-900">${resume.name}</h4>
                    <p class="text-sm text-gray-600">评分：${Number.isFinite(resume.score) ? resume.score : '—'}分</p>
                </div>
            </div>
            <button class="remove-resume text-red-500 hover:text-red-700" data-resume-id="${resume.id}">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
            </button>
        `;
        
        // 添加移除事件监听
        const removeBtn = div.querySelector('.remove-resume');
        removeBtn.addEventListener('click', () => {
            this.removeResume(resume.id);
        });
        
        return div;
    }

    /**
     * 更新对比按钮状态
     */
    updateCompareButtonState() {
        const compareBtn = document.getElementById(this.config.compareBtnId);
        if (!compareBtn) return;

        const canCompare = this.selectedResumes.length >= 2;
        compareBtn.disabled = !canCompare;
        compareBtn.textContent = canCompare ? 
            `开始对比 (${this.selectedResumes.length}份简历)` : 
            '请选择至少2份简历';
        
        if (canCompare) {
            compareBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            compareBtn.classList.add('btn-primary');
        } else {
            compareBtn.classList.add('opacity-50', 'cursor-not-allowed');
            compareBtn.classList.remove('btn-primary');
        }
    }

}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ResumeComparison;
} else {
    window.ResumeComparison = ResumeComparison;
}
