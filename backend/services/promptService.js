const { PromptTemplate } = require('../models');
const logger = require('../utils/logger');

// Default prompt templates (Refined for Production Use)
const DEFAULT_TEMPLATES = {
  resume_analysis: {
    name: '简历解析与分析',
    category: 'resume',
    variables: ['resumeText', 'jobDescriptionSection'],
    content: `你是一位拥有20年经验的资深人力资源总监和职业规划专家。请对以下简历进行深度解析和评估。

简历文本：
"""
{{resumeText}}
"""

{{jobDescriptionSection}}

请输出严格的JSON格式（不要包含Markdown代码块标记，直接返回JSON字符串），包含以下结构：

{
  "basic_info": {
    "name": "姓名",
    "email": "邮箱",
    "phone": "电话",
    "age": "年龄（数字）",
    "gender": "性别",
    "location": "所在城市",
    "work_years": "工作年限（数字）",
    "education": "最高学历",
    "school": "毕业院校",
    "current_position": "当前职位",
    "current_company": "当前公司",
    "salary_expectation": "期望薪资"
  },
  "education_background": [
    { "school": "学校名", "degree": "学历", "major": "专业", "start_date": "YYYY-MM", "end_date": "YYYY-MM" }
  ],
  "work_experience": [
    { "company": "公司名", "title": "职位", "start_date": "YYYY-MM", "end_date": "YYYY-MM", "responsibilities": "主要职责总结", "achievements": "主要成就" }
  ],
  "project_experience": [
    { "name": "项目名", "role": "角色", "description": "项目描述", "tech_stack": ["技术栈"], "performance": "项目成果" }
  ],
  "skills_certifications": {
    "skills": ["技能1", "技能2"],
    "languages": ["语言能力"],
    "certifications": ["证书1"]
  },
  "radar_scores": {
    "job_match": 0, "skill_match": 0, "experience_match": 0, "learning_ability": 0, "teamwork": 0
  },
  "overall_score": 0,
  "evaluation_report": {
    "summary": "150字左右的候选人综合画像总结",
    "core_strengths": ["优势1", "优势2", "优势3"],
    "potential_issues": ["劣势/风险点1", "劣势/风险点2"],
    "career_advice": ["职业发展建议1", "职业发展建议2"],
    "job_fit_analysis": "如果提供了目标岗位，请详细分析匹配度；否则留空"
  }
}

评分标准（1-5分，overall_score为0-100分）：
- job_match: 岗位匹配度（需参考目标岗位）
- skill_match: 技能契合度
- experience_match: 经验相关性
- learning_ability: 学习与成长潜力
- teamwork: 团队协作与领导力

注意事项：
1. 信息提取要准确，缺失字段请留空字符串，不要编造。
2. 评价要客观、中肯、专业。
3. 必须返回合法的JSON格式。`
  },
  resume_compare: {
    name: '简历对比分析',
    category: 'resume',
    variables: ['resumesText', 'jobDescriptionSection'],
    content: `你是一位招聘专家。请根据目标岗位描述（JD），对以下几份简历进行横向对比分析。

{{jobDescriptionSection}}

候选人简历列表：
{{resumesText}}

请输出JSON格式报告：
{
  "radar_scores": {
    "job_match": {"A": 4, "B": 3},
    "skill_match": {"A": 5, "B": 4},
    "experience_match": {"A": 3, "B": 5},
    "learning_ability": {"A": 4, "B": 4},
    "teamwork": {"A": 4, "B": 5}
  },
  "global_scores": {"A": 88, "B": 82},
  "comparison_table": [
    {
      "dimension": "教育背景",
      "A": "候选人A的教育亮点/劣势",
      "B": "候选人B的教育亮点/劣势",
      "winner": "A/B/Tie",
      "comment": "对比点评"
    },
    {
      "dimension": "工作经验",
      "A": "...", "B": "...", "winner": "...", "comment": "..."
    },
    {
      "dimension": "技能匹配",
      "A": "...", "B": "...", "winner": "...", "comment": "..."
    },
    {
      "dimension": "综合素质",
      "A": "...", "B": "...", "winner": "...", "comment": "..."
    }
  ],
  "recommendation": {
    "winner": "A",
    "reason": "详细阐述推荐理由，说明为什么A比B更适合该岗位。",
    "hiring_risk": "录用建议的候选人可能存在的风险提示"
  }
}

要求：
1. 对比要基于事实，引用简历中的具体内容作为依据。
2. 即使没有JD，也要基于通用职场标准进行对比（如稳定性、成长性）。
3. Winner必须明确，除非确实难分伯仲。`
  },
  job_matching: {
    name: '职位匹配分析',
    category: 'job',
    variables: ['resumeText', 'jobsJson'],
    content: `请扮演AI招聘助手。我将提供一份简历和一个职位列表，请分析该简历与列表中每个职位的匹配程度。

简历内容：
"""
{{resumeText}}
"""

职位列表（JSON）：
{{jobsJson}}

请返回匹配度最高的前5个职位，JSON格式如下：
[
  {
    "job_id": "职位ID（保持原样）",
    "job_title": "职位名称",
    "match_score": 85,
    "match_level": "High/Medium/Low",
    "reason": "简要说明匹配原因（30字以内）",
    "detailed_analysis": "详细的匹配分析，包括技能重合点和经验匹配点（100字左右）",
    "missing_skills": ["缺失技能1", "缺失技能2"]
  }
]

排序规则：按 match_score 从高到低排序。如果匹配度都低于60分，也请列出相对最接近的，但在reason中说明不匹配。`
  },
  content_gen_resume_summary: {
    name: '生成简历摘要',
    category: 'generation',
    variables: ['dataJson'],
    content: `你是一位专业的简历撰写顾问。请根据提供的候选人数据，撰写一段精彩的“个人总结”（Professional Summary）。

候选人数据：
{{dataJson}}

要求：
1. 字数控制在150-200字。
2. 采用第三人称或第一人称（根据通常简历习惯，建议省略人称代词，直接用动词开头）。
3. 突出核心竞争力、关键成就和职业目标。
4. 语言简练、有力，富有职业感。
5. 直接输出文本内容，不要包含JSON或其他包装。`
  },
  content_gen_cover_letter: {
    name: '生成求职信',
    category: 'generation',
    variables: ['dataJson'],
    content: `你是一位求职辅导专家。请根据候选人背景和目标岗位，撰写一封真诚且有说服力的求职信（Cover Letter）。

输入数据：
{{dataJson}}

要求：
1. 格式标准（称呼、正文、结语）。
2. 正文分三段：
   - 开头：表明申请的职位及对此职位的热情。
   - 中间：结合过往经验证明自己为何是最佳人选，通过具体案例（如数据、项目）支撑。
   - 结尾：表达面试意愿并致谢。
3. 语气自信、礼貌且专业。
4. 直接输出Markdown格式的信件内容。`
  },
  content_gen_job_description: {
    name: '优化职位描述',
    category: 'generation',
    variables: ['dataJson'],
    content: `你是一位资深招聘专家。请对以下原始的职位描述（JD）进行润色和优化，使其更加专业、吸引人且结构清晰。

原始信息：
{{dataJson}}

请输出优化后的JD，包含以下Markdown章节：
## 职位名称
[优化后的职位名称]

## 职位诱惑
[3-5个吸引人的亮点，如薪资福利、团队氛围、技术挑战等]

## 岗位职责
[使用清晰的条目列出核心职责，动词开头]

## 任职要求
[硬性条件 + 软性素质，分条列出]

## 加分项 (Preferred Qualifications)
[非必须但加分的技能或经验]

注意：保持原有核心要求不变，主要是提升表达的专业度和吸引力。`
  },
  quick_analysis_keywords: {
    name: '快速提取关键词',
    category: 'quick_analysis',
    variables: ['text'],
    content: `请从以下文本中提取最关键的10-15个关键词，用于标签化管理。

文本：
"""
{{text}}
"""

返回格式：逗号分隔的字符串（例如：Java, Spring Boot, 微服务, 团队管理）。不要包含其他内容。`
  },
  quick_analysis_summary: {
    name: '快速生成摘要',
    category: 'quick_analysis',
    variables: ['text'],
    content: `请用精炼的语言（100字以内）总结以下文本的核心内容。

文本：
"""
{{text}}
"""

直接输出摘要内容。`
  },
  quick_analysis_sentiment: {
    name: '快速情感分析',
    category: 'quick_analysis',
    variables: ['text'],
    content: `请分析以下文本的情感倾向。

文本：
"""
{{text}}
"""

返回格式：JSON
{
  "sentiment": "Positive/Neutral/Negative",
  "score": 0.8,
  "explanation": "简要理由"
}`
  },
  quick_analysis_skills: {
    name: '快速提取技能',
    category: 'quick_analysis',
    variables: ['text'],
    content: `请从以下简历文本中全面提取技能标签（包括硬技能、软技能、工具、语言等）。

文本：
"""
{{text}}
"""

返回格式：逗号分隔的字符串。`
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
      for (const [key, tpl] of Object.entries(DEFAULT_TEMPLATES)) {
        // Always try to create, if key exists we might want to update ONLY if it was created by system/init
        // For now, we use findOne. 
        // NOTE: User requested to regenerate defaults. 
        // Ideally we should check if content is empty or explicitly update it.
        // But `sync-prompts.js` will handle the force update/truncate logic.
        // Here we just provide the definition.
        
        const exists = await PromptTemplate.findOne({ where: { key } });
        if (!exists) {
          await PromptTemplate.create({
            key,
            name: tpl.name,
            content: tpl.content,
            variables: tpl.variables,
            category: tpl.category,
            description: `Default template for ${tpl.name}`,
            is_active: true
          });
          logger.info(`Initialized default prompt template: ${key}`);
        }
      }
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
   * Process variable for Job Description specifically to match old logic
   * This is a helper to keep logic clean
   */
  prepareJobDescriptionVar(jd) {
      return jd ? `目标岗位（JD）：\n${jd}\n` : '';
  }
}

module.exports = new PromptService();