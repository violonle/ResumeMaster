/**
 * 维度数据标准化工具
 * 
 * 提供统一的维度数据解析、标准化和兜底补全逻辑
 * 消除 libraryController、recruitmentController、analysisController 中的代码重复
 */

/**
 * 维度关键词映射表
 */
const DIMENSION_MAPPINGS = {
    skills: [
        'skills', 'skill_match', 'professional', 'core_skills', 'job_fit',
        '专业技能', '技能评分', '技能匹配', '技术能力', '业务能力', '技能匹配度', '专业素质'
    ],
    experience: [
        'experience', 'experience_match', 'experience_fit', 'background',
        '工作经验', '经验契合', '经验评分', '履历背景', '项目经验', '行业经验', '工作背景', '经验匹配'
    ],
    project: [
        'project', 'project_match', 'project_fit', 'stability', 'work_stability', 'tenure',
        '稳定性', '离职风险', '职业稳定性', '项目背景', '履历匹配', '项目经验匹配',
        '项目实战', '项目表现', '项目履历', '工作稳定性', '项目匹配', '项目履历匹配'
    ],
    education: [
        'education', 'education_background', 'academic',
        '学历背景', '教育背景', '学历评分', '学术背景', '学校背景', '学历契合', '教育匹配'
    ],
    potential: [
        'potential', 'growth_potential', 'development', 'learning_ability',
        '发展潜力', '潜力评分', '成长性', '爆发力', '进取心', '学习能力', '职业潜力'
    ],
    teamwork: [
        'teamwork', 'collaboration', 'social',
        '团队协作', '协作能力', '团队精神', '沟通能力', '领导力', '组织协同力', '团队意识', '人际沟通'
    ]
};

/**
 * 从数据源中提取指定维度的分数
 * @param {Object|Array} source - 数据源（对象或数组）
 * @param {Array<string>} keys - 关键词列表
 * @returns {number} - 分数值（0-100）
 */
function extractDimensionValue(source, keys) {
    if (!source) return 0;

    const searchKeys = keys.map(k => k.toLowerCase());

    // 1. 如果 source 是数组（competency_matrix格式）
    const items = Array.isArray(source) ? source : (source.competency_matrix || []);
    if (Array.isArray(items) && items.length > 0) {
        for (const item of items) {
            const dimName = (item.dimension || item.name || '').toLowerCase();
            if (searchKeys.some(k => dimName.includes(k))) {
                return parseInt(item.score || item.value || 0) || 0;
            }
        }
    }

    // 2. 如果 source 是对象，按 key 匹配
    if (source && typeof source === 'object' && !Array.isArray(source)) {
        for (const key of keys) {
            // 精确匹配
            if (source[key] !== undefined) {
                let value = source[key];
                // 处理嵌套对象 {score: 80} 或 {value: 80}
                if (typeof value === 'object' && value !== null) {
                    value = value.score || value.score_detail || value.value || value.rating;
                }
                const score = parseInt(value) || 0;
                if (score > 0) return score;
            }

            // 模糊匹配（不区分大小写）
            const foundKey = Object.keys(source).find(k => k.toLowerCase() === key.toLowerCase());
            if (foundKey) {
                let value = source[foundKey];
                if (typeof value === 'object' && value !== null) {
                    value = value.score || value.score_detail || value.value || value.rating;
                }
                const score = parseInt(value) || 0;
                if (score > 0) return score;
            }
        }
    }

    return 0;
}

/**
 * 标准化维度数据
 * @param {Object|string} rawSource - 原始维度数据（可能是JSON字符串、对象或数组）
 * @returns {Object} - 标准化后的维度对象 {skills, experience, project, education, potential, teamwork}
 */
function normalizeDimensions(rawSource) {
    // 处理字符串
    let source = rawSource;
    if (typeof source === 'string') {
        try {
            source = JSON.parse(source);
        } catch (_) {
            source = {};
        }
    }

    // 处理无效数据
    if (!source || typeof source !== 'object') {
        return {
            skills: 0,
            experience: 0,
            project: 0,
            education: 0,
            potential: 0,
            teamwork: 0
        };
    }

    // 提取各维度分数
    return {
        skills: extractDimensionValue(source, DIMENSION_MAPPINGS.skills),
        experience: extractDimensionValue(source, DIMENSION_MAPPINGS.experience),
        project: extractDimensionValue(source, DIMENSION_MAPPINGS.project),
        education: extractDimensionValue(source, DIMENSION_MAPPINGS.education),
        potential: extractDimensionValue(source, DIMENSION_MAPPINGS.potential),
        teamwork: extractDimensionValue(source, DIMENSION_MAPPINGS.teamwork)
    };
}

/**
 * 兜底补全逻辑：当维度数据缺失时，基于总分进行推算
 * 
 * @param {Object} dimensions - 维度对象 {skills, experience, ...}
 * @param {number} overallScore - 总分（0-100）
 * @returns {Object} - 补全后的维度对象
 */
function applyFallbackLogic(dimensions, overallScore) {
    const validScores = Object.values(dimensions).filter(v => v > 0);

    // 情况1：所有维度都是0，但有总分 → 基于总分推算
    if (validScores.length === 0 && overallScore > 0) {
        Object.keys(dimensions).forEach(key => {
            // 使用伪随机算法确保每次刷新结果一致
            const pseudoRandom = (key.length * 13 + (overallScore % 7)) % 10; // 0-9
            dimensions[key] = Math.max(40, Math.round(overallScore * (0.82 + pseudoRandom * 0.01)));
        });
    }
    // 情况2：部分维度有值，部分为0 → 用平均分补全
    else if (validScores.length > 0 && validScores.length < 6) {
        const avg = validScores.reduce((a, b) => a + b, 0) / validScores.length;
        Object.keys(dimensions).forEach(key => {
            if (dimensions[key] === 0) {
                dimensions[key] = Math.max(40, Math.round(avg * 0.85));
            }
        });
    }

    return dimensions;
}

/**
 * 创建标准化的 Analysis JSON 对象
 * 
 * @param {Object} analysisRecord - 原始的 AnalysisResult 记录（Sequelize模型或普通对象）
 * @returns {Object|null} - 标准化的分析对象 {id, overall_score, dimensions} 或 null
 */
function createAnalysisJson(analysisRecord) {
    if (!analysisRecord) return null;

    const overall_score = analysisRecord.overall_score || 0;

    // 策略优化：
    // 1. 优先尝试从 dimensions 字段获取并标准化
    let dimensions = normalizeDimensions(analysisRecord.dimensions);
    let totalScore = Object.values(dimensions).reduce((sum, val) => sum + (Number(val) || 0), 0);

    // 2. 如果 dimensions 解析结果为 0 (可能是空或无效)，尝试从 detailed_analysis 提取
    if (totalScore === 0) {
        const detailDimensions = normalizeDimensions(analysisRecord.detailed_analysis);
        const detailTotal = Object.values(detailDimensions).reduce((sum, val) => sum + (Number(val) || 0), 0);

        // 如果 detailed_analysis 里面有有效数据，则采用它
        if (detailTotal > 0) {
            dimensions = detailDimensions;
        }
    }

    // 应用兜底补全逻辑
    // 记录应用补全前的维度状态，用于判断是否进行了估算
    const originalDimensions = { ...dimensions };
    const originalTotal = Object.values(originalDimensions).reduce((sum, val) => sum + (Number(val) || 0), 0);

    dimensions = applyFallbackLogic(dimensions, overall_score);

    // 如果原始维度总分为0，而补全后有分，则标记为估算值
    // 或者如果某个维度从0变为非0，也可以认为是估算（这里简化为整体判断）
    const isEstimated = originalTotal === 0 && overall_score > 0;

    return {
        id: analysisRecord.id,
        overall_score: overall_score,
        dimensions: dimensions,
        is_estimated: isEstimated
    };
}

module.exports = {
    normalizeDimensions,
    applyFallbackLogic,
    createAnalysisJson,
    DIMENSION_MAPPINGS
};
