/**
 * 批量操作和数据导出系统
 * 提供批量处理、多种格式导出、数据转换等功能
 */

class BatchOperations {
    constructor() {
        this.selectedItems = new Set();
        this.operationQueue = [];
        this.exportFormats = {
            json: { name: 'JSON', icon: 'fa-code', mimeType: 'application/json' },
            csv: { name: 'CSV', icon: 'fa-file-csv', mimeType: 'text/csv' },
            xml: { name: 'XML', icon: 'fa-file-code', mimeType: 'application/xml' },
            pdf: { name: 'PDF', icon: 'fa-file-pdf', mimeType: 'application/pdf' },
            xlsx: { name: 'Excel', icon: 'fa-file-excel', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
        };
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupDragAndDrop();
    }

    setupEventListeners() {
        // 全选/取消全选
        document.addEventListener('change', (e) => {
            if (e.target.matches('#select-all')) {
                this.handleSelectAll(e.target.checked);
            } else if (e.target.matches('[data-item-select]')) {
                this.handleItemSelect(e.target);
            }
        });

        // 批量操作按钮
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-batch-action]')) {
                const action = e.target.dataset.batchAction;
                this.performBatchAction(action);
            } else if (e.target.matches('[data-export-format]')) {
                const format = e.target.dataset.exportFormat;
                this.exportData(format);
            } else if (e.target.matches('[data-import-trigger]')) {
                this.triggerImport();
            }
        });

        // 文件上传
        document.addEventListener('change', (e) => {
            if (e.target.matches('#import-file')) {
                this.handleFileImport(e.target.files[0]);
            }
        });
    }

    setupDragAndDrop() {
        const dropZone = document.getElementById('drop-zone');
        if (!dropZone) return;

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('border-blue-500', 'bg-blue-50');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('border-blue-500', 'bg-blue-50');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('border-blue-500', 'bg-blue-50');
            
            const files = Array.from(e.dataTransfer.files);
            this.handleFileImport(files[0]);
        });
    }

    handleSelectAll(checked) {
        const itemCheckboxes = document.querySelectorAll('[data-item-select]');
        itemCheckboxes.forEach(checkbox => {
            checkbox.checked = checked;
            this.handleItemSelect(checkbox);
        });
        this.updateBatchActionsUI();
    }

    handleItemSelect(checkbox) {
        const itemId = checkbox.value;
        if (checkbox.checked) {
            this.selectedItems.add(itemId);
        } else {
            this.selectedItems.delete(itemId);
        }
        this.updateBatchActionsUI();
    }

    updateBatchActionsUI() {
        const selectedCount = this.selectedItems.size;
        const batchActionsBar = document.getElementById('batch-actions-bar');
        const selectedCountEl = document.getElementById('selected-count');
        
        if (selectedCount > 0) {
            if (batchActionsBar) {
                batchActionsBar.classList.remove('hidden');
            }
            if (selectedCountEl) {
                selectedCountEl.textContent = `已选择 ${selectedCount} 项`;
            }
        } else {
            if (batchActionsBar) {
                batchActionsBar.classList.add('hidden');
            }
        }
    }

    performBatchAction(action) {
        const selectedItems = Array.from(this.selectedItems);
        
        if (selectedItems.length === 0) {
            this.showNotification('请先选择要操作的项目', 'warning');
            return;
        }

        switch (action) {
            case 'delete':
                this.batchDelete(selectedItems);
                break;
            case 'export':
                this.showExportDialog();
                break;
            case 'duplicate':
                this.batchDuplicate(selectedItems);
                break;
            case 'status':
                this.batchUpdateStatus(selectedItems);
                break;
            case 'category':
                this.batchUpdateCategory(selectedItems);
                break;
            case 'tag':
                this.batchAddTag(selectedItems);
                break;
            default:
                this.showNotification(`未知操作: ${action}`, 'error');
        }
    }

    batchDelete(itemIds) {
        ui.showConfirm(`确定要删除选中的 ${itemIds.length} 个项目吗？此操作不可恢复。`, async () => {
            try {
                this.showProgress('正在删除项目...', 0);
                
                // 模拟批量删除
                for (let i = 0; i < itemIds.length; i++) {
                    await this.simulateAsyncOperation(200);
                    const progress = ((i + 1) / itemIds.length) * 100;
                    this.updateProgress(progress);
                }

                // 从UI中移除已删除的项目
                itemIds.forEach(itemId => {
                    const itemElement = document.querySelector(`[data-item-id="${itemId}"]`);
                    if (itemElement) {
                        itemElement.remove();
                    }
                });

                this.selectedItems.clear();
                this.updateBatchActionsUI();
                this.showNotification(`成功删除 ${itemIds.length} 个项目`, 'success');
                
            } catch (error) {
                this.showNotification('删除操作失败', 'error');
            } finally {
                this.hideProgress();
            }
        }, null, { type: 'danger', title: '删除确认' });
    }

    async batchDuplicate(itemIds) {
        try {
            this.showProgress('正在复制项目...', 0);
            
            const duplicatedItems = [];
            for (let i = 0; i < itemIds.length; i++) {
                await this.simulateAsyncOperation(300);
                const progress = ((i + 1) / itemIds.length) * 100;
                this.updateProgress(progress);
                
                // 模拟复制项目
                duplicatedItems.push({
                    id: `copy-${itemIds[i]}-${Date.now()}`,
                    title: `副本 - ${itemIds[i]}`,
                    status: 'draft'
                });
            }

            // 添加复制的项目到UI
            this.addItemsToUI(duplicatedItems);
            this.showNotification(`成功复制 ${itemIds.length} 个项目`, 'success');
            
        } catch (error) {
            this.showNotification('复制操作失败', 'error');
        } finally {
            this.hideProgress();
        }
    }

    batchUpdateStatus(itemIds) {
        ui.showPrompt('请输入新状态 (active/completed/draft):', (newStatus) => {
            if (!newStatus || !['active', 'completed', 'draft'].includes(newStatus)) {
                this.showNotification('状态无效，请重新输入', 'warning');
                return;
            }
            this.updateItemsProperty(itemIds, 'status', newStatus, '状态');
        }, null, { defaultValue: 'active', title: '更新状态' });
    }

    batchUpdateCategory(itemIds) {
        ui.showPrompt('请输入新分类:', (newCategory) => {
            if (!newCategory) return;
            this.updateItemsProperty(itemIds, 'category', newCategory, '分类');
        }, null, { title: '更新分类' });
    }

    batchAddTag(itemIds) {
        ui.showPrompt('请输入要添加的标签:', (newTag) => {
            if (!newTag) return;
            this.updateItemsProperty(itemIds, 'tags', newTag, '标签', true);
        }, null, { title: '添加标签' });
    }

    async updateItemsProperty(itemIds, property, value, propertyName, isArray = false) {
        try {
            this.showProgress(`正在更新${propertyName}...`, 0);
            
            for (let i = 0; i < itemIds.length; i++) {
                await this.simulateAsyncOperation(150);
                const progress = ((i + 1) / itemIds.length) * 100;
                this.updateProgress(progress);
                
                // 更新UI中的项目属性
                const itemElement = document.querySelector(`[data-item-id="${itemIds[i]}"] [data-${property}]`);
                if (itemElement) {
                    if (isArray) {
                        const currentTags = itemElement.textContent.split(',').map(t => t.trim());
                        if (!currentTags.includes(value)) {
                            currentTags.push(value);
                            itemElement.textContent = currentTags.join(', ');
                        }
                    } else {
                        itemElement.textContent = value;
                    }
                }
            }

            this.showNotification(`成功更新 ${itemIds.length} 个项目的${propertyName}`, 'success');
            
        } catch (error) {
            this.showNotification(`${propertyName}更新失败`, 'error');
        } finally {
            this.hideProgress();
        }
    }

    showExportDialog() {
        const dialog = this.createExportDialog();
        document.body.appendChild(dialog);
        dialog.classList.remove('hidden');
    }

    createExportDialog() {
        const dialog = document.createElement('div');
        dialog.id = 'export-dialog';
        dialog.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center hidden';
        
        dialog.innerHTML = `
            <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-lg font-semibold text-gray-900">导出数据</h3>
                    <button onclick="this.closest('#export-dialog').classList.add('hidden')" class="text-gray-400 hover:text-gray-600">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="mb-4">
                    <p class="text-sm text-gray-600 mb-3">选择导出格式:</p>
                    <div class="grid grid-cols-2 gap-3">
                        ${Object.keys(this.exportFormats).map(format => `
                            <button 
                                data-export-format="${format}"
                                class="flex items-center justify-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                <i class="fas ${this.exportFormats[format].icon} text-2xl text-gray-600 mb-1"></i>
                                <span class="text-sm font-medium">${this.exportFormats[format].name}</span>
                            </button>
                        `).join('')}
                    </div>
                </div>

                <div class="mb-4">
                    <label class="flex items-center">
                        <input type="checkbox" id="export-selected-only" class="mr-2">
                        <span class="text-sm text-gray-700">仅导出选中的项目 (${this.selectedItems.size} 项)</span>
                    </label>
                </div>

                <div class="flex space-x-3">
                    <button 
                        onclick="this.closest('#export-dialog').classList.add('hidden')"
                        class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                        取消
                    </button>
                </div>
            </div>
        `;

        return dialog;
    }

    async exportData(format) {
        const exportSelectedOnly = document.getElementById('export-selected-only')?.checked;
        const itemsToExport = exportSelectedOnly ? Array.from(this.selectedItems) : this.getAllItems();
        
        if (itemsToExport.length === 0) {
            this.showNotification('没有可导出的数据', 'warning');
            return;
        }

        try {
            this.showProgress('正在准备导出...', 0);
            
            let data;
            let filename;
            
            switch (format) {
                case 'json':
                    data = this.prepareJSONData(itemsToExport);
                    filename = `export-${new Date().toISOString().slice(0, 10)}.json`;
                    break;
                case 'csv':
                    data = this.prepareCSVData(itemsToExport);
                    filename = `export-${new Date().toISOString().slice(0, 10)}.csv`;
                    break;
                case 'xml':
                    data = this.prepareXMLData(itemsToExport);
                    filename = `export-${new Date().toISOString().slice(0, 10)}.xml`;
                    break;
                case 'pdf':
                    await this.exportToPDF(itemsToExport);
                    this.hideProgress();
                    document.getElementById('export-dialog')?.classList.add('hidden');
                    return;
                case 'xlsx':
                    await this.exportToExcel(itemsToExport);
                    this.hideProgress();
                    document.getElementById('export-dialog')?.classList.add('hidden');
                    return;
                default:
                    throw new Error(`不支持的导出格式: ${format}`);
            }

            // 下载文件
            this.downloadFile(data, filename, this.exportFormats[format].mimeType);
            
            this.showNotification(`成功导出 ${itemsToExport.length} 条记录`, 'success');
            
        } catch (error) {
            this.showNotification('导出失败: ' + error.message, 'error');
        } finally {
            this.hideProgress();
            document.getElementById('export-dialog')?.classList.add('hidden');
        }
    }

    prepareJSONData(items) {
        const data = items.map(itemId => this.getItemData(itemId));
        return JSON.stringify(data, null, 2);
    }

    prepareCSVData(items) {
        const data = items.map(itemId => this.getItemData(itemId));
        if (data.length === 0) return '';
        
        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row => headers.map(header => 
                JSON.stringify(row[header] || '')
            ).join(','))
        ].join('\n');
        
        return csvContent;
    }

    prepareXMLData(items) {
        const data = items.map(itemId => this.getItemData(itemId));
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<items>\n';
        
        data.forEach(item => {
            xml += '  <item>\n';
            Object.keys(item).forEach(key => {
                xml += `    <${key}>${this.escapeXML(item[key])}</${key}>\n`;
            });
            xml += '  </item>\n';
        });
        
        xml += '</items>';
        return xml;
    }

    async exportToPDF(items) {
        // 模拟PDF导出
        return new Promise((resolve) => {
            setTimeout(() => {
                this.showNotification('PDF导出功能需要额外的库支持', 'info');
                resolve();
            }, 1000);
        });
    }

    async exportToExcel(items) {
        // 模拟Excel导出
        return new Promise((resolve) => {
            setTimeout(() => {
                this.showNotification('Excel导出功能需要额外的库支持', 'info');
                resolve();
            }, 1000);
        });
    }

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    triggerImport() {
        const fileInput = document.getElementById('import-file');
        if (fileInput) {
            fileInput.click();
        }
    }

    async handleFileImport(file) {
        if (!file) return;

        const validTypes = ['application/json', 'text/csv', 'text/xml'];
        if (!validTypes.includes(file.type) && !file.name.endsWith('.json') && !file.name.endsWith('.csv') && !file.name.endsWith('.xml')) {
            this.showNotification('不支持的文件格式', 'error');
            return;
        }

        try {
            this.showProgress('正在导入文件...', 0);
            
            const content = await this.readFileContent(file);
            const data = this.parseImportData(content, file.type);
            
            if (data && data.length > 0) {
                await this.importData(data);
                this.showNotification(`成功导入 ${data.length} 条记录`, 'success');
            } else {
                this.showNotification('文件中没有有效的数据', 'warning');
            }
            
        } catch (error) {
            this.showNotification('导入失败: ' + error.message, 'error');
        } finally {
            this.hideProgress();
        }
    }

    readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    parseImportData(content, fileType) {
        try {
            if (fileType.includes('json') || file.name.endsWith('.json')) {
                return JSON.parse(content);
            } else if (fileType.includes('csv') || file.name.endsWith('.csv')) {
                return this.parseCSV(content);
            } else if (fileType.includes('xml') || file.name.endsWith('.xml')) {
                return this.parseXML(content);
            }
        } catch (error) {
            throw new Error('文件格式错误');
        }
    }

    parseCSV(content) {
        const lines = content.split('\n').filter(line => line.trim());
        if (lines.length < 2) return [];
        
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });
            data.push(row);
        }
        
        return data;
    }

    parseXML(content) {
        // 简化的XML解析
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(content, 'text/xml');
        const items = xmlDoc.getElementsByTagName('item');
        const data = [];
        
        Array.from(items).forEach(item => {
            const row = {};
            Array.from(item.children).forEach(child => {
                row[child.tagName] = child.textContent;
            });
            data.push(row);
        });
        
        return data;
    }

    async importData(data) {
        // 模拟数据导入
        for (let i = 0; i < data.length; i++) {
            await this.simulateAsyncOperation(100);
            const progress = ((i + 1) / data.length) * 100;
            this.updateProgress(progress);
        }
        
        // 添加到UI
        this.addItemsToUI(data);
    }

    addItemsToUI(items) {
        // 这里应该实现将新项目添加到UI的逻辑
        console.log('添加项目到UI:', items);
    }

    getItemData(itemId) {
        return null;
    }

    getAllItems() {
        // 模拟获取所有项目
        return ['1', '2', '3', '4', '5', '6', '7', '8'];
    }

    simulateAsyncOperation(delay) {
        return new Promise(resolve => setTimeout(resolve, delay));
    }

    showProgress(message, progress) {
        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');
        
        if (progressBar && progressText) {
            progressBar.style.width = `${progress}%`;
            progressText.textContent = message;
            progressBar.parentElement.classList.remove('hidden');
        }
    }

    updateProgress(progress) {
        const progressBar = document.getElementById('progress-bar');
        if (progressBar) {
            progressBar.style.width = `${progress}%`;
        }
    }

    hideProgress() {
        const progressContainer = document.getElementById('progress-container');
        if (progressContainer) {
            progressContainer.classList.add('hidden');
        }
    }

    showNotification(message, type = 'info') {
        if (window.uiComponents) {
            window.uiComponents.showNotification(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    escapeXML(str) {
        return String(str).replace(/&/g, '&amp;')
                         .replace(/</g, '&lt;')
                         .replace(/>/g, '&gt;')
                         .replace(/"/g, '&quot;')
                         .replace(/'/g, '&#39;');
    }
}

// 初始化批量操作
let batchOperations;

document.addEventListener('DOMContentLoaded', function() {
    batchOperations = new BatchOperations();
});

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BatchOperations;
}
