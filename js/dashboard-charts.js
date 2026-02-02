/**
 * 数据可视化仪表板图表系统
 * 提供简历分析、用户行为、AI服务状态等数据展示
 */

class DashboardCharts {
    constructor() {
        this.charts = {};
        this.chartColors = {
            primary: '#3B82F6',
            secondary: '#8B5CF6',
            success: '#10B981',
            warning: '#6366F1',
            error: '#EF4444',
            info: '#06B6D4',
            gradient: {
                blue: ['#3B82F6', '#1D4ED8'],
                purple: ['#8B5CF6', '#5B21B6'],
                green: ['#10B981', '#047857'],
                indigo: ['#6366F1', '#4F46E5']
            }
        };
        this.init();
    }

    init() {
        this.loadChartJS();
    }

    loadChartJS() {
        if (typeof Chart === 'undefined') {
            const script = document.createElement('script');
            script.src = '/js/chart.min.js';
            script.onload = () => {
                this.initializeCharts();
            };
            script.onerror = () => {
                console.error('Chart.js 加载失败:', script.src);
            };
            document.head.appendChild(script);
        } else {
            this.initializeCharts();
        }
    }

    initializeCharts() {
        if (!window.dashboardRealData) return;
        this.createResumeAnalyticsChart();
        this.createUserActivityChart();
        this.createAIServiceChart();
        this.createTemplateUsageChart();
        this.createRevenueChart();
        this.createPerformanceChart();
    }

    // 简历分析图表
    createResumeAnalyticsChart() {
        const canvas = document.getElementById('resumeAnalyticsChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        this.charts.resumeAnalytics = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['1月', '2月', '3月', '4月', '5月', '6月', '7月'],
                datasets: [{
                    label: '创建简历数',
                    data: [120, 190, 300, 500, 200, 300, 450],
                    borderColor: this.chartColors.primary,
                    backgroundColor: this.createGradient(canvas, this.chartColors.gradient.blue),
                    fill: true,
                    tension: 0.4
                }, {
                    label: '优化简历数',
                    data: [80, 120, 200, 350, 150, 250, 380],
                    borderColor: this.chartColors.success,
                    backgroundColor: this.createGradient(canvas, this.chartColors.gradient.green),
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: '简历创建与优化趋势',
                        font: { size: 16, weight: 'bold' }
                    },
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.1)' }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });
    }

    // 用户活跃度图表
    createUserActivityChart() {
        const canvas = document.getElementById('userActivityChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        this.charts.userActivity = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
                datasets: [{
                    label: '新用户注册',
                    data: [65, 59, 80, 81, 56, 25, 40],
                    backgroundColor: this.chartColors.primary,
                    borderRadius: 6
                }, {
                    label: '活跃用户',
                    data: [280, 320, 290, 350, 270, 180, 220],
                    backgroundColor: this.chartColors.secondary,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: '用户活跃度统计',
                        font: { size: 16, weight: 'bold' }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.1)' }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });
    }

    // AI服务状态图表
    createAIServiceChart() {
        const canvas = document.getElementById('aiServiceChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        this.charts.aiService = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['ModelScope', 'SiliconFlow', 'GLM', 'Qwen', '其他'],
                datasets: [{
                    data: [35, 25, 20, 15, 5],
                    backgroundColor: [
                        this.chartColors.primary,
                        this.chartColors.secondary,
                        this.chartColors.success,
                        this.chartColors.warning,
                        this.chartColors.info
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'AI服务使用分布',
                        font: { size: 16, weight: 'bold' }
                    },
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    // 模板使用统计图表
    createTemplateUsageChart() {
        const canvas = document.getElementById('templateUsageChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        this.charts.templateUsage = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: ['现代专业', '创意设计', '行政经典', '应届毕业生', '技术开发', '学术研究'],
                datasets: [{
                    label: '本月使用',
                    data: [85, 65, 45, 70, 90, 30],
                    borderColor: this.chartColors.primary,
                    backgroundColor: this.chartColors.primary + '20',
                    pointBackgroundColor: this.chartColors.primary,
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: this.chartColors.primary
                }, {
                    label: '上月使用',
                    data: [75, 70, 50, 65, 85, 25],
                    borderColor: this.chartColors.secondary,
                    backgroundColor: this.chartColors.secondary + '20',
                    pointBackgroundColor: this.chartColors.secondary,
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: this.chartColors.secondary
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: '简历模板使用分析',
                        font: { size: 16, weight: 'bold' }
                    }
                },
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 100,
                        grid: { color: 'rgba(0,0,0,0.1)' }
                    }
                }
            }
        });
    }

    // 收入统计图表
    createRevenueChart() {
        const canvas = document.getElementById('revenueChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        this.charts.revenue = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['1月', '2月', '3月', '4月', '5月', '6月', '7月'],
                datasets: [{
                    label: '微信支付',
                    data: [12000, 19000, 15000, 25000, 22000, 30000, 28000],
                    borderColor: this.chartColors.success,
                    backgroundColor: this.createGradient(canvas, this.chartColors.gradient.green),
                    fill: true,
                    tension: 0.4
                }, {
                    label: '支付宝',
                    data: [8000, 12000, 18000, 20000, 18000, 25000, 22000],
                    borderColor: this.chartColors.primary,
                    backgroundColor: this.createGradient(canvas, this.chartColors.gradient.blue),
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: '收入统计趋势',
                        font: { size: 16, weight: 'bold' }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '¥' + value.toLocaleString();
                            }
                        },
                        grid: { color: 'rgba(0,0,0,0.1)' }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });
    }

    // 性能监控图表
    createPerformanceChart() {
        const canvas = document.getElementById('performanceChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        this.charts.performance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00'],
                datasets: [{
                    label: '响应时间 (ms)',
                    data: [120, 80, 150, 200, 180, 160, 100],
                    borderColor: this.chartColors.warning,
                    backgroundColor: 'transparent',
                    yAxisID: 'y',
                    tension: 0.4
                }, {
                    label: 'CPU使用率 (%)',
                    data: [30, 25, 45, 65, 55, 50, 35],
                    borderColor: this.chartColors.error,
                    backgroundColor: 'transparent',
                    yAxisID: 'y1',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: '系统性能监控',
                        font: { size: 16, weight: 'bold' }
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: '响应时间 (ms)'
                        },
                        grid: { color: 'rgba(0,0,0,0.1)' }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'CPU使用率 (%)'
                        },
                        grid: { drawOnChartArea: false }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });
    }

    // 创建渐变
    createGradient(ctx, colors) {
        if (!ctx || !ctx.createLinearGradient) {
            return colors[0] + '40'; // 返回半透明的颜色作为备选
        }
        try {
            const gradient = ctx.createLinearGradient(0, 0, 0, 400);
            gradient.addColorStop(0, colors[0] + '80');
            gradient.addColorStop(1, colors[1] + '20');
            return gradient;
        } catch (error) {
            console.warn('创建渐变失败，使用纯色备选方案:', error);
            return colors[0] + '40';
        }
    }

    // 更新图表数据
    updateChart(chartName, newData) {
        if (this.charts[chartName]) {
            this.charts[chartName].data = newData;
            this.charts[chartName].update();
        }
    }

    // 导出图表数据
    exportChartData(chartName) {
        if (this.charts[chartName]) {
            return JSON.stringify(this.charts[chartName].data, null, 2);
        }
        return null;
    }

    // 销毁图表
    destroyChart(chartName) {
        if (this.charts[chartName]) {
            this.charts[chartName].destroy();
            delete this.charts[chartName];
        }
    }

    // 销毁所有图表
    destroyAllCharts() {
        Object.keys(this.charts).forEach(chartName => {
            this.destroyChart(chartName);
        });
    }

    // 实时数据更新
    startRealTimeUpdates() {
        if (!window.dashboardRealData) return;
        setInterval(() => {
            this.updateRealTimeData();
        }, 30000);
    }

    updateRealTimeData() {}
}

// 初始化图表系统
let dashboardCharts;

document.addEventListener('DOMContentLoaded', function() {
    dashboardCharts = new DashboardCharts();
    
    // 添加导出功能
    document.addEventListener('click', function(e) {
        if (e.target.matches('[data-export-chart]')) {
            const chartName = e.target.dataset.exportChart;
            const data = dashboardCharts.exportChartData(chartName);
            if (data) {
                const blob = new Blob([data], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${chartName}-data.json`;
                a.click();
                URL.revokeObjectURL(url);
            }
        }
    });
});

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DashboardCharts;
}
