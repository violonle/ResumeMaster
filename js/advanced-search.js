/**
 * 高级搜索和筛选系统
 * 提供多条件搜索、智能建议、实时筛选等功能
 */

class AdvancedSearch {
    constructor() {
        this.searchConfig = {
            debounceTime: 300,
            minSearchLength: 2,
            maxSuggestions: 10,
            highlightClass: 'search-highlight'
        };
        this.filters = {};
        this.searchHistory = [];
        this.savedSearches = [];
        this.currentResults = [];
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadSearchHistory();
        this.loadSavedSearches();
    }

    setupEventListeners() {
        // 搜索输入框事件
        document.addEventListener('input', (e) => {
            if (e.target.matches('[data-advanced-search]')) {
                this.handleSearchInput(e.target);
            }
        });

        // 筛选器事件
        document.addEventListener('change', (e) => {
            if (e.target.matches('[data-search-filter]')) {
                this.handleFilterChange(e.target);
            }
        });

        // 搜索按钮事件
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-search-button]')) {
                this.performSearch();
            } else if (e.target.matches('[data-clear-search]')) {
                this.clearSearch();
            } else if (e.target.matches('[data-save-search]')) {
                this.saveCurrentSearch();
            } else if (e.target.matches('[data-load-saved-search]')) {
                this.loadSavedSearch(e.target.dataset.searchId);
            }
        });

        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'k') {
                e.preventDefault();
                this.focusSearchInput();
            } else if (e.key === 'Escape') {
                this.hideSuggestions();
            }
        });
    }

    handleSearchInput(inputElement) {
        const query = inputElement.value.trim();
        
        if (query.length >= this.searchConfig.minSearchLength) {
            this.debounce(() => {
                this.showSuggestions(query);
                this.performSearch(query);
            }, this.searchConfig.debounceTime)();
        } else {
            this.hideSuggestions();
        }
    }

    handleFilterChange(filterElement) {
        const filterType = filterElement.dataset.filterType;
        const filterValue = filterElement.value;
        
        if (filterValue) {
            this.filters[filterType] = filterValue;
        } else {
            delete this.filters[filterType];
        }
        
        this.performSearch();
    }

    performSearch(query = null) {
        const searchQuery = query || this.getCurrentSearchQuery();
        
        if (!searchQuery && Object.keys(this.filters).length === 0) {
            this.clearResults();
            return;
        }

        this.showLoadingState();

        this.searchInData(searchQuery, this.filters).then(results => {
            this.displayResults(results);
            this.addToSearchHistory(searchQuery);
        }).catch(error => {
            console.error('Search failed:', error);
            this.showNotification('搜索失败: ' + error.message, 'error');
        });
    }

    async searchInData(query, filters) {
        try {
            const response = await fetch('/api/resumes/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ query, filters })
            });
            
            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error?.message || '搜索失败');
            }
            
            return result.data || [];
        } catch (error) {
            console.error('API search failed:', error);
            return [];
        }
    }







    showSuggestions(query) {
        const suggestions = this.generateSuggestions(query);
        const suggestionContainer = this.getSuggestionContainer();
        
        if (suggestions.length > 0) {
            suggestionContainer.innerHTML = suggestions.map(suggestion => `
                <div class="suggestion-item p-3 hover:bg-gray-100 cursor-pointer border-b border-gray-200 last:border-b-0"
                     data-suggestion="${suggestion.text}">
                    <div class="flex items-center justify-between">
                        <span class="text-gray-800">${this.highlightMatch(suggestion.text, query)}</span>
                        <span class="text-xs text-gray-500">${suggestion.type}</span>
                    </div>
                </div>
            `).join('');
            
            suggestionContainer.classList.remove('hidden');
            this.setupSuggestionEvents();
        } else {
            this.hideSuggestions();
        }
    }

    generateSuggestions(query) {
        const suggestions = [];
        
        // 分类建议
        const categories = ['技术开发', '创意设计', '行政经典', '学术研究', '现代专业', '应届毕业生'];
        categories.forEach(category => {
            if (category.toLowerCase().includes(query.toLowerCase())) {
                suggestions.push({ text: category, type: '分类' });
            }
        });

        // 搜索历史建议
        this.searchHistory.forEach(history => {
            if (history.toLowerCase().includes(query.toLowerCase())) {
                suggestions.push({ text: history, type: '历史' });
            }
        });

        return suggestions.slice(0, this.searchConfig.maxSuggestions);
    }

    highlightMatch(text, query) {
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<mark class="bg-yellow-200">$1</mark>');
    }

    setupSuggestionEvents() {
        const suggestionItems = document.querySelectorAll('.suggestion-item');
        suggestionItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const suggestion = e.currentTarget.dataset.suggestion;
                this.selectSuggestion(suggestion);
            });
        });
    }

    selectSuggestion(suggestion) {
        const searchInput = document.querySelector('[data-advanced-search]');
        if (searchInput) {
            searchInput.value = suggestion;
            this.hideSuggestions();
            this.performSearch(suggestion);
        }
    }

    displayResults(results) {
        this.currentResults = results;
        const resultsContainer = document.getElementById('search-results');
        
        if (!resultsContainer) return;

        if (results.length === 0) {
            resultsContainer.innerHTML = `
                <div class="text-center py-12">
                    <i class="fas fa-search text-gray-400 text-4xl mb-4"></i>
                    <p class="text-gray-500">没有找到匹配的结果</p>
                    <p class="text-sm text-gray-400 mt-2">尝试调整搜索条件或筛选器</p>
                </div>
            `;
            return;
        }

        resultsContainer.innerHTML = `
            <div class="mb-4 flex items-center justify-between">
                <p class="text-gray-600">找到 ${results.length} 个结果</p>
                <div class="flex space-x-2">
                    <button class="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded">
                        <i class="fas fa-sort"></i> 排序
                    </button>
                    <button class="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded" data-export-results>
                        <i class="fas fa-download"></i> 导出
                    </button>
                </div>
            </div>
            <div class="space-y-4">
                ${results.map(item => this.renderResultItem(item)).join('')}
            </div>
        `;

        this.setupResultEvents();
    }

    renderResultItem(item) {
        const statusColors = {
            active: 'bg-green-100 text-green-800',
            completed: 'bg-blue-100 text-blue-800',
            draft: 'bg-gray-100 text-gray-800'
        };

        return `
            <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow" data-item-id="${item.id}">
                <div class="flex items-start justify-between">
                    <div class="flex-1">
                        <h4 class="font-semibold text-gray-900 mb-1">${item.title}</h4>
                        <div class="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                            <span><i class="fas fa-tag"></i> ${item.category}</span>
                            <span><i class="fas fa-calendar"></i> ${item.date}</span>
                            <span><i class="fas fa-yen-sign"></i> ${item.price === 0 ? '免费' : item.price}</span>
                        </div>
                    </div>
                    <div class="flex items-center space-x-2">
                        <span class="px-2 py-1 text-xs rounded-full ${statusColors[item.status]}">
                            ${this.getStatusText(item.status)}
                        </span>
                        <button class="text-gray-400 hover:text-gray-600" data-action="edit" data-item-id="${item.id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="text-gray-400 hover:text-gray-600" data-action="delete" data-item-id="${item.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    getStatusText(status) {
        const statusMap = {
            active: '进行中',
            completed: '已完成',
            draft: '草稿'
        };
        return statusMap[status] || status;
    }

    setupResultEvents() {
        // 结果项事件
        document.querySelectorAll('[data-action]').forEach(button => {
            button.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                const itemId = e.currentTarget.dataset.itemId;
                this.handleResultAction(action, itemId);
            });
        });

        // 导出结果
        const exportButton = document.querySelector('[data-export-results]');
        if (exportButton) {
            exportButton.addEventListener('click', () => {
                this.exportResults();
            });
        }
    }

    handleResultAction(action, itemId) {
        const item = this.currentResults.find(r => r.id == itemId);
        if (!item) return;

        switch (action) {
            case 'edit':
                this.editItem(item);
                break;
            case 'delete':
                this.deleteItem(item);
                break;
        }
    }

    editItem(item) {
        // 实现编辑功能
        console.log('编辑项目:', item);
        // 这里可以打开编辑模态框或导航到编辑页面
    }

    deleteItem(item) {
        ui.showConfirm(`确定要删除"${item.title}"吗？`, () => {
            this.currentResults = this.currentResults.filter(r => r.id !== item.id);
            this.displayResults(this.currentResults);
            this.showNotification('项目已删除', 'success');
        }, null, { type: 'danger', title: '删除确认' });
    }

    exportResults() {
        const data = JSON.stringify(this.currentResults, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `search-results-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.showNotification('结果已导出', 'success');
    }

    clearSearch() {
        const searchInput = document.querySelector('[data-advanced-search]');
        if (searchInput) {
            searchInput.value = '';
        }
        
        // 清除所有筛选器
        document.querySelectorAll('[data-search-filter]').forEach(filter => {
            filter.value = '';
        });
        
        this.filters = {};
        this.clearResults();
        this.hideSuggestions();
    }

    clearResults() {
        const resultsContainer = document.getElementById('search-results');
        if (resultsContainer) {
            resultsContainer.innerHTML = '';
        }
        this.currentResults = [];
    }

    hideSuggestions() {
        const suggestionContainer = this.getSuggestionContainer();
        suggestionContainer.classList.add('hidden');
    }

    getSuggestionContainer() {
        let container = document.getElementById('search-suggestions');
        if (!container) {
            container = document.createElement('div');
            container.id = 'search-suggestions';
            container.className = 'absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto z-50 hidden';
            
            const searchInput = document.querySelector('[data-advanced-search]');
            if (searchInput && searchInput.parentElement) {
                searchInput.parentElement.style.position = 'relative';
                searchInput.parentElement.appendChild(container);
            }
        }
        return container;
    }

    getCurrentSearchQuery() {
        const searchInput = document.querySelector('[data-advanced-search]');
        return searchInput ? searchInput.value.trim() : '';
    }

    showLoadingState() {
        const resultsContainer = document.getElementById('search-results');
        if (resultsContainer) {
            resultsContainer.innerHTML = `
                <div class="text-center py-12">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p class="text-gray-500">正在搜索...</p>
                </div>
            `;
        }
    }

    addToSearchHistory(query) {
        if (query && !this.searchHistory.includes(query)) {
            this.searchHistory.unshift(query);
            if (this.searchHistory.length > 20) {
                this.searchHistory.pop();
            }
            this.saveSearchHistory();
        }
    }

    saveCurrentSearch() {
        const query = this.getCurrentSearchQuery();
        ui.showPrompt('请输入搜索名称:', (searchName) => {
            if (searchName) {
                const savedSearch = {
                    id: Date.now(),
                    name: searchName,
                    query: query,
                    filters: { ...this.filters },
                    timestamp: new Date().toISOString()
                };
                
                this.savedSearches.push(savedSearch);
                this.saveSavedSearches();
                this.showNotification('搜索已保存', 'success');
            }
        }, null, { title: '保存搜索' });
    }

    loadSavedSearch(searchId) {
        const savedSearch = this.savedSearches.find(s => s.id == searchId);
        if (savedSearch) {
            // 恢复搜索查询
            const searchInput = document.querySelector('[data-advanced-search]');
            if (searchInput) {
                searchInput.value = savedSearch.query;
            }
            
            // 恢复筛选器
            this.filters = { ...savedSearch.filters };
            Object.keys(savedSearch.filters).forEach(filterType => {
                const filterElement = document.querySelector(`[data-search-filter][data-filter-type="${filterType}"]`);
                if (filterElement) {
                    filterElement.value = savedSearch.filters[filterType];
                }
            });
            
            this.performSearch(savedSearch.query);
            this.showNotification('搜索已加载', 'success');
        }
    }

    loadSearchHistory() {
        const stored = localStorage.getItem('searchHistory');
        if (stored) {
            this.searchHistory = JSON.parse(stored);
        }
    }

    saveSearchHistory() {
        localStorage.setItem('searchHistory', JSON.stringify(this.searchHistory));
    }

    loadSavedSearches() {
        const stored = localStorage.getItem('savedSearches');
        if (stored) {
            this.savedSearches = JSON.parse(stored);
        }
    }

    saveSavedSearches() {
        localStorage.setItem('savedSearches', JSON.stringify(this.savedSearches));
    }

    focusSearchInput() {
        const searchInput = document.querySelector('[data-advanced-search]');
        if (searchInput) {
            searchInput.focus();
        }
    }

    showNotification(message, type = 'info') {
        if (window.uiComponents) {
            window.uiComponents.showNotification(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    // 防抖函数
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// 初始化高级搜索
let advancedSearch;

document.addEventListener('DOMContentLoaded', function() {
    advancedSearch = new AdvancedSearch();
});

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdvancedSearch;
}
