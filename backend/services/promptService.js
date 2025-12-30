const { PromptTemplate } = require('../models');
const logger = require('../utils/logger');

// Default prompt templates (Simplified according to user requirements)
const DEFAULT_TEMPLATES = {
  // 1. 人才库-快速打分/批量筛选
  resume_quick_score: {
    name: '简历快速打分',
    category: 'job',
    variables: ['resumeText', 'jobDescriptionSection'],
    content: `请扮演资深招聘专家。请基于以下简历内容进行评估。
如果提供了目标职位描述（JD），请计算【100分制人岗匹配度】。
如果未提供JD，请基于简历本身的质量（工作稳定性、技能深度、项目含金量、学历背景）计算【100分制人才综合价值评分】。

### 100分制打分标准 (Scoring Criteria)
总分 (Total Score) = Σ (维度得分 * 权重)
1. 核心技能/专业能力 (Core Skills) - 权重: 35%
2. 工作经验/行业相关性 (Experience) - 权重: 30%
3. 项目经验/实战成果 (Project Quality) - 权重: 20%
4. 教育背景/资质证书 (Education & Certs) - 权重: 10%
5. 软技能/稳定性 (Soft Skills & Stability) - 权重: 5%

### 简历内容：
"""
{{resumeText}}
"""

{{jobDescriptionSection}}

### 输出要求：
    必须输出严格的JSON格式，禁止包含任何Markdown代码块标记，禁止包含任何解释性文字。
JSON结构如下：
{
  "overall_score": 整数(0-100),
  "match_level": "等级名称(极高匹配/高匹配/中等/一般/不匹配)",
  "scores_percent": {
    "job_fit": 0-100,
    "experience_fit": 0-100,
    "learning_ability": 0-100,
    "teamwork": 0-100
  },
  "reason": "简要说明打分依据（50字以内）"
}

注意：直接返回 JSON 对象本身，确保它可以被 JSON.parse() 直接解析。`
  },

  // 2. 深度解析中的单个简历深度解析
  resume_deep_analysis: {    name: '简历深度解析',
    category: 'analysis',
    variables: ['resumeText', 'targetJobSection'],
    content: `你是一位拥有20年经验的资深人力资源总监和职业规划专家。请对以下简历进行【极其严格】的深度解析和评估。

### 核心任务：
1. 提取基本信息。
2. 进行六维能力评分（0-100分）。
3. 计算综合评分（0-100分）。
4. 生成深度分析报告。

### 简历内容：
"""
{{resumeText}}
"""

{{targetJobSection}}

### 评分逻辑与算法说明（必须严格遵守）：
- **综合评分 (overall_score)**：禁止使用随机数或默认值。必须基于以下公式计算：
  overall_score = (技能匹配*0.3) + (经验契合*0.3) + (学历背景*0.15) + (稳定性*0.1) + (发展潜力*0.1) + (团队协作*0.05)
- **六维评分 (scores_percent)**：
  - skills (技能匹配): 考察关键词匹配度、技术栈深度。
  - experience (经验契合): 考察行业相关性、职级匹配度、项目含金量。
  - education (学历背景): 考察院校档次、专业相关性、学历等级。
  - stability (稳定性): 考察平均跳槽频率、单份工作时长。
  - potential (发展潜力): 考察名企背景、晋升速度、学习能力、项目复杂度。
  - teamwork (团队协作): 考察管理经验、跨部门协作描述、项目角色。

### 输出要求：
必须输出严格的JSON格式（不要包含Markdown代码块标记，不要包含任何前缀或后缀文字），包含以下结构。严禁返回提示词中的示例数据，必须根据简历内容实时生成。

{
  "basic_info": {
    "name": "姓名",
    "email": "邮箱",
    "phone": "电话",
    "age": "年龄",
    "gender": "性别",
    "location": "所在城市",
    "work_years": "工作年限",
    "education": "最高学历",
    "school": "毕业院校",
    "current_position": "当前职位",
    "current_company": "当前公司",
    "expected_salary": "期望薪资"
  },
  "overall_score": 0, 
  "scores_percent": {
    "skills": 0,
    "experience": 0,
    "education": 0,
    "stability": 0,
    "potential": 0,
    "teamwork": 0
  },
  "evaluation_report": {
    "summary": "针对该候选人的深度画像总结（不少于150字），要求犀利、专业，直击痛点",
    "strengths": ["具体优势1", "具体优势2", "具体优势3"],
    "weaknesses": ["具体劣势1", "具体劣势2", "具体劣势3"],
    "suggestions": ["具有实操性的改进建议1", "具有实操性的改进建议2"],
    "hiring_advice": "给HR的面试建议或录用建议"
  },
  "education_background": [
    { "school": "学校名", "degree": "学位", "major": "专业", "period": "时间段" }
  ],
  "work_experience": [
    { "company": "公司名", "title": "职位", "period": "时间段", "achievements": "具体可量化的成就描述" }
  ],
  "project_experience": [
    { "name": "项目名", "role": "角色", "description": "项目详细描述", "performance": "项目具体产出或贡献" }
  ]
}

要求：
1. 评分要严谨，不要给高分。
2. 评价报告必须原创，严禁套话。
3. 必须包含 weaknesses 字段，指出候选人的不足。
4. 必须包含 hiring_advice 字段。`
  },

  // 3. 简历对比解析
  resume_compare: {
    name: '简历对比解析',
    category: 'analysis',
    variables: ['resumesText', 'jobDescriptionSection'],
    content: `你是一位资深猎头专家。请对以下多份简历进行横向对比分析。

### 候选人简历列表：
"""
{{resumesText}}
"""

{{jobDescriptionSection}}

请输出严格的JSON格式（直接返回JSON对象，不带代码块），包含以下结构：

{
  "comparison_summary": "总体对比评价（150字以内）",
  "candidates": [
    {
      "name": "候选人姓名",
      "overall_score": 85,
      "match_level": "极高匹配",
      "scores_percent": {
        "skills": 85,
        "experience": 80,
        "education": 90,
        "stability": 75,
        "potential": 88,
        "teamwork": 80
      },
      "highlights": ["亮点1", "亮点2"],
      "risks": ["风险1"]
    }
  ],
  "recommendation": {
    "winner": "推荐的候选人姓名",
    "reason": "推荐理由",
    "hiring_risk": "招聘建议或风险提示"
  },
  "comparison_table": [
    {
      "dimension": "专业技能",
      "A": "评价内容",
      "B": "评价内容",
      "winner": "A"
    }
  ]
}

要求：
1. 必须客观公正地评价每一位候选人。
2. 评分基于提供的JD（如果有）或岗位通用标准。
3. comparison_table 中的 A, B, C 等字母对应简历列表中的顺序。`
  },

  // 4. 通用AI助手的提示词模板
  chat: {
    name: '与AI助理的对话',
    category: 'chat',
    variables: ['message'],
    content: `你是一个智能简历助手，名字叫“超级简历大师”。你的目标是帮助用户优化简历、准备面试、规划职业生涯。

用户说：{{message}}

请以专业、亲切、实用的语气回答。`
  },

  // 4. 数据分析所需要的提示词模板
  recruitment_forecast: {
    name: '招聘趋势预测',
    category: 'analysis',
    variables: ['dataJson'],
    content: `你是一位资深的人力资源数据分析师。请基于以下提供的招聘活动数据，进行深度的趋势预测和分析。

数据内容（JSON）：
"""
{{dataJson}}
"""

请输出严格的JSON格式报告，包含以下结构：
{
  "trend_analysis": "对招聘趋势的详细文字描述（约200字）",
  "pipeline_health": "对招聘漏斗健康度的评估",
  "potential_bottlenecks": ["瓶颈点1", "瓶颈点2"],
  "suggestions": ["改进建议1", "改进建议2"]
}

要求：
1. 分析要基于数据事实。
2. 预测要具有前瞻性和可操作性。
3. 必须返回合法的JSON格式。`
  }
};

class PromptService {
  constructor() {
    this.cache = {};
    this.cacheTTL = 60 * 1000; // 1 minute
    this.lastCacheTime = 0;
  }

  /**
   * Initialize default prompts in database
   */
  async ensureDefaultPrompts() {
    try {
      // First, get all existing keys to handle deletion of obsolete prompts
      const existingPrompts = await PromptTemplate.findAll();
      const existingKeys = existingPrompts.map(p => p.key);
      const targetKeys = Object.keys(DEFAULT_TEMPLATES);

      // 1. Delete prompts that are no longer in DEFAULT_TEMPLATES
      for (const key of existingKeys) {
        if (!targetKeys.includes(key)) {
          await PromptTemplate.destroy({ where: { key } });
          logger.info(`Deleted obsolete prompt template: ${key}`);
        }
      }

      // 2. Create or Update prompts from DEFAULT_TEMPLATES
      for (const [key, tpl] of Object.entries(DEFAULT_TEMPLATES)) {
        const [template, created] = await PromptTemplate.findOrCreate({
          where: { key },
          defaults: {
            key,
            name: tpl.name,
            content: tpl.content,
            variables: tpl.variables,
            category: tpl.category,
            description: `Default template for ${tpl.name}`,
            is_active: true
          }
        });

        if (!created) {
          // Update existing template to match new definition
          await template.update({
            name: tpl.name,
            content: tpl.content,
            variables: tpl.variables,
            category: tpl.category,
            description: `Default template for ${tpl.name}`
          });
          logger.info(`Updated default prompt template: ${key}`);
        } else {
          logger.info(`Initialized default prompt template: ${key}`);
        }
      }
      
      // Clear cache after update
      this.cache = {};
      this.lastCacheTime = 0;
      
    } catch (error) {
      logger.error('Failed to ensure default prompts:', error);
    }
  }

  /**
   * Get prompt template content by key
   */
  async getTemplate(key) {
    // Check cache
    const now = Date.now();
    if (this.cache[key] && (now - this.lastCacheTime < this.cacheTTL)) {
      return this.cache[key];
    }

    try {
      // Refresh cache if needed
      if (now - this.lastCacheTime >= this.cacheTTL) {
        const templates = await PromptTemplate.findAll({ where: { is_active: true } });
        this.cache = {};
        templates.forEach(t => {
          this.cache[t.key] = t;
        });
        this.lastCacheTime = now;
      }

      if (this.cache[key]) {
        return this.cache[key];
      }

      // Fallback to database query if not in cache
      const template = await PromptTemplate.findOne({ where: { key, is_active: true } });
      if (template) {
        this.cache[key] = template;
        return template;
      }
    } catch (error) {
      logger.error(`Error fetching prompt template ${key}:`, error);
    }

    // Fallback to code defaults
    if (DEFAULT_TEMPLATES[key]) {
      return DEFAULT_TEMPLATES[key];
    }

    return null;
  }

  /**
   * Get formatted prompt with variables interpolated
   * @param {string} key Template key
   * @param {object} variables Variables to interpolate
   */
  async getPrompt(key, variables = {}) {
    const template = await this.getTemplate(key);
    if (!template) {
      logger.warn(`Prompt template not found: ${key}`);
      return '';
    }

    let content = template.content;
    
    // Simple variable interpolation {{varName}}
    for (const [varKey, varValue] of Object.entries(variables)) {
      content = content.replace(new RegExp(`\\{\\{\\s*${varKey}\\s*\\}\\}`, 'g'), varValue || '');
    }
    
    return content;
  }
  
  /**
   * Process variable for Job Description specifically
   * Handles both string JD and object/array of jobs
   */
  prepareJobDescriptionVar(jd) {
      if (!jd) return '';
      let content = jd;
      if (typeof jd === 'object') {
          try {
              content = JSON.stringify(jd, null, 2);
          } catch (e) {
              content = String(jd);
          }
      }
      return `### 目标岗位（JD）：\n${content}\n`;
  }

  /**
   * Process variable for Target Job specifically (Alias for backward compatibility)
   */
  prepareTargetJobSection(targetJob) {
      if (!targetJob) return '';
      return this.prepareJobDescriptionVar(targetJob);
  }
}

module.exports = new PromptService();
