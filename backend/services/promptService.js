const { PromptTemplate } = require('../models');
const logger = require('../utils/logger');

// Default prompt templates (Simplified according to user requirements)
const DEFAULT_TEMPLATES = {
  // 1. 人才库-快速打分/批量筛选
  resume_quick_score: {
    name: '简历快速打分',
    category: 'job',
    variables: ['resumeText', 'jobDescriptionSection'],
    content: `你是一位具有20年猎头经验的【资深顾问】。请基于以下简历内容进行极速且专业的评估。
如果提供了目标职位描述（JD），请计算【100分制人岗匹配度】。
如果未提供JD，请基于简历本身的人才质量（职业稳定性、名企名校背景、技术栈深度、项目产出价值）计算【100分制人才综合价值评分】。

### 评估原则：
1. **见微知著**：从工作年限与职级晋升的速度判断其潜力。
2. **脱水评估**：剔除简历中的水分，识别真正的核心贡献而非仅仅是“参与”。
3. **风险前置**：重点识别频繁跳槽、职业断档、技能降级等负面信号。
4. **决策分级**：分数必须具有区分度（85+ 极佳，70-85 良好，60-70 一般，<60 淘汰）。

### 简历内容：
"""
{{resumeText}}
"""

{{jobDescriptionSection}}

### 输出要求：
必须输出严格的JSON格式，禁止包含任何Markdown代码块标记，禁止包含任何解释性文字。
JSON结构：
{
  "overall_score": 整数(0-100),
  "match_level": "极高匹配/高匹配/中等/一般/不匹配",
  "scores_percent": {
    "job_fit": 0-100,
    "experience_fit": 0-100,
    "learning_ability": 0-100,
    "teamwork": 0-100
  },
  "highlights": ["【亮点】关键词：简要描述证据", "【亮点】..."],
  "gaps": ["【风险】关键词：简要描述风险或缺失信息", "【风险】..."],
  "reason": "一句话核心评价（30字内）"
}`
  },

  // 2. 深度解析中的单个简历深度解析
  resume_deep_analysis: {
    name: '简历深度解析',
    category: 'analysis',
    variables: ['resumeText', 'targetJobSection'],
    content: `你是一位在全球500强企业拥有20年人才选拔经验的【首席人才官 (CHRO)】。你阅人无数，擅长从平凡的文字中洞察人才的底层逻辑、职业底色以及未来的爆发力。你的评估报告是 CEO 决定是否录用、以及如何定级定薪的关键依据。

### 核心任务：
请基于提供的简历内容，产出一份不少于 800 字、极具专业深度和洞察力的深度解析报告。

### 核心解析维度：
1. **人才底色与职业轨迹 (Career DNA)**：
   - 深度分析其职业发展的逻辑性：是稳扎稳打还是投机跳槽？
   - 识别其职业生涯中的“关键转折点”及背后的动机。
   - 评估其在不同平台（大厂 vs 创业公司）的适应性与切换成本。
2. **专业胜任力深度穿透 (Professional Depth)**：
   - 区分“经验”与“能力”：他是仅仅做了5年，还是拥有5年的深度积淀？
   - 识别其核心技术/业务护城河。
   - 使用 STAR 原则还原其简历中最具代表性的项目成果，并进行脱水评估。
3. **软性素质与组织适配 (Soft Power & Fit)**：
   - 评估其领导力潜质、抗压性、自驱力及沟通影响力。
   - 判断其是否符合 JD 中的文化价值观要求。
4. **潜力天花板与风险预警 (Potential & Risks)**：
   - 预测其未来 2-3 年在该岗位的产出预期。
   - 明确指出录用后的 3 个核心风险点及对应的背景调查（Ref Check）重点。

### 简历内容：
"""
{{resumeText}}
"""

{{targetJobSection}}

### 输出要求：
必须输出严格的JSON格式，禁止包含任何Markdown代码块标记，禁止包含任何解释性文字。报告字数必须充实，每个维度都要有详尽的事实支持和逻辑推导。

**关键约束（CRITICAL）：**
1. **维度完整性**：competency_matrix 必须包含且仅包含以下 6 个维度，名称必须完全一致：技能匹配、经验匹配、项目履历匹配、学历背景、发展潜力、团队协作。
2. **项目履历匹配 (CRITICAL)**：该维度用于评估候选人过往项目的规模、复杂度、所属行业与目标岗位的匹配程度。请务必根据简历中的项目经验进行评分。
3. **禁止零分**：除非简历中完全没有任何相关信息，否则所有维度的 score 必须在 40-100 之间。严禁输出 0 分。若信息不足请基于职场通用常识给出基础分（如：只要有学历就给教育背景 60+）。
4. **分值区分度**：评分应体现真实差距，不要给所有人打同样的分。

JSON结构：
{
  "overall_score": 整数(0-100),
  "hiring_advice": "【录用决策建议】（不少于 150 字）。必须以‘推荐等级：[A/B+/B/C/D]（[评价]）。’开头，随后详细阐述核心录用理由、职级建议、以及在组织中的定位建议。",
  "competency_matrix": [
    { "dimension": "技能匹配", "score": 0-100, "comment": "（不少于 80 字）深度解析其技能深度、广度及实战应用水平。" },
    { "dimension": "经验匹配", "score": 0-100, "comment": "（不少于 80 字）分析其过往项目与当前 JD 的底层映射关系。" },
    { "dimension": "项目履历匹配", "score": 0-100, "comment": "（不少于 80 字）分析其过往项目背景的量级、复杂度与目标职位的契合度。" },
    { "dimension": "学历背景", "score": 0-100, "comment": "（不少于 50 字）超越学历本身，看其学习力、专业含金量及持续成长性。" },
    { "dimension": "发展潜力", "score": 0-100, "comment": "（不少于 80 字）预测其职业天花板及在公司的晋升潜力。" },
    { "dimension": "团队协作", "score": 0-100, "comment": "（不少于 50 字）评估其协作风格、抗压能力及组织融合度。" }
  ],
  "penetration_report": {
    "career_trajectory": "【职业轨迹深度解析】（不少于 250 字）。分析其成长路径的合理性、每个阶段的增值点、以及职业选择背后的底层思维。",
    "potential_growth": "【未来产出预测】（不少于 150 字）。基于其过去表现，量化预测入职后前 6 个月的关键贡献点及长期天花板。",
    "management_guide": "【管理与激励建议】（不少于 150 字）。如果他入职，用人经理应该如何管理他？如何激发他的最高绩效？如何规避其已知短板？"
  },
  "detailed_qa": [
    {
      "question": "面试核心追问问题1",
      "intention": "考察意图：为了验证其在某项目中的真实贡献/某种软能力",
      "ideal_answer_signals": "理想回答应包含的关键词/事实点/逻辑模型"
    }
    // ...共 8-10 个深度追问
  ],
  "strengths": ["【亮点】关键词：详尽的证据描述", "【亮点】..."],
  "weaknesses": ["【风险】关键词：具体的疑点描述", "【风险】..."],
  "suggestions": ["【改进/培养建议】具体的动作描述", "【...】"],
  "summary": "【一句话核心总结】（30字内，一针见血）",
  "education": [{ "school": "", "degree": "", "major": "", "period": "", "is_top": "" }],
  "work_experience": [{ "company": "", "title": "", "period": "", "key_achievements": "" }],
  "projects": [{ "name": "", "role": "", "description": "", "performance": "" }]
}`
  },

  // 3. 简历对比解析
  resume_compare: {
    name: '简历对比解析',
    category: 'analysis',
    variables: ['resumesText', 'jobDescriptionSection'],
    content: `你是一位在全球500强企业拥有20年人才选拔经验的【首席人才官 (CHRO)】。请对多份简历进行横向对比分析。

### 核心任务：
对以下多份简历进行【多维度、深层次】的横向对比，产出一份深度对比报告。

### 候选人简历列表：
"""
{{resumesText}}
"""

{{jobDescriptionSection}}

### 核心分析指令（必须严格遵守）：
1. **完整性检查（CRITICAL）**：必须分析**每一位**输入的候选人。如果输入了 3 份简历，candidates 数组必须包含 3 个对象。严禁遗漏！
2. **深度对比**：不要只罗列经历，要对比“含金量”。分析谁的项目更复杂？谁的技术更前沿？谁的解决问题能力更强？
3. **差异化画像**：挖掘候选人的隐性差异（如：守成型 vs 开拓型，技术深度型 vs 业务广度型）。
4. **决策权衡**：明确给出“如果只能选一个，选谁”的建议，并说明放弃其他人的理由。
5. **评分区分度**：评分必须具有区分度，严禁给所有人打高分。

### 输出要求：
**必须输出严格的 JSON 格式**，禁止包含 Markdown 标记（如 \`\`\`json），禁止包含任何解释性文字。

JSON结构要求：
{
  "comparison_summary": "【总体评价】（300字+）。分析人才整体档次、竞争格局（如 A技术优 vs B业务强）及岗位胜任力分布。",
  "candidates": [
    {
      "candidate_label": "简历A/简历B/...",
      "file_name": "必须严格等于输入中该简历的文件名",
      "name": "候选人姓名",
      "overall_score": 整数(0-100),
      "match_level": "极高匹配/高匹配/中等/一般/不匹配",
      "scores_percent": {
        "skills": 0-100,
        "experience": 0-100,
        "project": 0-100,
        "education": 0-100,
        "potential": 0-100,
        "teamwork": 0-100
      },
      "highlights": ["【亮点】+ 事实证据", "【...】..."],
      "risks": ["【风险】+ 疑点描述", "【...】..."],
      "evaluation": "【能力分析】（200字+）。解析核心胜任力、潜在天花板及建议考察的3个重点问题。"
    }
  ],
  "recommendation": {
    "winner": "推荐候选人姓名",
    "reason": "【胜出理由】（200字+）。为何他是最优解？",
    "hiring_risk": "【录用风险】（100字+）。",
    "trade_off": "【放弃理由】（100字+）。为何放弃其他人？"
  }
}`
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

  // 5. 数据分析所需要的提示词模板
  recruitment_forecast: {
    name: '招聘趋势预测',
    category: 'analysis',
    variables: ['dataJson'],
    content: `你是一位全球顶尖的人力资源数据科学家（HR Data Scientist），熟悉招聘漏斗、供需、转化率、时间效率、成本与质量指标。请基于提供的数据进行预测与诊断，结论必须可落地、可追踪、可解释。

数据内容（JSON）：
"""
{{dataJson}}
"""

### 输出维度（必须按以下 4 个维度输出，且字段名固定）：
1) 招聘趋势预测（trend_analysis）：过去表现 + 未来趋势（量化方向+原因解释+置信说明）。要求：字数不少于 150 字，包含具体的预测方向。
2) 漏斗健康度（pipeline_health）：对“量、速、质、稳”进行诊断，指出最弱环节与原因。要求：字数不少于 100 字，必须是一个描述性的长字符串，不要返回 JSON 对象。
3) 潜在瓶颈（potential_bottlenecks）：列出最可能阻碍目标达成的关键瓶颈（3-8条）。
4) 改进建议（suggestions）：可执行方案（5-10条），尽量包含“动作-负责人-周期-预期改善指标”。

### 重要约束：
- 只基于输入数据推断；缺失的数据请明确写出“缺失项是什么、会造成什么偏差、建议补采什么指标”。
- 优先使用可量化表达（例如：转化率、平均耗时、阶段堆积、offer接受率等）；无法量化时给出合理区间/方向性说明。
- 语言专业但通俗：所有术语首次出现都用一句话解释。
- 必须确保 pipeline_health 字段是一个纯文本字符串。

请输出严格的JSON格式报告，结构如下（字段名必须一致）：
{
  "trend_analysis": "对招聘趋势的详细文字描述（不少于150字）",
  "pipeline_health": "对招聘漏斗健康度的详细文字评估（不少于100字，严禁返回对象）",
  "potential_bottlenecks": ["瓶颈点1", "瓶颈点2"],
  "suggestions": ["改进建议1", "改进建议2"]
}

要求：
1. 分析要基于数据事实。
2. 预测要具有前瞻性和可操作性。
3. 必须返回合法的JSON格式。`
  },

  // 6. 简历补充报告 (针对深度分析后的管理建议)
  resume_supplement_report: {
    name: '简历补充报告',
    category: 'analysis',
    variables: ['resumeText', 'targetJobSection'],
    content: `你是一位在全球500强企业拥有20年人才选拔与【组织发展 (OD) 专家】经验的资深顾问。你擅长通过简历挖掘候选人的“性格底色”、“职业成熟度”以及“在组织中的行为模式”，并能为用人经理提供极具实战意义的“人才管理说明书”。

### 核心任务：
请基于提供的简历内容与职位需求，产出一份极具专业深度和实战指导意义的“人才深度穿透与组织适配报告”。

### OD 专家视角要求：
1. **人才性格底色 (Persona Background)**：分析候选人的职业动机、决策风格（如：数据驱动 vs 直觉驱动）、以及在组织文化中的“融合阻力”或“催化作用”。
2. **组织适配与风险控制 (Organizational Fit)**：不仅仅看技能匹配，更要看其与当前团队氛围、管理风格的匹配度。识别其入职后可能出现的“排异反应”。
3. **管理与激励手册 (Management Manual)**：为用人经理提供一套量身定制的“说明书”。如何精准激励、如何建立信任、如何给予高压反馈、如何规避其已知短板。

### 输入：
- 简历原文："""{{resumeText}}"""
- 目标职位信息：{{targetJobSection}}

### 输出要求：
- 必须输出严格的JSON格式，禁止包含任何Markdown代码块标记，禁止包含任何解释性文字。
- 报告内容必须详尽翔实，严禁空洞的赞美或批评，必须有详实的事实支撑和深度的逻辑推导。
- **字数要求**：整份报告内容（JSON各字段文字总和）必须超过 1200 字。

JSON 结构：
{
  "hiring_advice": "【录用决策建议】（不少于 150 字）。必须以‘推荐等级：[A/B+/B/C/D]（[评价]）。’开头，随后详细阐述核心录用理由、职级建议、以及在组织中的定位建议。",
  "penetration_report": {
    "career_path_analysis": "【职业轨迹深度解析】（不少于 300 字）。分析其职业路径的连贯性、每一段经历的“价值含金量”、以及在关键节点选择背后的职业雄心与底层思维。",
    "competency_matrix": [
      { "dimension": "组织协同力", "score": 0-100, "comment": "（不少于 120 字）评价其在跨部门协作、资源整合及在复杂利益关系中的平衡能力。" },
      { "dimension": "抗压与韧性", "score": 0-100, "comment": "（不少于 120 字）分析其面对挫折、高压环境及不确定性时的情绪稳定性和反弹能力。" },
      { "dimension": "学习敏锐度", "score": 0-100, "comment": "（不少于 120 字）评价其在快速变化环境下的知识更新速度及将经验迁移到新场景的能力。" },
      { "dimension": "文化契合度", "score": 0-100, "comment": "（不少于 120 字）分析其价值观与公司文化的冲突点或契合点，预测其在组织中的存活率。" }
    ],
    "potential_forecast": "【人才潜力与天花板预测】（不少于 250 字）。预测其在公司内部的成长路径、可能的晋升节点、以及长期职业价值贡献曲线。",
    "management_manual": "【用人经理管理指南】（不少于 400 字）。包含：如何建立信任关系、核心心理需求、最有效的激励方式、如何给予有效反馈、以及入职前 100 天的关键带教动作。"
  },
  "detailed_qa": [
    { 
      "question": "管理层面试核心追问", 
      "intention": "考察意图：为了验证其在压力下的真实行为模式/领导力边界/核心价值观", 
      "ideal_answer_signals": "理想回答的关键逻辑、事实细节及应识别出的“红旗”信号" 
    }
    // ...共 5-8 个深度追问问题
  ]
}`
  },

  // 7. 模拟面试题生成
  interview_question_generation: {
    name: '模拟面试题生成',
    category: 'interview',
    variables: ['resumeText', 'jobDescriptionSection', 'questionCount'],
    content: `你是一位具有20年经验的资深资深技术面试官和人才评估专家。
    请基于以下【简历内容】和【目标岗位描述】，生成 {{questionCount}} 道具有深度、针对性和启发性的面试题。

    ### 核心目标：
    通过提问，全面评估候选人的【专业技能硬实力】、【项目实战深度】以及【与岗位的契合度】。

    ### 任务要求：
    1. **组合提问策略 (必做)**：
       - **基于岗位的提问 (约40%)**：针对 JD 中的核心技术栈、职责要求和业务场景进行提问。重点考察候选人是否具备胜任该岗位所需的“即战力”。
       - **基于简历项目的提问 (约60%)**：深入挖掘简历中提到的项目。不要只问表面，要针对项目中的技术选型原因、遇到的最难问题、如何解决的、以及最终量化的产出进行追问。重点考察项目真实性和思维深度。
    2. **针对性**：严禁使用通用题库。每一道题都必须能在提供的简历或 JD 中找到对应的关联点。
    3. **层次感**：题目应包含从基础原理到复杂架构设计，再到软素质（如抗压、沟通）的不同梯度。
    4. **分类要求**：将题目分为以下类别：
       - PROJECT (项目深挖)
       - TECHNICAL_CORE (核心技术栈)
       - ARCHITECTURE (架构设计)
       - SOFT_SKILLS (综合素质)
       - SCENARIO (情景模拟)

    ### 简历内容：
    """
    {{resumeText}}
    """

    {{jobDescriptionSection}}

    ### 输出要求：
    必须输出严格的JSON格式（不带Markdown代码块，不带多余文字），包含以下结构：
    {
      "questions": [
        {
          "questionIndex": 1,
          "question": "题目内容",
          "type": "CATEGORY_NAME",
          "category": "分类中文名称"
        }
      ]
    }
    `
  },
  
  // 8. 面试回答评估
  interview_answer_evaluation: {
    name: '面试回答评估',
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
  },

  // 9. JD优化润色
  job_jd_optimize: {
    name: 'JD优化润色',
    category: 'job',
    variables: ['originalJd'],
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

  // 10. JD结构化生成
  job_jd_generate: {
    name: 'JD结构化生成',
    category: 'job',
    variables: ['jobTitle', 'requirements', 'company', 'level'],
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

  // 11. JD要点归纳
  job_jd_summarize: {
    name: 'JD要点归纳',
    category: 'job',
    variables: ['jdText'],
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

  // 12. 简历结构化抽取
  resume_structuring: {
    name: '简历结构化抽取',
    category: 'analysis',
    variables: ['resumeText'],
    content: `你是一位全球顶尖的招聘运营专家与深度信息抽取工程师。你的任务是从简历文本中精准提取候选人的结构化信息。

### 核心抽取目标（极其重要）：
1. **姓名 (Name)**：
   - 候选人姓名通常出现在简历的最顶部或显眼位置。
   - 排除公司名、项目名、标题（如“简历”、“个人简介”）。
   - 如果发现“姓名：XXX”，则 XXX 为准。
2. **联系方式 (Contact)**：
   - **手机号 (Phone)**：识别各种格式（如 138-xxxx-xxxx, +86 138..., 138xxxxxxxx）。仅保留数字和开头的+号。
   - **邮箱 (Email)**：识别标准邮箱格式，确保完整且小写。
3. **基本信息 (Basic Info)**：
   - 性别、年龄、当前所在地、当前职位、工作年限、最高学历。

### 抽取规则：
1) **严禁编造**：只抽取文本中明确出现的信息；若某项缺失，留空字符串 "" 或空数组 []。
2) **格式规范**：
   - 姓名：去除所有空格。
   - 邮箱：小写。
   - 电话：仅保留数字与+。
   - 时间区间：统一为 "YYYY.MM-YYYY.MM" 或 "YYYY-YYYY"；在职可用 "YYYY.MM-至今"。
3) **列表字段**：去重并按时间倒序（最近的在前）。
4) **内容精炼**：描述字段使用简洁中文或原文要点，保留核心技术栈和量化成果。

### 简历文本：
"""
{{resumeText}}
"""

### 输出要求（严格 JSON）：只输出 JSON，不带代码块，不带解释文字。
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
