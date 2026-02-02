if (!process.env.DB_ALLOW_SQLITE_DEV && process.env.NODE_ENV !== 'production') {
  process.env.DB_ALLOW_SQLITE_DEV = '1';
}

const { sequelize, PromptTemplate } = require('../backend/models');

const templates = [
  {
    key: 'resume_quick_score',
    name: '简历快速快评',
    category: 'analysis',
    variables: ['resumeText', 'jobDescriptionSection'],
    description: '快速评估简历与JD的匹配度，给出评分和核心优劣势',
    content: `请扮演资深招聘专家。请基于以下简历内容进行评估。
如果提供了目标职位描述（JD），请计算【100分制人岗匹配度】。
如果未提供JD，请基于简历本身的质量（工作稳定性、技能深度、项目含金量、学历背景）计算【100分制人才综合价值评分】。

### 评估纪律（必须遵守）：
1) 只基于简历事实判断；不确定之处写明“信息不足”，并在分数中体现扣分，禁止臆测。
2) 输出要“快但准”：重点看胜任力证据、可迁移能力、风险点；避免冗长。
3) 亮点与不足必须可复核：每条尽量包含证据线索（项目/职责/指标/年限/技术栈/业务场景）。
4) 分数要“校准”：默认从 70 分起上下调整；没有证据的加分一律不加。

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
  "highlights": ["亮点1（含证据）", "亮点2（含证据）", "亮点3（含证据）"],
  "gaps": ["不足1（含证据/缺失信息）", "不足2（含证据/缺失信息）", "不足3（含证据/缺失信息）"],
  "reason": "简要说明打分依据（50字以内）"
}

注意：直接返回 JSON 对象本身，确保它可以被 JSON.parse() 直接解析。`
  },
  {
    key: 'resume_deep_analysis',
    name: '简历深度解析',
    category: 'analysis',
    variables: ['resumeText', 'targetJobSection'],
    description: '全方位深度评估候选人能力维度',
    content: `你是一位全球顶尖的人才评估专家与用人经理（兼具HR专业与业务视角），以“严谨、可复核、可落地”为标准。请仅基于简历内容进行深度解析，输出全面、翔实、专业、精准且通俗易懂的评估结论。

### 解析原则（必须遵守）：
1. 只基于简历事实推断；对不确定之处明确标注“信息不足/需面试核实”，禁止臆测。
2. 严禁提供任何排版、格式、措辞、字体等“简历优化建议”。
3. 语言要专业但不堆术语：遇到专业名词请用一句话解释其意义或风险点。
4. 每条优势/风险都尽量给出证据来源（例如：项目/职责/指标/年限/技术栈/业务场景）。
5. 结论要“可决策”：必须回答“是否值得面试、适合什么岗位/团队阶段、风险如何控制”。

### 简历内容：
"""
{{resumeText}}
"""

{{targetJobSection}}

### 输出要求（极其重要）：
- 必须输出严格 JSON（直接输出 JSON 对象本身），禁止包含任何 Markdown 代码块标记，禁止输出任何前缀/后缀文字。
- 所有分数为 0-100 的整数。
- match_level 按以下规则：>=90 极高匹配；80-89 高匹配；70-79 中等；60-69 一般；<60 不匹配。
- strengths/weaknesses/suggestions 每条必须“具体、可复核、可执行”，禁止空话；每条尽量包含“证据/缺失信息 + 影响 + 验证方式/行动”。
- 产出要“翔实”：strengths 至少 6 条；weaknesses 至少 6 条；suggestions 至少 6 条。
- summary 与 hiring_advice 需分段，便于非专业读者快速理解。

JSON 结构如下：
{
  "overall_score": 0,
  "match_level": "极高匹配/高匹配/中等/一般/不匹配",
  "scores_percent": {
    "skills": 0,
    "experience": 0,
    "education": 0,
    "stability": 0,
    "potential": 0,
    "teamwork": 0
  },
  "summary": "用中文分段输出：\\n【一句话结论】（是否值得面试 + 关键理由）\\n【能力画像】（技术/业务/软能力，写清能力边界）\\n【证据摘要】（5-10条，来自简历事实）\\n【风险与不确定点】（5-10条，说明影响与验证方式）\\n【适配画像】（适合的岗位/团队阶段/管理方式；不适合的场景）",
  "strengths": [
    "【优势关键词】具体优势 + 证据（来自简历的项目/职责/技术栈/产出） + 对岗位的价值",
    "..."
  ],
  "weaknesses": [
    "【风险关键词】风险点 + 证据/缺失信息 + 可能带来的影响 + 建议面试如何验证",
    "..."
  ],
  "suggestions": [
    "【建议】可执行的提升路径或面试考察方向（包含具体主题/方法/验证点）",
    "..."
  ],
  "hiring_advice": "用中文分段输出：\\n【录用建议】强烈推荐/推荐/谨慎考察/不推荐（写清理由与证据）\\n【建议定位】更像初级/中级/高级/专家（给出判断依据）\\n【面试路线】从易到难列出 8-12 个必须追问的问题（每题写清目的与验证点）\\n【风险控制】若录用，入职 30/60/90 天的验证目标（可量化、可观察）",
  "education_background": [
    { "school": "", "degree": "", "major": "", "period": "" }
  ],
  "work_experience": [
    { "company": "", "title": "", "period": "", "achievements": "" }
  ],
  "project_experience": [
    { "name": "", "role": "", "description": "", "performance": "" }
  ]
}`
  },
  {
    key: 'resume_compare',
    name: '简历对比解析',
    category: 'analysis',
    variables: ['resumesText', 'jobDescriptionSection'],
    description: '对多位候选人进行深度横向对比并给出招聘决策建议',
    content: `你是一位全球顶尖的人才战略顾问（兼具业务判断与组织人才观）。请对以下多份简历进行【多维度、深层次、可复核】的横向对比分析，辅助招聘决策。

### 候选人简历列表：
"""
{{resumesText}}
"""

{{jobDescriptionSection}}

### 分析要求：
1) 拒绝表面对比：不要只比学历和年限，要深入对比项目复杂度、技术栈落地深度、解决问题方式与影响范围。
2) 挖掘隐性差异：重点识别管理潜质、学习自驱力、文化适配度、抗压与协作方式。
3) 证据优先：所有亮点/风险必须尽量指出证据线索；信息不足必须在风险里说明并影响打分。
4) 分数校准：避免所有人高分；用相对排名 + 绝对胜任力门槛双重约束。

### 输出要求：
请输出严格的JSON格式（直接返回JSON对象，不带代码块），包含以下结构：
{
  "comparison_summary": "【总体评价】（200字左右）概述本次候选人的整体水平分布，横向对比各候选人的核心差异点。要专业且深刻。",
  "candidates": [
    {
      "file_name": "必须严格等于输入中该简历的文件名",
      "name": "候选人姓名",
      "overall_score": 85,
      "match_level": "极高匹配/高匹配/中等/一般/不匹配",
      "scores_percent": {
        "skills": 85,
        "experience": 80,
        "education": 90,
        "stability": 75,
        "potential": 88,
        "teamwork": 80
      },
      "highlights": ["【关键词】亮点描述（含证据线索）", "【关键词】...", "【关键词】..."],
      "risks": ["【关键词】风险描述（含缺失信息/影响/验证方式）", "【关键词】..."],
      "evaluation": "（200字左右）个体画像：能力边界、关键证据、最适配场景与限制条件。"
    }
  ],
  "recommendation": {
    "winner": "推荐的候选人姓名",
    "reason": "【推荐逻辑】（250字左右）写清胜出的关键证据、与岗位成功要素的映射、以及对其他候选人的决定性差异。",
    "hiring_risk": "【录用风险提示】（150字左右）写清风险点、影响范围、与面试/试用期的验证动作。",
    "trade_off": "【决策权衡】（150字左右）如果放弃其他候选人，我们失去的能力/资源是什么，以及替代/补位方案。"
  },
  "comparison_matrix": {
    "skills_winner": "姓名",
    "experience_winner": "姓名",
    "education_winner": "姓名"
  }
}

要求：
1) 客观中立：评价必须基于简历事实，避免主观臆测。
2) 关键词格式：亮点和风险必须使用【关键词】开头，且内容要具体、专业。
3) JSON格式：严禁包含Markdown标记，严禁包含任何前缀后缀文字。`
  },
  {
    key: 'interview_question_generation',
    name: '定制面试题生成',
    category: 'interview',
    variables: ['resumeText', 'jobDescription', 'count'],
    description: '根据简历疑点和JD重点生成面试题',
    content: `请针对以下简历和职位描述，生成 {{count}} 道定制化的面试题目。题目应侧重于验证简历中的真实性、考察核心能力以及挖掘潜在问题。

### 职位描述：
"""
{{jobDescription}}
"""

### 候选人简历：
"""
{{resumeText}}
"""

### 输出要求（严格 JSON）：
{
  "questions": [
    {
      "type": "专业技能/项目经验/软技能/行为面试",
      "question": "面试问题",
      "purpose": "考察目的",
      "reference_answer": "参考回答要点"
    }
  ]
}`
  },
  {
    key: 'interview_answer_evaluation',
    name: '面试回答评估',
    category: 'interview',
    variables: ['question', 'userAnswer', 'jobDescription'],
    description: '评估候选人面试回答的质量',
    content: `请作为面试官，评估候选人对以下问题的回答质量。

### 面试问题：
{{question}}

### 候选人回答：
{{userAnswer}}

### 职位背景：
{{jobDescription}}

### 输出要求（严格 JSON）：
{
  "score": 0,
  "feedback": "点评",
  "strengths": ["..."],
  "weaknesses": ["..."],
  "follow_up_question": "追问问题"
}`
  },
  {
    key: 'chat',
    name: 'AI招聘助手',
    category: 'assistant',
    variables: ['context', 'query'],
    description: '通用招聘助手对话人设',
    content: `你是一位拥有20年经验的资深人力资源总监（HRD），精通招聘全流程、人才盘点、薪酬谈判及劳动法规。你的名字叫“SuperResume助手”。

### 你的特点：
- **专业**：回答基于现代人力资源管理理论与最佳实践。
- **实用**：提供可落地的建议，而非空洞的理论。
- **亲切**：语气专业但亲和，乐于助人。

### 当前上下文：
{{context}}

### 用户问题：
{{query}}

请直接回答用户问题。`
  },
  {
    key: 'job_jd_optimize',
    name: 'JD优化润色',
    category: 'job',
    variables: ['originalJd'],
    description: '优化职位描述，使其更专业、更具吸引力',
    content: `请将以下职位描述（JD）进行专业化润色与优化。

### 原始JD：
"""
{{originalJd}}
"""

### 优化目标：
1. **结构清晰**：分为岗位职责、任职要求、加分项、福利待遇。
2. **语言专业**：使用行业标准术语，动词准确。
3. **吸引力**：突出职位亮点和发展前景。
4. **格式规范**：适合在招聘平台发布。

### 输出：
请直接输出优化后的 JD 文本。`
  },
  {
    key: 'job_jd_generate',
    name: 'JD结构化生成',
    category: 'job',
    variables: ['jobTitle', 'requirements', 'company', 'level'],
    description: '根据简要需求生成完整JD',
    content: `请根据以下信息生成一份标准的职位描述（JD）。

- **职位名称**：{{jobTitle}}
- **公司/行业**：{{company}}
- **核心要求**：{{requirements}}
- **职级**：{{level}}

### 输出要求（严格 JSON）：
{
  "title": "...",
  "overview": "...",
  "responsibilities": ["...", "..."],
  "requirements": ["...", "..."],
  "benefits": ["...", "..."]
}`
  },
  {
    key: 'job_jd_summarize',
    name: 'JD要点归纳',
    category: 'job',
    variables: ['jdText'],
    description: '提取JD核心要素',
    content: `请分析以下JD，提取关键信息。

### JD内容：
"""
{{jdText}}
"""

### 输出要求（严格 JSON）：
{
  "summary": "...",
  "key_skills": ["..."],
  "years_experience": "...",
  "degree": "..."
}`
  },
  {
    key: 'resume_structuring',
    name: '简历结构化抽取',
    category: 'analysis',
    variables: ['resumeText'],
    description: '从文本中抽取结构化简历字段',
    content: `你是一位全球顶尖的招聘运营专家与信息抽取工程师。请从以下简历文本中抽取结构化信息，用于后续筛选与分析。

### 抽取规则（必须遵守）：
1) 只抽取文本中明确出现的信息；不确定的字段留空字符串 "" 或空数组 []，禁止编造。
2) 尽量做归一化：姓名去空格；邮箱小写；电话仅保留数字与+；时间区间统一为 "YYYY.MM-YYYY.MM" 或 "YYYY-YYYY"；在职可用 "YYYY.MM-至今"。
3) 列表字段必须去重并保持可读顺序；描述字段用简洁中文或原文要点。
4) 若简历包含多段/多职位/多项目，必须完整提取；优先保留“可量化产出/影响范围/技术栈/职责边界”。

### 简历文本：
"""
{{resumeText}}
"""

### 输出要求（严格 JSON）：只输出 JSON，不带代码块、不带解释文字。
{
  "name": "",
  "email": "",
  "phone": "",
  "basic_info": {
    "gender": "",
    "age": "",
    "location": "",
    "job_title": "",
    "years_experience": "",
    "highest_education": "",
    "links": {
      "linkedin": "",
      "github": "",
      "website": ""
    }
  },
  "skills": [],
  "certifications": [],
  "languages": [],
  "education": [
    { "school": "", "degree": "", "major": "", "period": "", "highlights": "" }
  ],
  "work_experience": [
    { "company": "", "title": "", "period": "", "location": "", "responsibilities": "", "achievements": "", "tech_stack": [] }
  ],
  "projects": [
    { "name": "", "role": "", "period": "", "description": "", "contribution": "", "tech_stack": [], "results": "" }
  ]
}`
  },
  {
    key: 'recruitment_forecast',
    name: '招聘趋势预测',
    category: 'analysis',
    variables: ['dataJson'],
    description: '基于历史数据预测招聘趋势',
    content: `你是一位全球顶尖的人力资源数据科学家（HR Data Scientist），熟悉招聘漏斗、供需、转化率、时间效率、成本与质量指标。请基于提供的数据进行预测与诊断，结论必须可落地、可追踪、可解释。

数据内容（JSON）：
"""
{{dataJson}}
"""

### 输出维度（必须按以下 4 个维度输出，且字段名固定）：
1) 招聘趋势预测（trend_analysis）
2) 漏斗健康度（pipeline_health）
3) 潜在瓶颈（potential_bottlenecks）
4) 改进建议（suggestions）

### 重要约束：
- 只基于输入数据推断；缺失的数据请明确写出“缺失项是什么、会造成什么偏差、建议补采什么指标”。
- 优先使用可量化表达（转化率、平均耗时、阶段堆积、offer接受率等）；无法量化时给出合理区间/方向性说明。
- 语言专业但通俗：所有术语首次出现都用一句话解释。

请输出严格的JSON格式报告（字段名必须一致）：
{
  "trend_analysis": "对招聘趋势的详细文字描述（包含趋势方向、原因解释、可能风险与置信说明）",
  "pipeline_health": "对招聘漏斗健康度的评估（指出最弱环节与原因）",
  "potential_bottlenecks": ["瓶颈点1", "瓶颈点2"],
  "suggestions": ["改进建议1（动作-负责人-周期-预期指标）", "改进建议2（动作-负责人-周期-预期指标）"]
}

注意：直接返回 JSON 对象本身，确保它可以被 JSON.parse() 直接解析。`
  },
  {
    key: 'resume_supplement_report',
    name: '补充深度报告',
    category: 'analysis',
    variables: ['resumeText', 'targetJobSection'],
    description: '针对特定维度的补充分析',
    content: `你是一位全球顶尖的人才评估顾问。请基于简历内容，补充生成一份“更全面、更专业、更通俗易懂”的深度报告，用于在结果页展示；报告应足够支撑面试与录用决策。

### 约束：
1. 只基于简历事实推断；不确定之处写清楚“需面试核实”。
2. 禁止提供任何简历格式/排版/措辞类建议。
3. 输出严格 JSON（直接输出 JSON 对象本身），不带任何多余文字或代码块。
4. 产出要“翔实”：strengths 至少 6 条；weaknesses 至少 6 条；suggestions 至少 6 条。

### 简历内容：
"""
{{resumeText}}
"""

{{targetJobSection}}

JSON 结构如下（请填充丰富内容）：
{
  "summary": "用中文分段输出：\\n【候选人画像】能力边界/擅长领域/适配场景（通俗可读）\\n【关键亮点】（5-10条证据摘要）\\n【关键风险】（5-10条，含影响与验证方式）\\n【面试路线】（从易到难的追问顺序，含目的）\\n【入职验证】（30/60/90天目标建议，量化/可观察）",
  "strengths": [
    "【优势关键词】优势描述 + 证据 + 对业务/团队的价值",
    "..."
  ],
  "weaknesses": [
    "【风险关键词】风险描述 + 证据/缺失信息 + 影响 + 验证问题",
    "..."
  ],
  "suggestions": [
    "【建议】面试重点/入职验证目标/成长路径（必须具体可执行）",
    "..."
  ],
  "hiring_advice": "用中文分段输出：\\n【录用建议】强烈推荐/推荐/谨慎考察/不推荐（写清理由与证据）\\n【建议定位】初/中/高/专家（判断依据）\\n【面试重点】8-12条必须追问（目的+验证点）\\n【风险控制】试用期关注点（3-5条可量化）"
}`
  }
];

async function run() {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    for (const tpl of templates) {
      const [record, created] = await PromptTemplate.findOrCreate({
        where: { key: tpl.key },
        defaults: tpl
      });

      if (!created) {
        await record.update(tpl);
        console.log(`Updated: ${tpl.key}`);
      } else {
        console.log(`Created: ${tpl.key}`);
      }
    }
    
    console.log('All prompts updated successfully.');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await sequelize.close();
  }
}

run();
