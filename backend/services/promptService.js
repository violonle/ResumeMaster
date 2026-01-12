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
    content: `你是一位拥有20年经验的全球顶级人才评估专家（Assessment Expert）。请对以下简历进行【全方位、深层次、犀利】的深度解析。

### 核心任务：
1. **深度画像**：超越简历表面文字，通过项目细节和职业轨迹，推演候选人的真实能力边界、技术深度和思维模式。
2. **六维评估**：进行严格的六维能力打分（0-100），拒绝平庸的“高分”，必须客观反映候选人在市场上的相对位置。
3. **战略建议**：不仅指出问题，还要给出具体的职业发展战略和学习路径。

### 注意事项（极其重要）：
- **严禁**提供任何关于简历排版、字体、格式的建议。
- **严禁**使用模棱两可的套话（如“建议加强学习”），必须给出具体方向（如“建议深入学习分布式一致性算法如Raft/Paxos”）。
- **聚焦于“人”的本质**：关注其解决问题的复杂度、在团队中的真实影响力、以及未来的成长天花板。

### 简历内容：
"""
{{resumeText}}
"""

{{targetJobSection}}

### 评分逻辑与算法说明（必须严格遵守）：
- **综合评分 (overall_score)**：禁止使用随机数。公式：(技能*0.3 + 经验*0.3 + 学历*0.1 + 稳定性*0.1 + 潜力*0.15 + 协作*0.05)。
- **评分基准**：
  - <60分：初级/不合格
  - 60-75分：中级/合格
  - 75-85分：高级/优秀
  - 85-95分：资深/卓越
  - >95分：行业顶尖（极其罕见）

### 输出要求：
必须输出严格的JSON格式（不要包含Markdown代码块标记），包含以下结构：

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
    "skills": 0,      // 技术/专业硬技能
    "experience": 0,  // 行业经验与项目深度
    "education": 0,   // 教育背景与学术能力
    "stability": 0,   // 职业稳定性与忠诚度
    "potential": 0,   // 学习能力与发展潜力
    "teamwork": 0     // 沟通协作与领导力
  },
  "evaluation_report": {
    "summary": "【深度画像】（200字以上）请从“专业能力”、“软素质”、“职业成熟度”三个维度进行深度总结。要犀利、客观，能准确勾勒出候选人的职场形象。",
    "strengths": [
      "【核心优势1】观点 + 简历中的证据支撑（例如：精通高并发架构，曾在双11项目中抗住10万QPS）", 
      "【核心优势2】...",
      "【核心优势3】..."
    ],
    "weaknesses": [
      "【核心短板1】观点 + 潜在风险分析（例如：技术栈过于老旧，缺乏云原生落地经验，可能难以适应现代化架构）", 
      "【核心短板2】...",
      "【核心短板3】..."
    ],
    "suggestions": [
      "【提升建议1】具体的行动指南（例如：建议考取PMP证书以补足项目管理理论）", 
      "【提升建议2】..."
    ],
    "hiring_advice": "【录用决策建议】（100字左右）明确指出该候选人适合什么样的团队/阶段，以及面试中需要重点考察的“存疑点”。"
  },
  "education_background": [
    { "school": "学校名", "degree": "学位", "major": "专业", "period": "时间段" }
  ],
  "work_experience": [
    { "company": "公司名", "title": "职位", "period": "时间段", "achievements": "提取关键且可量化的成就" }
  ],
  "project_experience": [
    { "name": "项目名", "role": "角色", "description": "简述", "performance": "核心贡献" }
  ]
}`
  },

  // 3. 简历对比解析
  resume_compare: {
    name: '简历对比解析',
    category: 'analysis',
    variables: ['resumesText', 'jobDescriptionSection'],
    content: `你是一位资深的人才战略顾问。请对以下多份简历进行【多维度、深层次】的横向对比分析，辅助招聘决策。

### 候选人简历列表：
"""
{{resumesText}}
"""

{{jobDescriptionSection}}

### 分析要求：
1. **拒绝表面对比**：不要只比学历和年限，要深入对比项目复杂度、技术栈的落地深度以及解决问题的思维方式。
2. **挖掘隐性差异**：重点识别候选人在“管理潜质”、“学习自驱力”和“文化适配度”上的差异。
3. **决策辅助**：最终的推荐必须有理有据，并明确指出选择该候选人的潜在风险（Trade-off）。

### 输出要求：
请输出严格的JSON格式（直接返回JSON对象，不带代码块），包含以下结构：

{
  "comparison_summary": "【总体态势】（200字左右）概述本次候选人的整体水平分布，横向对比各候选人的核心差异点（例如：A胜在技术深度，B胜在管理经验）。",
  "candidates": [
    {
      "file_name": "必须严格等于输入中该简历的文件名",
      "name": "候选人姓名",
      "overall_score": 85,
      "match_level": "极高匹配/高匹配/中等/一般/不匹配",
      "scores_percent": {
        "skills": 85,      // 技术硬实力
        "experience": 80,  // 项目经验深度
        "education": 90,   // 学历背景
        "stability": 75,   // 稳定性
        "potential": 88,   // 潜力和成长性
        "teamwork": 80     // 沟通与领导力
      },
      "highlights": ["【亮点1】具体优势", "【亮点2】...", "【亮点3】..."],
      "risks": ["【风险1】具体劣势或存疑点", "【风险2】..."],
      "evaluation": "（100字）针对该候选人的个体精准画像，点评其在本次竞争中的优劣势。"
    }
  ],
  "recommendation": {
    "winner": "推荐的候选人姓名",
    "reason": "【推荐逻辑】（150字）深度阐述为什么该候选人是最佳选择（Better than others）。",
    "hiring_risk": "【录用风险提示】录用该候选人可能面临的挑战（如：薪资要求高、可能需要磨合期等）。",
    "trade_off": "【决策权衡】如果放弃第二名，我们失去了什么？（例如：放弃B意味着失去了一个即战力强的管理型人才）。"
  },
  "comparison_table": [
    {
      "dimension": "技术深度与广度",
      "A": "基于简历事实的评价",
      "B": "基于简历事实的评价",
      "winner": "A/B/平手"
    },
    {
      "dimension": "项目经验含金量",
      "A": "评价...",
      "B": "评价...",
      "winner": "A/B/平手"
    },
    {
      "dimension": "管理与沟通能力",
      "A": "评价...",
      "B": "评价...",
      "winner": "A/B/平手"
    },
    {
      "dimension": "长期发展潜力",
      "A": "评价...",
      "B": "评价...",
      "winner": "A/B/平手"
    },
    {
      "dimension": "稳定性与匹配度",
      "A": "评价...",
      "B": "评价...",
      "winner": "A/B/平手"
    }
  ]
}

要求：
1. **客观中立**：评价必须基于简历事实，避免主观臆测。
2. **强制匹配**：candidates 数组中的 file_name 字段必须与输入中的文件名完全一致，否则系统无法识别。
3. **JSON格式**：严禁包含Markdown标记（如 \`\`\`json），严禁包含任何前缀后缀文字。`
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

  // 6. 模拟面试题生成
  interview_question_generation: {
    name: '模拟面试题生成',
    category: 'interview',
    variables: ['resumeText', 'questionCount'],
    content: `你是一位资深的技术面试官。请基于以下简历内容，生成 {{questionCount}} 道针对性的面试题。
    
    ### 任务要求：
    1. **针对性**：题目必须紧扣简历中的技术栈、项目经验和工作职责。
    2. **专业性**：涵盖基础理论、实战应用、方案设计和问题解决。
    3. **层次感**：题目应包含从易到难的不同梯度。
    4. **分类**：将题目分为以下类别之一：PROJECT, JAVA_BASIC, JAVA_COLLECTION, JAVA_CONCURRENT, MYSQL, REDIS, SPRING, SPRING_BOOT (若简历不是Java背景，请根据实际技术栈分类，但类别名称保持大写且尽量贴近)。

    ### 简历内容：
    """
    {{resumeText}}
    """

    ### 输出要求：
    必须输出严格的JSON格式（不带Markdown代码块，不带多余文字），包含以下结构：
    {
      "questions": [
        {
          "questionIndex": 1,
          "question": "题目描述",
          "type": "CATEGORY_NAME",
          "category": "类别中文描述"
        }
      ]
    }
    `
  },
  
  // 7. 面试回答评估
  interview_answer_evaluation: {    name: '面试回答评估',
    category: 'interview',
    variables: ['question', 'userAnswer'],
    content: `你是一位资深的技术面试官。请对以下面试题的回答进行专业评估。

    ### 面试题：
    {{question}}

    ### 候选人回答：
    {{userAnswer}}

    ### 评估要求：
    1. **打分**：0-100分，客观评价回答的准确性、深度和逻辑。
    2. **反馈**：指出回答中的亮点和不足，给出改进建议。
    3. **参考答案**：提供一份标准或优秀的参考答案，并列出核心关键词/要点。

    ### 输出要求：
    必须输出严格的JSON格式（不带Markdown代码块，不带多余文字），包含以下结构：
    {
      "score": 85,
      "feedback": "反馈意见",
      "referenceAnswer": "参考答案",
      "keyPoints": ["核心要点1", "核心要点2"]
    }
    `
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
