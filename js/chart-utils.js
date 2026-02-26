/**
 * 图表工具类 - 用于简历对比的数据可视化
 * 提供各种图表的创建和更新功能
 */

class ChartUtils {
    /**
     * 创建雷达图对比
     * @param {HTMLCanvasElement} canvas - 画布元素
     * @param {Array} resumes - 简历数据数组
     * @param {Array} dimensions - 对比维度
     * @returns {Chart} Chart.js实例
     */
    static createRadarChart(canvas, resumes, dimensions) {
        const ctx = canvas.getContext('2d');

        // 颜色配置
        const colors = [
            { bg: 'rgba(59, 130, 246, 0.2)', border: 'rgb(59, 130, 246)' }, // 蓝色
            { bg: 'rgba(16, 185, 129, 0.2)', border: 'rgb(16, 185, 129)' }, // 绿色
            { bg: 'rgba(139, 92, 246, 0.2)', border: 'rgb(139, 92, 246)' }  // 紫色
        ];

        // 构建数据集
        const datasets = resumes.map((resume, index) => ({
            label: resume.name,
            data: dimensions.map(dim => resume.scores[dim] || 0),
            backgroundColor: colors[index % colors.length].bg,
            borderColor: colors[index % colors.length].border,
            borderWidth: 2,
            pointBackgroundColor: colors[index % colors.length].border,
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: colors[index % colors.length].border
        }));

        return new Chart(ctx, {
            type: 'radar',
            data: {
                labels: dimensions.map(dim => this.getDimensionLabel(dim)),
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return `${context.dataset.label}: ${context.parsed.r}分`;
                            }
                        }
                    }
                },
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            stepSize: 20,
                            callback: function (value) {
                                return value + '分';
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        angleLines: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeInOutQuart'
                }
            }
        });
    }

    /**
     * 创建柱状图对比
     * @param {HTMLCanvasElement} canvas - 画布元素
     * @param {Array} resumes - 简历数据数组
     * @param {string} dimension - 对比维度
     * @returns {Chart} Chart.js实例
     */
    static createBarChart(canvas, resumes, dimension) {
        const ctx = canvas.getContext('2d');

        const colors = [
            'rgba(59, 130, 246, 0.8)',
            'rgba(16, 185, 129, 0.8)',
            'rgba(139, 92, 246, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(239, 68, 68, 0.8)'
        ];

        return new Chart(ctx, {
            type: 'bar',
            data: {
                labels: resumes.map(resume => resume.name),
                datasets: [{
                    label: this.getDimensionLabel(dimension),
                    data: resumes.map(resume => resume.scores[dimension] || 0),
                    backgroundColor: colors.slice(0, resumes.length),
                    borderColor: colors.slice(0, resumes.length).map(color => color.replace('0.8', '1')),
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return `${context.parsed.y}分`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function (value) {
                                return value + '分';
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                },
                animation: {
                    duration: 800,
                    easing: 'easeInOutQuart'
                }
            }
        });
    }

    /**
     * 创建技能对比图
     * @param {HTMLCanvasElement} canvas - 画布元素
     * @param {Array} resumes - 简历数据数组
     * @param {Array} skills - 技能列表
     * @returns {Chart} Chart.js实例
     */
    static createSkillChart(canvas, resumes, skills) {
        const ctx = canvas.getContext('2d');

        const colors = [
            'rgba(59, 130, 246, 0.8)',
            'rgba(16, 185, 129, 0.8)',
            'rgba(139, 92, 246, 0.8)'
        ];

        const datasets = resumes.map((resume, index) => ({
            label: resume.name,
            data: skills.map(skill => {
                const skillData = resume.skills.find(s => s.name === skill);
                return skillData ? skillData.level : 0;
            }),
            backgroundColor: colors[index % colors.length],
            borderColor: colors[index % colors.length].replace('0.8', '1'),
            borderWidth: 1,
            borderRadius: 4
        }));

        return new Chart(ctx, {
            type: 'bar',
            data: {
                labels: skills,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return `${context.dataset.label}: ${context.parsed.y}分`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function (value) {
                                return value + '分';
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeInOutQuart'
                }
            }
        });
    }

    /**
     * 获取维度标签
     * @param {string} dimension - 维度键
     * @returns {string} 维度标签
     */
    static getDimensionLabel(dimension) {
        const labels = {
            'basic_match': '基础匹配',
            'experience': '经验相关',
            'skills': '技能匹配',
            'education': '教育背景',
            'projects': '项目经验',
            'communication': '沟通能力',
            'leadership': '领导能力',
            'innovation': '创新能力',
            'teamwork': '团队协作',
            'problem_solving': '问题解决',
            'learning': '学习能力',
            'potential': '发展潜力',
            'job_fit': '岗位匹配度',
            'skill_fit': '技能匹配度',
            'experience_fit': '经验匹配度',
            'learning_ability': '学习能力',
            'job_match': '岗位匹配度',
            'skill_match': '技能匹配度',
            'experience_match': '经验匹配度',
            'project': '项目履历',
            'stability': '稳定性'
        };

        return labels[dimension] || dimension;
    }

    /**
     * 更新图表数据
     * @param {Chart} chart - Chart.js实例
     * @param {Array} newData - 新数据
     */
    static updateChart(chart, newData) {
        if (!chart || !newData) return;

        chart.data = newData;
        chart.update('active');
    }

    /**
     * 销毁图表
     * @param {Chart} chart - Chart.js实例
     */
    static destroyChart(chart) {
        if (chart && typeof chart.destroy === 'function') {
            chart.destroy();
        }
    }

    /**
     * 创建进度环形图
     * @param {HTMLCanvasElement} canvas - 画布元素
     * @param {number} score - 分数
     * @param {string} label - 标签
     * @returns {Chart} Chart.js实例
     */
    static createProgressRing(canvas, score, label) {
        const ctx = canvas.getContext('2d');

        // 根据分数确定颜色
        let color;
        if (score >= 80) {
            color = 'rgb(16, 185, 129)'; // 绿色
        } else if (score >= 60) {
            color = 'rgb(245, 158, 11)'; // 黄色
        } else {
            color = 'rgb(239, 68, 68)'; // 红色
        }

        return new Chart(ctx, {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [score, 100 - score],
                    backgroundColor: [color, 'rgba(0, 0, 0, 0.1)'],
                    borderWidth: 0,
                    cutout: '70%'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: false
                    }
                },
                animation: {
                    duration: 1500,
                    easing: 'easeInOutQuart'
                }
            },
            plugins: [{
                id: 'centerText',
                beforeDraw: function (chart) {
                    const ctx = chart.ctx;
                    const centerX = chart.chartArea.left + (chart.chartArea.right - chart.chartArea.left) / 2;
                    const centerY = chart.chartArea.top + (chart.chartArea.bottom - chart.chartArea.top) / 2;

                    ctx.save();
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';

                    // 绘制分数
                    ctx.font = 'bold 24px Arial';
                    ctx.fillStyle = color;
                    ctx.fillText(score, centerX, centerY - 5);

                    // 绘制标签
                    ctx.font = '12px Arial';
                    ctx.fillStyle = '#666';
                    ctx.fillText(label, centerX, centerY + 15);

                    ctx.restore();
                }
            }]
        });
    }
}

// 导出工具类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChartUtils;
} else {
    window.ChartUtils = ChartUtils;
}
