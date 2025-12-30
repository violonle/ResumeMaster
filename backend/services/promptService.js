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
  resume_deep_analysis: {
    name: '简历深度解析',
    category: 'analysis',
    variables: ['resumeText', 'targetJobSection'],
    content: `你是一位拥有20年经验的资深人力资源总监和人才评估专家。请对以下简历进行【极其严格】的深度能力解析与评估。

### 核心任务：
1. **人才画像提取**：深度分析候选人的技术栈、项目经验及综合素质。
2. **能力评估**：进行六维能力评分（0-100分），要求评分极其严谨。
3. **深度评估报告**：生成一份犀利、客观、直击本质的分析报告。

### 注意事项（极其重要）：
- **严禁提供简历编写或格式优化建议**（如“建议增加量化数据”、“建议调整排版”等）。
- **聚焦于“人”的分析**：报告应基于简历内容，分析候选人的专业技能深度、项目实战价值、学习潜力、稳定性及人岗匹配度。
- 所有的“改进建议”必须针对候选人的【能力短板】（如“需加强分布式架构的实战积累”）而非【简历写法】。

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
必须输出严格的JSON格式（不要包含Markdown代码块标记，不要包含任何前缀或后缀文字），包含以下结构：

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
    "strengths": ["核心专业优势1", "核心专业优势2", "核心专业优势3"],
    "weaknesses": ["识别出的能力短板1", "识别出的能力短板2", "识别出的能力短板3"],
    "suggestions": ["针对能力短板的提升建议1", "针对能力短板的提升建议2"],
    "hiring_advice": "给HR的面试考察重点或录用建议"
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
3. 严禁出现关于“简历怎么写”的任何建议。`
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
  },

  // 5. 补充深度分析报告
  resume_supplement_report: {
    name: '补充深度分析报告',
    category: 'analysis',
    variables: ['resumeText', 'targetJobSection'],
    content: `你是一位资深的人力资源专家和人才评估顾问。请针对以下简历内容，生成一份专业、客观且犀利的【AI深度分析报告】。

### 核心分析重点：
1. **能力画像**：深度挖掘候选人的技术栈深度、核心专业能力及跨领域综合素养。
2. **实战价值**：评估项目经验的含金量、解决复杂问题的能力及在团队中的实际贡献。
3. **潜能与成长性**：分析其学习能力、技术敏感度、逻辑思维及未来发展潜力。
4. **匹配度评估**：结合行业标准或提供的职位描述，评估其与岗位的适配程度（若无JD则基于通用职级要求）。

### 注意事项：
- **禁止提供简历编写优化建议**（如“建议增加量化成果”、“建议调整格式”等）。
- 重点在于对候选人【人本身】的能力和潜质进行客观评估。
- 语言风格：专业、严谨、不套话、直击要害。

### 简历内容：
"""
{{resumeText}}
"""

{{targetJobSection}}

### 输出要求：
必须输出严格的JSON格式（不带Markdown代码块，不带多余文字），包含以下结构：
{
  "summary": "【能力总结】对候选人的综合能力进行深度画像总结（不少于150字）。",
  "strengths": ["【核心优势1】具体、客观的优势点", "【核心优势2】", "【核心优势3】"],
  "weaknesses": ["【不足之处1】识别出的能力短板或潜在风险点", "【不足之处2】", "【不足之处3】"],
  "suggestions": ["【改进建议1】针对其能力短板的提升建议或面试深度考察方向", "【改进建议2】"],
  "hiring_advice": "【录用建议】综合各维度表现，给出明确的面试或录用建议。"
}

注意：直接返回 JSON 对象本身，确保它可以被 JSON.parse() 直接解析。`
  },

  // 6. 面试问题生成
  interview_questions: {
    name: '面试问题生成',
    category: 'analysis',
    variables: ['resumeText', 'targetJobSection'],
    content: `你是一位资深面试官。请基于候选人的简历和目标职位要求，设计一套具有针对性的面试问题。

### 简历内容：
"""
{{resumeText}}
"""

{{targetJobSection}}

### 输出要求：
必须输出严格的JSON格式，包含以下结构：
{
  "ice_breaking": "破冰问题",
  "technical_questions": ["技术问题1", "技术问题2"],
  "behavioral_questions": ["行为面试题1", "行为面试题2"],
  "logic_potential": ["潜力/逻辑考察题1"],
  "interviewer_tips": "给面试官的提问技巧建议"
}`
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
   * Render prompt with variables
   */
  async getPrompt(key, variables = {}) {
    const template = await this.getTemplate(key);
    if (!template) {
      throw new Error(`Prompt template ${key} not found`);
    }

    let content = template.content;
    for (const [v, val] of Object.entries(variables)) {
      const regex = new RegExp(`{{${v}}}`, 'g');
      content = content.replace(regex, val || '');
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
