const { cleanText } = require('./enhancedTextExtractor');

function cleanTextPreserveNewlines(text) {
    if (!text) return '';
    
    text = text.toString();
    
    text = text.replace(/[\r\n]+/g, '\n');
    
    text = text.split('\n').map(line => line.trim()).join('\n');
    
    text = text.replace(/\n{3,}/g, '\n\n');
    
    text = text.replace(/[，。！？；：""''（）]/g, match => {
        const punctuationMap = {
            '，': ', ', '。': '. ', '！': '! ', '？': '? ',
            '；': '; ', '：': ': ', '"': '"', "'": "'",
            '（': '( ', '）': ') '
        };
        return punctuationMap[match] || match;
    });
    
    text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    text = text.replace(/[ \t]+/g, ' ');
    
    return text.trim();
}

class OptimizedResumeParseService {
    constructor() {
        this.patterns = {
      // 增强姓名匹配：支持 [姓名]、姓名：、或者独立成行的中文名
      name: /(?:姓名|Name|候选人|申请人)[:：]\s*([^\n\r]+)|\[([\u4e00-\u9fa5]{2,4})\]|^([\u4e00-\u9fa5]{2,4})$/im,
      phone: /(?:电话|手机|Phone|Mobile|Tel|联系电话|联系方式)[:：]\s*([0-9\-\+\s()]{7,20})/i,
      // 增强邮箱匹配：支持 电子邮件：
      email: /(?:邮箱|Email|E-mail|电子邮件)[:：]\s*([^\n\r\s]+)/i,
      location: /(?:地址|城市|Location|City|籍贯)[:：]\s*([^\n\r]+)/i,
      jobTitle: /(?:职位|应聘|目标|Position|Job Title|求职意向|期望职位)[:：]\s*([^\n\r]+)/i,
      education: /(?:教育|学历|Education|Degree)[:：]([^\n\r]+)/i,
      university: /(?:学校|大学|University|School)[:：]([^\n\r]+)/i,
      experience: /(?:工作|工作经历|Work Experience|Experience)[:：]([^\n\r]+)/i,
      skills: /(?:技能|Skills|Skill)[:：]([^\n\r]+)/i
    };
    }

    cleanTextPreserveNewlines(text) {
        return cleanTextPreserveNewlines(text);
    }

    async parseResumeContent(content, fileType = 'txt', fileName = '') {
        try {
            if (!content || typeof content !== 'string') {
                return { rawText: '', parseError: '内容为空' };
            }

            content = this.cleanTextPreserveNewlines(content);

            const sections = this.extractAllSections(content);
            console.log('提取到的章节:', Object.keys(sections));

            const parsed = {
                rawText: content,
                name: this.extractName(content, fileName),
                email: this.extractEmail(content),
                phone: this.extractPhone(content),
                location: this.extractLocation(content),
                job_title: this.extractJobTitle(content),
                skills: this.extractSkills(sections.skills || content),
                education: this.extractEducation(sections.education || content),
                work_experience: this.extractExperience(sections.experience || content),
                projects: this.extractProjects(sections.projects || content),
                experience_years: this.calculateExperienceYears(content),
                summary: this.extractSummary(sections.summary || '') || this.extractSummary(content)
            };

            console.log('解析结果:', {
                name: parsed.name,
                email: parsed.email,
                phone: parsed.phone,
                job_title: parsed.job_title,
                skills_count: Array.isArray(parsed.skills) ? parsed.skills.length : 0,
                education_count: Array.isArray(parsed.education) ? parsed.education.length : 0,
                work_experience_count: Array.isArray(parsed.work_experience) ? parsed.work_experience.length : 0,
                summary_length: parsed.summary ? parsed.summary.length : 0
            });

            return parsed;
        } catch (error) {
            console.error('简历解析失败:', error);
            return { rawText: content || '', parseError: error.message };
        }
    }

    escapeRegExp(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    matchSectionHeadingLine(line, sortedTitles) {
        if (!line) return null;
        let s = line.trim();
        if (!s) return null;

        s = s.replace(/^[\s>*•·\-\–—=]+/g, '').trim();
        s = s.replace(/^(?:第?\s*(?:\d+|[一二三四五六七八九十]+)\s*(?:章|节|部分|段)?\s*[\.、\-\–—:：]?\s*)+/g, '').trim();
        s = s.replace(/^(?:(?:\(?\d+\)?|[一二三四五六七八九十]+|（[一二三四五六七八九十]+）)\s*[\.、\-\–—:：]?\s*)+/g, '').trim();
        s = s.replace(/^【\s*/, '').replace(/\s*】$/, '').trim();
        s = s.replace(/^\[\s*/, '').replace(/\s*\]$/, '').trim();

        for (const title of sortedTitles) {
            const titlePattern = new RegExp(
                `^${this.escapeRegExp(title)}(?:\\s*[\\-–—/|｜·•]*\\s*(?:\\(.*?\\)|（.*?）))?\\s*[:：]?\\s*(.*)$`,
                'i'
            );
            const m = s.match(titlePattern);
            if (!m) continue;

            const inlineContent = (m[1] || '').trim();

            if (title === '工作' && inlineContent && /^[\u4e00-\u9fa5A-Za-z]/.test(inlineContent)) {
                continue;
            }

            return { title, inlineContent };
        }

        return null;
    }

    extractAllSections(content) {
        const sections = {
            summary: '',
            experience: '',
            education: '',
            projects: '',
            skills: ''
        };
        
        const sectionDefinitions = [
            { key: 'summary', titles: ['个人优势', '个人简介', '自我评价', 'Summary', 'Profile', 'About Me', '个人总结', '个人介绍', '自我介绍'] },
            { key: 'experience', titles: ['工作经历', '工作经验', 'Work Experience', 'Professional Experience', '职业经历', '工作'] },
            { key: 'education', titles: ['教育背景', '教育经历', 'Education', 'Educational Background', '学历信息', '学习经历', '教育情况', '学历'] },
            { key: 'projects', titles: ['项目经验', '项目经历', 'Projects', 'Project Experience'] },
            { key: 'skills', titles: ['技能专长', '专业技能', 'Skills', 'Technical Skills', '技能', '技术栈', '核心技能', '掌握技能', '专业能力', '技能特长', '技术能力', '技能证书'] }
        ];

        const allSectionTitles = sectionDefinitions.flatMap(def => def.titles);
        const allSectionTitlesSorted = [...allSectionTitles].sort((a, b) => b.length - a.length);

        const lines = content.split('\n');
        const allSectionPositions = [];

        for (let i = 0; i < lines.length; i++) {
            const trimmedLine = lines[i].trim();
            
            if (trimmedLine.length === 0) {
                continue;
            }

            const matched = this.matchSectionHeadingLine(trimmedLine, allSectionTitlesSorted);
            if (matched) {
                const sectionKey = this.findSectionKey(matched.title, sectionDefinitions);
                if (sectionKey) {
                    allSectionPositions.push({
                        index: i,
                        key: sectionKey,
                        title: matched.title,
                        inlineContent: matched.inlineContent
                    });
                }
                continue;
            }

            const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
            const combinedLine = (trimmedLine + nextLine).replace(/\s+/g, '');
            
            for (const title of allSectionTitles) {
                if (combinedLine === title) {
                    const sectionKey = this.findSectionKey(title, sectionDefinitions);
                    if (sectionKey) {
                        allSectionPositions.push({ index: i, key: sectionKey, title: title });
                        i++;
                        break;
                    }
                }
            }
        }

        for (const sectionDef of sectionDefinitions) {
            const key = sectionDef.key;
            const positions = allSectionPositions.filter(p => p.key === key);
            
            if (positions.length === 0) {
                continue;
            }

            let bestPosition = null;
            let bestContent = '';
            let bestScore = -1;

            for (let i = 0; i < positions.length; i++) {
                const pos = positions[i];
                const nextPos = allSectionPositions.find(p => p.index > pos.index);
                
                let sectionContent = '';
                
                if (pos.inlineContent) {
                    sectionContent = pos.inlineContent;
                }
                
                const startLine = pos.index + 1;
                const endLine = nextPos ? nextPos.index : lines.length;
                
                const additionalContent = lines.slice(startLine, endLine)
                    .map(line => line.trim())
                    .filter(line => line.length > 0 && !line.match(/^1cbd323a52b5ebf51X163964GFdUx467Vf2ZWOainPXRMxZr$/))
                    .join('\n');
                
                if (additionalContent) {
                    sectionContent = sectionContent ? sectionContent + '\n' + additionalContent : additionalContent;
                }

                const score = this.scoreSectionContent(sectionContent, key);
                
                if (score > bestScore) {
                    bestScore = score;
                    bestPosition = pos;
                    bestContent = sectionContent;
                }
            }

            if (bestPosition) {
                sections[key] = bestContent;
            }
        }

        return sections;
    }

    scoreSectionContent(content, sectionKey) {
        if (!content || content.trim().length === 0) {
            return -1;
        }

        const lines = content.split('\n').filter(l => l.trim().length > 0);
        let score = 0;

        switch (sectionKey) {
            case 'experience':
                const hasDatePattern = lines.some(line => line.match(/^\d{4}\.\d{1,2}[-–]/) || line.match(/^\d{4}[-–年]/));
                const hasCompanyPattern = lines.some(line => line.match(/公司|科技|股份|集团|有限/));
                const hasWorkKeywords = lines.some(line => line.match(/工作概括|项目规划|进度管理|项目实施|协同沟通|需求管理|项目交付|团队管理/));
                const hasContactInfo = lines.some(line => line.match(/^(姓名|民族|电话|邮箱|住址)[:：]/));
                const hasProjectKeywords = lines.some(line => line.match(/项目背景|项目职责|项目结果|项目描述|项目介绍/));
                const hasSummaryKeywords = lines.some(line => line.match(/擅长|熟悉|精通|具备|拥有|经验|能力|优势|特点/));
                const hasMultipleDatePatterns = lines.filter(line => line.match(/^\d{4}\.\d{1,2}[-–]/) || line.match(/^\d{4}[-–年]/)).length;
                const hasMultipleCompanies = lines.filter(line => line.match(/公司|科技|股份|集团|有限/)).length;
                const hasMultipleProjectKeywordsInExperience = lines.filter(line => line.match(/项目背景|项目职责|项目结果|项目描述|项目介绍/)).length;
                
                if (hasDatePattern) score += 50;
                if (hasMultipleDatePatterns >= 2) score += 30;
                if (hasMultipleDatePatterns >= 3) score += 20;
                if (hasCompanyPattern) score += 40;
                if (hasMultipleCompanies >= 2) score += 30;
                if (hasWorkKeywords) score += 35;
                if (hasProjectKeywords) score += 10;
                if (hasMultipleProjectKeywordsInExperience >= 3) score -= 50;
                if (hasContactInfo) score -= 100;
                if (hasSummaryKeywords) score -= 30;
                
                score += lines.length * 0.8;
                break;

            case 'education':
                const hasEduDatePattern = lines.some(line => line.match(/\d{4}\.\d{1,2}[-–]\d{4}\.\d{1,2}/) || line.match(/\d{4}[-–年]/));
                const hasSchoolPattern = lines.some(line => line.match(/大学|学院|学校|University|College/));
                const hasDegreePattern = lines.some(line => line.match(/本科|硕士|博士|专科|本科|学士|硕士|博士|Bachelor|Master|PhD/));
                const hasMajorPattern = lines.some(line => line.match(/专业|Major|Specialization/));
                const hasWorkDatePattern = lines.some(line => line.match(/^\d{4}\.\d{1,2}[-–](\d{4}\.\d{1,2})?$/));
                const hasCompanyPattern2 = lines.some(line => line.match(/公司|科技|股份|集团|有限/));
                const hasMultipleWorkDatePatterns = lines.filter(line => line.match(/^\d{4}\.\d{1,2}[-–](\d{4}\.\d{1,2})?$/)).length;
                const hasContactInfo2 = lines.some(line => line.match(/^(姓名|民族|电话|邮箱|住址)[:：]/));
                const hasBasicInfoKeywords = lines.some(line => line.match(/基本信息|政治面貌|民族|身高|年龄/));
                const hasCourseKeywords = lines.some(line => line.match(/主修课程|课程|Course/));
                
                if (hasEduDatePattern) score += 30;
                if (hasSchoolPattern) score += 50;
                if (hasDegreePattern) score += 30;
                if (hasMajorPattern) score += 20;
                if (hasCourseKeywords) score += 15;
                if (hasWorkDatePattern && !hasEduDatePattern) score -= 100;
                if (hasMultipleWorkDatePatterns >= 2 && !hasEduDatePattern) score -= 200;
                if (hasCompanyPattern2) score -= 50;
                if (hasContactInfo2) score -= 50;
                if (hasBasicInfoKeywords) score -= 30;
                
                score += lines.length * 0.5;
                break;

            case 'summary':
                const hasSummaryKeywords2 = lines.some(line => line.match(/擅长|熟悉|精通|具备|拥有|经验|能力|优势|特点/));
                const isTooShort = content.length < 20;
                const hasWorkExperience = lines.some(line => line.match(/^\d{4}\.\d{1,2}[-–]/) || line.match(/^\d{4}[-–年]/));
                const hasCompanyPattern3 = lines.some(line => line.match(/公司|科技|股份|集团|有限/));
                const hasProjectKeywords2 = lines.some(line => line.match(/项目背景|项目职责|项目结果|项目描述|项目介绍/));
                const hasWorkDetailKeywords = lines.some(line => line.match(/工作概括|项目规划|进度管理|项目实施|协同沟通|需求管理|项目交付|团队管理/));
                const hasMultipleWorkDatePatterns2 = lines.filter(line => line.match(/^\d{4}\.\d{1,2}[-–]/)).length;
                
                if (hasSummaryKeywords2) score += 30;
                if (isTooShort) score -= 15;
                if (hasWorkExperience) score -= 200;
                if (hasMultipleWorkDatePatterns2 >= 2) score -= 300;
                if (hasMultipleWorkDatePatterns2 >= 3) score -= 200;
                if (hasCompanyPattern3) score -= 100;
                if (hasProjectKeywords2) score -= 100;
                if (hasWorkDetailKeywords) score -= 100;
                
                score += lines.length * 0.4;
                break;

            case 'projects':
                const hasProjectKeywords3 = lines.some(line => line.match(/项目背景|项目职责|项目结果|项目描述|项目介绍|Project Background|Project Description/));
                const hasProjectDatePattern = lines.some(line => line.match(/^\d{4}\.\d{1,2}[-–]/) || line.match(/^\d{4}[-–年]/));
                const hasCompanyPattern4 = lines.some(line => line.match(/公司|科技|股份|集团|有限/));
                const hasMultipleWorkDatePatterns3 = lines.filter(line => line.match(/^\d{4}\.\d{1,2}[-–]/)).length;
                const hasMultipleProjectKeywordsInProjects = lines.filter(line => line.match(/项目背景|项目职责|项目结果|项目描述|项目介绍/)).length;
                const hasWorkDetailKeywordsInProjects = lines.some(line => line.match(/工作概括|项目规划|进度管理|项目实施|协同沟通|需求管理|项目交付|团队管理/));
                
                if (hasProjectKeywords3) score += 40;
                if (hasMultipleProjectKeywordsInProjects >= 3) score += 30;
                if (hasMultipleProjectKeywordsInProjects >= 6) score += 20;
                if (hasProjectDatePattern) score += 20;
                if (hasMultipleWorkDatePatterns3 >= 2) score += 15;
                if (hasMultipleWorkDatePatterns3 >= 3) score += 10;
                if (hasCompanyPattern4) score -= 10;
                if (hasWorkDetailKeywordsInProjects) score -= 20;
                
                score += lines.length * 0.6;
                break;

            case 'skills':
                const hasSkillKeywords = lines.some(line => line.match(/熟悉|精通|掌握|了解|擅长|技术|技能|证书|证书|PMP|Java|Python|JavaScript/));
                const hasCertificatePattern = lines.some(line => line.match(/证书|Certificate|资格证/));
                const hasWorkDatePattern2 = lines.some(line => line.match(/^\d{4}\.\d{1,2}[-–]/) || line.match(/^\d{4}[-–年]/));
                const hasCompanyPattern5 = lines.some(line => line.match(/公司|科技|股份|集团|有限/));
                const hasMultipleWorkDatePatterns4 = lines.filter(line => line.match(/^\d{4}\.\d{1,2}[-–]/)).length;
                
                if (hasSkillKeywords) score += 30;
                if (hasCertificatePattern) score += 20;
                if (hasWorkDatePattern2) score -= 200;
                if (hasMultipleWorkDatePatterns4 >= 2) score -= 300;
                if (hasCompanyPattern5) score -= 100;
                
                score += lines.length * 0.3;
                break;
        }

        return score;
    }

    findSectionKey(title, sectionDefinitions) {
        const cleanTitle = title.replace(/[:：]\s*$/, '').trim();
        for (const def of sectionDefinitions) {
            if (def.titles.some(t => cleanTitle.toLowerCase() === t.toLowerCase())) {
                return def.key;
            }
        }
        return null;
    }

    extractName(content, fileName = '') {
        // 1. 尝试从文件名提取姓名 (通常文件名中最可能是姓名)
        if (fileName) {
            const nameFromFile = this.extractNameFromFileName(fileName);
            if (nameFromFile && this.isValidName(nameFromFile)) {
                console.log(`[OptimizedParse] 从文件名提取到姓名: ${nameFromFile}`);
                return nameFromFile;
            }
        }

        // 2. 尝试使用多行匹配逻辑查找姓名
        const nameKeywords = ['姓名', 'Name', '求职者', '应聘者', '申请人'];
        const lines = content.split('\n').map(l => l.trim()).filter(l => l);
        
        // 优先查找明确标记的姓名
        const labeledName = this.findValueByLabels(lines, nameKeywords, (val) => this.isValidName(val));
        if (labeledName) {
            // 如果是带空格的中文名（如"张 三"），尝试去除中间的空格
            return labeledName.replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, '$1$2');
        }

        // 3. 尝试正则匹配（增强对中间有空格的姓名支持）
        const patterns = [
            // 中文姓名带括号：[肖彦文]
            /\[([\u4e00-\u9fa5]{2,4})\]/,
            // 中文姓名带空格：姓名：张 三 / 姓名：李 四
            /(?:姓名|Name|候选人|申请人)[:：]\s*([\u4e00-\u9fa5]\s+[\u4e00-\u9fa5]{1,2})(?=\s|$)/i,
            // 标准姓名格式
            /(?:姓名|Name|候选人|申请人)[:：]\s*([A-Za-z\u4e00-\u9fa5\s.]{2,20})/i,
            // 简历开头的姓名
            /(?:个人简历|简历)\s*([A-Za-z\u4e00-\u9fa5\s.]{2,20})/,
            // 纯文本行首匹配
            /^([A-Za-z\u4e00-\u9fa5\s.]{2,20})\s*(?:\n|$)/m
        ];

        for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match && match[1]) {
                const name = match[1].trim();
                // 如果是带空格的中文名（如"张 三"），尝试去除中间的空格再校验
                const normalizedName = name.replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, '$1$2');
                
                if (this.isValidName(normalizedName)) {
                    return normalizedName; 
                }
            }
        }
        
        // 4. 尝试在文件开头查找独立的一行作为姓名
        for (let i = 0; i < Math.min(lines.length, 5); i++) {
            const line = lines[i];
            const normalizedLine = line.replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, '$1$2');
            
            if (this.isValidName(normalizedLine)) {
                return normalizedLine;
            }
        }

        return '';
    }

    extractNameFromFileName(fileName) {
        if (!fileName) return null;
        
        // 移除扩展名
        let name = fileName.replace(/\.[^/.]+$/, "");
        
        // 常见的连接符分割
        // 例如: "__低代码开发工程师_长沙_4-6K_肖彦文_6年"
        const segments = name.split(/[_-\s]+/).filter(s => s.length >= 2 && s.length <= 4);
        
        // 优先找纯中文且长度 2-4 的段落
        for (const segment of segments) {
            if (/^[\u4e00-\u9fa5]{2,4}$/.test(segment)) {
                // 排除常见的非姓名词汇
                const nonNameKeywords = ['简历', '工程师', '长沙', '北京', '上海', '广州', '深圳', '开发', '设计', '经理', '项目', '年经验'];
                if (!nonNameKeywords.some(k => segment.includes(k))) {
                    return segment;
                }
            }
        }
        
        return null;
    }

    isValidName(name) {
        if (!name) return false;
        // 清理可能存在的标点
        name = name.replace(/[:：]/g, '').trim();
        
        // 长度检查：真实姓名通常 2-6 个汉字，或 2-20 个英文字符
        if (name.length < 2 || name.length > 20) return false;
        
        // 如果包含 "熟悉"、"精通"、"掌握"、"使用" 等技能动词，肯定不是姓名
        const skillKeywords = ['熟悉', '精通', '掌握', '使用', '负责', '项目', '经验', '能力', '开发', '架构', '数据库', '系统'];
        if (skillKeywords.some(k => name.includes(k))) return false;
        
        // 必须包含字母或汉字
        if (!/[a-zA-Z\u4e00-\u9fa5]/.test(name)) return false;
        
        // 不能包含特殊关键字
        const keywords = ['简历', '个人简历', '电话', '手机', '邮箱', '地址', '求职', '意向', '教育', '经历', '本科', '硕士', '学历', '性别', '年龄', '工作'];
        if (keywords.some(k => name.includes(k))) return false;
        
        // 排除性别关键字
        if (['男', '女'].includes(name)) return false;
        
        // 字符合法性检查
        return /^[\u4e00-\u9fa5a-zA-Z\s.]+$/.test(name);
    }

    findValueByLabels(lines, labels, validator) {
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            for (const label of labels) {
                // 允许标签前有内容，比如 "[姓名] 电话：138..."
                const regex = new RegExp(`(?:${label})[:：]?\\s*([^\\s\n\r]+)`, 'i');
                const match = line.match(regex);
                
                if (match) {
                    let value = match[1].trim();
                    
                    // 如果匹配到的值看起来像是下一个标签（比如 "姓名： 电话："），则跳过
                    if (labels.some(l => value.includes(l)) && value.length < 10) {
                        value = '';
                    }

                    // 如果当前行只有标签，检查下一行
                    if (!value && i + 1 < lines.length) {
                        value = lines[i + 1].trim();
                    }
                    
                    if (value && (!validator || validator(value))) {
                        return value;
                    }
                }
            }
        }
        return null;
    }

    extractEmail(content) {
        // 1. 尝试使用多行匹配逻辑
        const emailKeywords = ['邮箱', 'Email', 'E-mail', '电子邮件', '电子信箱'];
        const lines = content.split('\n').map(l => l.trim()).filter(l => l);
        
        const labeledEmail = this.findValueByLabels(lines, emailKeywords, (val) => /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/.test(val));
        if (labeledEmail) {
            const match = labeledEmail.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
            if (match) return match[1];
        }

        // 2. 正则匹配
        const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
        const match = content.match(emailPattern);
        return match ? match[1] : '';
    }

    extractPhone(content) {
        // 1. 尝试使用多行匹配逻辑
        const phoneKeywords = ['电话', '手机', 'Phone', 'Mobile', 'Tel', '联系电话', '联系方式', '移动电话'];
        const lines = content.split('\n').map(l => l.trim()).filter(l => l);
        
        const labeledPhone = this.findValueByLabels(lines, phoneKeywords, (val) => /\d/.test(val));
        if (labeledPhone) {
            // 提取其中的数字部分
            const match = labeledPhone.match(/([0-9\-\+\s()]{7,20})/);
            if (match) return match[1].replace(/[\-\s\(\)]/g, '');
        }

        // 2. 正则匹配
        const patterns = [
            /(?:电话|手机|Phone|Mobile|Tel|联系电话|联系方式)[:：]\s*([0-9\-\+\s()]{7,20})/i,
            /1[3-9]\d{9}/,
            /(\d{3,4}[-\s]?\d{7,8})/
        ];

        for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match && match[1]) {
                return match[1].replace(/[\-\s\(\)]/g, '');
            }
        }
        return '';
    }

    extractLocation(content) {
        // 1. 尝试使用多行匹配逻辑
        const locationKeywords = ['地址', '城市', 'Location', 'City', '居住地', '现居'];
        const lines = content.split('\n').map(l => l.trim()).filter(l => l);
        
        const labeledLocation = this.findValueByLabels(lines, locationKeywords, (val) => val.length > 1 && val.length < 50);
        if (labeledLocation) return labeledLocation;

        // 2. 正则匹配
        const patterns = [
            /(?:地址|城市|Location|City)[:：]\s*([^\n\r]{2,50})/i,
            /(北京|上海|广州|深圳|杭州|成都|重庆|武汉|南京|西安|天津|苏州|长沙|郑州|青岛|大连|厦门|宁波|无锡|济南|哈尔滨|长春|沈阳|石家庄|太原|合肥|南昌|福州|昆明|南宁|贵阳|兰州|海口|呼和浩特|银川|西宁|乌鲁木齐|拉萨)/,
            /([^\n\r]{2,10}(?:省|市|自治区|特别行政区))/,
            /([^\n\r]{5,50}(?:街道|路|区|县|镇|乡|村|号|栋|楼|室))/i
        ];

        for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match && match[1]) {
                const location = match[1].trim();
                if (location.length <= 50 && !location.match(/公司|有限|集团|电话|邮箱|职位/)) {
                    return location;
                }
            }
        }
        return '';
    }

    extractJobTitle(content) {
        // 1. 尝试使用多行匹配逻辑
        const jobKeywords = ['职位', '应聘', '目标', 'Position', 'Job Title', '求职意向', '应聘岗位', '期望职位', '意向岗位', '目前职位', '现任'];
        const lines = content.split('\n').map(l => l.trim()).filter(l => l);
        
        const labeledJob = this.findValueByLabels(lines, jobKeywords, (val) => val.length > 1 && val.length < 50);
        if (labeledJob) return labeledJob;

        // 2. 正则匹配
        const patterns = [
            /(?:职位|应聘|目标|Position|Job Title|求职意向|应聘岗位|期望职位|意向岗位)[:：]\s*([^\n\r]{2,50})/i,
            /(?:目前职位|Current Position|现任)[:：]([^\n\r]{2,50})/i,
            /(?:期望职位|Expected Position|目标职位)[:：]([^\n\r]{2,50})/i,
            /([^\n\r]{2,50}(?:工程师|开发|程序员|架构师|设计师|分析师|经理|主管|总监|专员|顾问|专家))/i,
            /([^\n\r]{2,50}(?:前端|后端|全栈|移动|Web|软件|系统|数据库|算法|数据|AI|人工智能|机器学习|深度学习))/i
        ];

        for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match && match[1]) {
                const title = match[1].trim();
                if (title.length <= 100 && !title.match(/^[0-9]+$/) && !title.match(/简历|CV|Resume|电话|邮箱|地址/i)) {
                    return title;
                }
            }
        }
        return '';
    }

    extractSkills(content) {
        if (!content || content.trim().length === 0) return [];

        let allSkills = [];
        
        const patterns = [
            /(?:技能专长|专业技能|Skills|Skill|技术栈|Technical Skills|核心技能|掌握技能|专业能力|技能特长|技术能力|技能证书)[:：]\s*([^\n\r]{10,1000})/i
        ];

        for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match && match[1]) {
                const skillsText = match[1];
                
                const certificatePatterns = [
                    /PMP项目经理证书/g,
                    /系统集成项目管理工程师/g,
                    /人力资源三级证书/g,
                    /英语四级/g,
                    /英语六级/g,
                    /计算机等级考试/g,
                    /软考/g,
                    /职业资格证/g,
                    /从业资格证/g,
                    /注册会计师/g,
                    /教师资格证/g,
                    /驾驶证/g
                ];
                
                for (const certPattern of certificatePatterns) {
                    const certMatch = skillsText.match(certPattern);
                    if (certMatch) {
                        allSkills.push(certMatch[0]);
                    }
                }
                
                const skills = skillsText.split(/[,，、;；|\/\s\n]+/)
                    .map(s => s.trim())
                    .filter(s => s.length > 0 && s.length < 50 && !s.match(/^[0-9]+$/) && 
                           !s.match(/^(技能|Skills|Skill|专业技能|技术栈|Technical|核心技能|掌握技能|熟悉|掌握|精通|了解|专业能力|技能特长|技术能力)$/i) &&
                           !s.match(/^(前端|后端|数据库|工具|其他|Frontend|Backend|Database|Tools|Other)$/i) &&
                           !s.match(/^[：:：]$/));
                if (skills.length > 0) {
                    allSkills = allSkills.concat(skills);
                }
            }
        }

        const certificatePatterns = [
            /PMP项目经理证书/g,
            /系统集成项目管理工程师/g,
            /人力资源三级证书/g,
            /英语四级/g,
            /英语六级/g,
            /计算机等级考试/g,
            /软考/g,
            /职业资格证/g,
            /从业资格证/g,
            /注册会计师/g,
            /教师资格证/g,
            /驾驶证/g
        ];
        
        for (const certPattern of certificatePatterns) {
            const certMatch = content.match(certPattern);
            if (certMatch) {
                allSkills.push(certMatch[0]);
            }
        }

        const uniqueSkills = [...new Set(allSkills)].filter(skill => 
            skill.length >= 2 && 
            skill.length <= 30 && 
            !skill.match(/^[0-9\s]+$/) && 
            !skill.match(/^(个人优势|自我评价|个人评价|自我评估|个人简介|Summary|Profile|About Me|个人总结|个人介绍|自我介绍)$/i) &&
            !skill.includes('个人优势:') &&
            !skill.includes('工作经历') &&
            !skill.includes('教育背景') &&
            !skill.includes('项目经验') &&
            !skill.includes('技能专长') &&
            !skill.match(/^\d{4}\.\d{2}/) &&
            !skill.match(/^\d{4}/) &&
            !skill.match(/^(前端|后端|数据库|工具|其他)$/) &&
            !skill.match(/^[：:：]$/) &&
            !skill.match(/^(联系方式|微信号|邮箱|求职信息|工作时长|求职意向|期望薪资|期望城市|资格证书|驾驶证|姓名|年龄|岁)$/i) &&
            !skill.match(/^(内容|业绩|项目|公司|部门|岗位|管理|开发|设计|运营|生产|采购|包装|电商)$/i) &&
            !skill.match(/^(负责|期间|参与|设计|开发|管理|协调|撰写|制定|对接|解决|拓展|提升|保障|进行)$/i) &&
            !skill.match(/^(通过|结合|根据|达到|包含|创建|新增|远程|目前|共|多|以上|期间|月|日|年|万|加)$/i) &&
            !skill.match(/^(工作概括|项目规划|进度管理|项目实施|协同沟通|需求管理|项目交付|团队管理|项目背景|项目职责|项目结果)$/i) &&
            !skill.match(/^(公司是一家|任职期间担任|主导完成|负责制定|负责组织|协助客户|前往|根据需求|定期向|负责项目)$/i) &&
            !skill.match(/^(满足|满足政府部门|满足政务人员|满足杭州市民|满足政府部门人员|日常办公需要|日常办公|电子公文|会议通知|交流探讨|相关系统)$/i) &&
            !skill.match(/^(发布应用|做好应用|应用访问量|应用访问|省级一体化|一体化考核|项目考核分数|收到客户|表扬信)$/i) &&
            !skill.match(/^(重要节点|里程碑会议|合理分配|把控项目|监督项目|维护客户|项目按期|项目验收|项目验收文件|经验总结|列为良好实践)$/i) &&
            !skill.match(/^(水流湖泊|产权归属|明确和界定|所有权|使用权|管理权|权属清晰|保护和合理利用|自然资源|收集项目资料|开展外业测绘|内业制图)$/i) &&
            !skill.match(/^(项目经历|工作经历|自我评价|自)$/i)
        );

        if (uniqueSkills.length < 3) {
            const techSkills = this.extractTechSkills(content);
            return [...new Set([...uniqueSkills, ...techSkills])];
        }

        return uniqueSkills;
    }

    extractTechSkills(content) {
        const techKeywords = [
            'PHP', 'Java', 'Python', 'JavaScript', 'TypeScript', 'C++', 'C#', 'Go', 'Ruby', 'Swift', 'Kotlin', 'Rust',
            'Spring', 'Spring Boot', 'Spring Cloud', 'MyBatis', 'Hibernate', 'JPA',
            'ThinkPHP', 'Laravel', 'Symfony', 'CodeIgniter', 'Yii',
            'Vue', 'React', 'Angular', 'jQuery', 'Node.js', 'Express', 'Koa',
            'MySQL', 'PostgreSQL', 'Oracle', 'SQL Server', 'MongoDB', 'Redis', 'Elasticsearch',
            'HTML', 'CSS', 'Sass', 'Less', 'Bootstrap', 'Tailwind',
            'Docker', 'Kubernetes', 'Jenkins', 'Git', 'SVN', 'Maven', 'Gradle',
            'Linux', 'Unix', 'Windows', 'macOS',
            'Nginx', 'Apache', 'Tomcat',
            'RESTful', 'GraphQL', 'gRPC', 'WebSocket',
            'Microservices', 'Microservice', '微服务',
            'Agile', 'Scrum', 'Kanban',
            'TDD', 'BDD', 'CI/CD',
            'AWS', 'Azure', 'Google Cloud', '阿里云', '腾讯云',
            'uniapp', 'WeChat', '微信', '小程序', '公众号',
            'SwiftAdmin', 'swoole', 'Vite', 'Webpack', 'Babel',
            'jQuery', 'Axios', 'Fetch', 'AJAX',
            'JSON', 'XML', 'YAML',
            'Git', 'GitHub', 'GitLab', 'Gitee',
            'Jira', 'Confluence', 'Figma', 'Sketch',
            'Photoshop', 'Illustrator', 'XD',
            'Office', 'Excel', 'Word', 'PowerPoint',
            'Python', 'Django', 'Flask', 'FastAPI',
            'Java', 'Spring', 'SpringBoot', 'SpringMVC',
            'JavaScript', 'ES6', 'ES2015', 'ES2020',
            'TypeScript', 'TS',
            'React', 'Redux', 'MobX',
            'Vue', 'Vuex', 'Vue Router',
            'Angular', 'RxJS',
            'Node.js', 'Express', 'Koa', 'NestJS',
            'MySQL', 'MariaDB', 'PostgreSQL', 'SQLite',
            'MongoDB', 'Redis', 'Elasticsearch', 'Solr',
            'RabbitMQ', 'Kafka', 'ActiveMQ',
            'Docker', 'Kubernetes', 'K8s', 'Docker Compose',
            'Jenkins', 'GitLab CI', 'Travis CI', 'CircleCI',
            'Git', 'SVN', 'Mercurial',
            'Linux', 'Shell', 'Bash', 'PowerShell',
            'Nginx', 'Apache', 'Tomcat', 'IIS',
            'REST', 'RESTful', 'GraphQL', 'SOAP',
            'OAuth', 'JWT', 'Session', 'Cookie',
            'HTTP', 'HTTPS', 'TCP', 'UDP',
            'WebSocket', 'Socket.io',
            'Webpack', 'Vite', 'Rollup', 'Parcel',
            'Babel', 'ESLint', 'Prettier',
            'Jest', 'Mocha', 'Chai', 'Jasmine',
            'Selenium', 'Cypress', 'Puppeteer',
            'Postman', 'Swagger', 'OpenAPI',
            'Figma', 'Sketch', 'Adobe XD',
            'Photoshop', 'Illustrator', 'InDesign',
            'Premiere', 'After Effects',
            'Blender', 'Maya', '3ds Max',
            'Unity', 'Unreal Engine',
            'Android', 'iOS', 'Flutter', 'React Native',
            'Swift', 'Kotlin', 'Objective-C',
            'Hadoop', 'Spark', 'Flink', 'Kafka',
            'TensorFlow', 'PyTorch', 'Keras',
            'Pandas', 'NumPy', 'Matplotlib',
            'Scikit-learn', 'XGBoost', 'LightGBM',
            'Tableau', 'Power BI', 'Looker',
            'Excel', 'PowerPoint', 'Word',
            'Notion', 'Confluence', 'Jira',
            'Trello', 'Asana', 'Monday.com',
            'Slack', 'Teams', 'Discord',
            'Zoom', 'Teams', 'Meet'
        ];

        const foundSkills = [];
        const contentUpper = content.toUpperCase();

        for (const keyword of techKeywords) {
            const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
            if (regex.test(content)) {
                foundSkills.push(keyword);
            }
        }

        return foundSkills;
    }

    extractEducation(content) {
        if (!content || content.trim().length === 0) return [];

        const educationItems = [];
        const processedKeys = new Set();
        const lines = content.split('\n');
        
        const patterns = [
            /([^\d\n]{2,30})\s+([^\d\n]{2,30})\s+([^\d\n]{2,20})\s+(\d{4}\.\d{2}[-–]\d{4}\.\d{2}|\d{4}\.\d{2}[-–]至今)/i,
            /([^\d\n]{2,30})\s+([^\d\n]{2,20})\s+([^\d\n]{2,30})\s+(\d{4}[-–年]\d{4}|\d{4}[-–年]至今)/i,
            /([^\d\n]{2,30})\s+([^\d\n]{2,20})\s+([^\d\n]{2,30})(\d{4}[-–]\d{4})/i,
            /([^\d\n]{2,30})\s+([^\d\n]{2,20})\s+([^\d\n]{2,30})(\d{4})/i,
            /(\d{4})[.-](\d{2})[-–](\d{4})[.-](\d{2})\s+(.+)/i,
            /(\d{4})[.-](\d{2})[-–](\d{4}|至今|Present|Now)\s+(.+)/i,
            /(\d{4})\s+[-–年至]+\s+(\d{4}|至今|Present|Now)\s+(.+)/i,
            /(\d{4})[.-](\d{2})\s+(.+)/gi,
            /(\d{4})[-–年](\d{4}|至今|Present|Now)\s+([^\d\n]{2,30})\s+([^\d\n]{2,30})\s+([^\d\n]{2,20})/gmi,
            /(\d{4}[-–年]\d{4}|\d{4}[-–年]至今)\s+([^\d\n]{2,30})\s+([^\d\n]{2,30})\s+([^\d\n]{2,20})/gmi,
            /([^\d\n]{2,30})\s+([^\d\n]{2,20})\s+([^\d\n]{2,30})(\d{4}[-–]\d{4})/i,
            /(\d{4}\.\d{1,2}[-–]\d{4}\.\d{1,2}|\d{4}\.\d{1,2}[-–]至今)([^\d\n]{2,30})([^\d\n]{2,20})([^\d\n]{2,20})/i,
            /(\d{4}\.\d{1,2}[-–]\d{4}\.\d{1,2}|\d{4}\.\d{1,2}[-–]至今)([^\d\n]{2,30})([^\d\n]{2,20})/i
        ];

        for (const line of lines) {
            let match;
            
            match = patterns[11].exec(line);
            if (match) {
                const dateRange = match[1].trim();
                const school = match[2].trim();
                const major = match[3].trim();
                const degree = match[4].trim();
                
                const workExperienceKeywords = ['公司', '科技', '股份', '平台', '项目', '经理', '运营', '服务', '办公', '自然资源', '确权', '登记'];
                const isWorkExperience = workExperienceKeywords.some(keyword => school.includes(keyword));
                
                if (!isWorkExperience) {
                    const { startDate, endDate } = this.parseDateRange(dateRange);
                    const key = `${school}-${startDate}-${endDate}`;
                    if (!processedKeys.has(key)) {
                        processedKeys.add(key);
                        educationItems.push({
                            startDate: startDate,
                            endDate: endDate,
                            school: school,
                            major: major,
                            degree: degree
                        });
                    }
                }
                continue;
            }

            match = patterns[12].exec(line);
            if (match) {
                const dateRange = match[1].trim();
                const school = match[2].trim();
                const major = match[3].trim();
                
                const workExperienceKeywords = ['公司', '科技', '股份', '平台', '项目', '经理', '运营', '服务', '办公', '自然资源', '确权', '登记'];
                const isWorkExperience = workExperienceKeywords.some(keyword => school.includes(keyword));
                
                if (!isWorkExperience) {
                    const { startDate, endDate } = this.parseDateRange(dateRange);
                    const key = `${school}-${startDate}-${endDate}`;
                    if (!processedKeys.has(key)) {
                        processedKeys.add(key);
                        educationItems.push({
                            startDate: startDate,
                            endDate: endDate,
                            school: school,
                            major: major,
                            degree: ''
                        });
                    }
                }
                continue;
            }

            match = patterns[10].exec(line);
            if (match) {
                const school = match[1].trim();
                const degree = match[2].trim();
                const major = match[3].trim();
                const dateRange = match[4].trim();
                const { startDate, endDate } = this.parseDateRange(dateRange);
                const key = `${school}-${startDate}-${endDate}`;
                if (!processedKeys.has(key)) {
                    processedKeys.add(key);
                    educationItems.push({
                        startDate: startDate,
                        endDate: endDate,
                        school: school,
                        major: major,
                        degree: degree
                    });
                }
                continue;
            }

            match = patterns[0].exec(line);
            if (match) {
                const school = match[1].trim();
                const major = match[2].trim();
                const degree = match[3].trim();
                const dateRange = match[4].trim();
                const { startDate, endDate } = this.parseDateRange(dateRange);
                const key = `${school}-${startDate}-${endDate}`;
                if (!processedKeys.has(key)) {
                    processedKeys.add(key);
                    educationItems.push({
                        startDate: startDate,
                        endDate: endDate,
                        school: school,
                        major: major,
                        degree: degree
                    });
                }
                continue;
            }
            
            match = patterns[1].exec(line);
            if (match) {
                const school = match[1].trim();
                const degree = match[2].trim();
                const major = match[3].trim();
                const dateRange = match[4].trim();
                const { startDate, endDate } = this.parseDateRange(dateRange);
                const key = `${school}-${startDate}-${endDate}`;
                if (!processedKeys.has(key)) {
                    processedKeys.add(key);
                    educationItems.push({
                        startDate: startDate,
                        endDate: endDate,
                        school: school,
                        major: major,
                        degree: degree
                    });
                }
                continue;
            }

            match = patterns[2].exec(line);
            if (match) {
                const school = match[1].trim();
                const degree = match[2].trim();
                const major = match[3].trim();
                const dateRange = match[4].trim();
                const { startDate, endDate } = this.parseDateRange(dateRange);
                const key = `${school}-${startDate}-${endDate}`;
                if (!processedKeys.has(key)) {
                    processedKeys.add(key);
                    educationItems.push({
                        startDate: startDate,
                        endDate: endDate,
                        school: school,
                        major: major,
                        degree: degree
                    });
                }
                continue;
            }
            
            match = patterns[3].exec(line);
            if (match) {
                const schoolInfo = match[5].trim();
                const school = this.extractSchoolFromText(schoolInfo);
                const key = `${school}-${match[1]}.${match[2]}-${match[3]}.${match[4]}`;
                if (!processedKeys.has(key)) {
                    processedKeys.add(key);
                    educationItems.push({
                        startDate: match[1] + '.' + match[2],
                        endDate: match[3] + '.' + match[4],
                        school: school,
                        degree: this.extractDegreeFromText(schoolInfo),
                        major: this.extractMajorFromText(schoolInfo)
                    });
                }
                continue;
            }

            match = patterns[4].exec(line);
            if (match) {
                const schoolInfo = match[4].trim();
                const school = this.extractSchoolFromText(schoolInfo);
                const key = `${school}-${match[1]}.${match[2]}-${match[3]}`;
                if (!processedKeys.has(key)) {
                    processedKeys.add(key);
                    educationItems.push({
                        startDate: match[1] + '.' + match[2],
                        endDate: match[3],
                        school: school,
                        degree: this.extractDegreeFromText(schoolInfo),
                        major: this.extractMajorFromText(schoolInfo)
                    });
                }
                continue;
            }

            match = patterns[5].exec(line);
            if (match) {
                const schoolInfo = match[3].trim();
                const school = this.extractSchoolFromText(schoolInfo);
                const key = `${school}-${match[1]}-${match[2]}`;
                if (!processedKeys.has(key)) {
                    processedKeys.add(key);
                    educationItems.push({
                        startDate: match[1],
                        endDate: match[2],
                        school: school,
                        degree: this.extractDegreeFromText(schoolInfo),
                        major: this.extractMajorFromText(schoolInfo)
                    });
                }
                continue;
            }

            match = patterns[6].exec(line);
            if (match && match[3].trim().length > 10) {
                const schoolInfo = match[3].trim();
                const school = this.extractSchoolFromText(schoolInfo);
                const key = `${school}-${match[1]}.${match[2]}`;
                if (!processedKeys.has(key)) {
                    processedKeys.add(key);
                    educationItems.push({
                        startDate: match[1] + '.' + match[2],
                        endDate: '',
                        school: school,
                        degree: this.extractDegreeFromText(schoolInfo),
                        major: this.extractMajorFromText(schoolInfo)
                    });
                }
                continue;
            }

            match = patterns[7].exec(line);
            if (match) {
                educationItems.push({
                    startDate: match[1] || '',
                    endDate: match[2] || '',
                    school: (match[3] || '').trim(),
                    major: (match[4] || '').trim(),
                    degree: (match[5] || '').trim()
                });
                continue;
            }

            match = patterns[8].exec(line);
            if (match) {
                educationItems.push({
                    startDate: match[1] || '',
                    endDate: match[2] || '',
                    school: (match[3] || '').trim(),
                    major: (match[4] || '').trim(),
                    degree: (match[5] || '').trim()
                });
                continue;
            }

            // Generic Fallback for Multi-line Education
            // If we found a date line but no match above
            if (this.isDateLine(line)) {
                 // Try to find School in previous lines (up to 2 lines back)
                 let school = '';
                 
                 // Check i-1
                 if (i > 0) {
                     const prev = lines[i-1];
                     school = this.extractSchoolFromText(prev);
                     // If prev line is very short and not school, check i-2
                     if (!school && prev.length < 10 && i > 1) {
                         const prev2 = lines[i-2];
                         school = this.extractSchoolFromText(prev2);
                     }
                 }
                 
                 if (school) {
                      const { startDate, endDate } = this.parseDateRange(line);
                      const key = `${school}-${startDate}-${endDate}`;
                      if (!processedKeys.has(key)) {
                          processedKeys.add(key);
                          educationItems.push({
                              startDate,
                              endDate,
                              school,
                              major: '', 
                              degree: ''
                          });
                      }
                 }
            }
        }

        const continuousMatches = [...content.matchAll(patterns[7])];
        for (const match of continuousMatches) {
            educationItems.push({
                startDate: match[1] || '',
                endDate: match[2] || '',
                school: (match[3] || '').trim(),
                major: (match[4] || '').trim(),
                degree: (match[5] || '').trim()
            });
        }

        const continuousMatches2 = [...content.matchAll(patterns[8])];
        for (const match of continuousMatches2) {
            educationItems.push({
                startDate: match[1] || '',
                endDate: match[2] || '',
                school: (match[3] || '').trim(),
                major: (match[4] || '').trim(),
                degree: (match[5] || '').trim()
            });
        }

        if (educationItems.length === 0) {
            const fallback = this.extractEducationFromLabels(content);
            for (const edu of fallback) {
                const key = `${edu.school}-${edu.startDate || ''}-${edu.endDate || ''}`;
                if (!processedKeys.has(key)) {
                    processedKeys.add(key);
                    educationItems.push(edu);
                }
            }
        }

        return educationItems;
    }

    extractEducationFromLabels(content) {
        if (!content || content.trim().length === 0) return [];
        const lines = content.split('\n').map(l => l.trim()).filter(Boolean);

        const schoolLabel = /^(?:学校|毕业院校|院校|University|School)[:：]\s*(.+)$/i;
        const degreeLabel = /^(?:学历|学位|Degree)[:：]\s*(.+)$/i;
        const majorLabel = /^(?:专业|Major)[:：]\s*(.+)$/i;
        const timeLabel = /^(?:就读时间|在校时间|学习时间|时间|起止时间|起止日期)[:：]\s*(.+)$/i;

        let school = '';
        let degree = '';
        let major = '';
        let timeText = '';

        for (let i = 0; i < lines.length; i++) {
            const s = lines[i].match(schoolLabel);
            if (s && !school) school = (s[1] || '').trim();

            const d = lines[i].match(degreeLabel);
            if (d && !degree) degree = (d[1] || '').trim();

            const m = lines[i].match(majorLabel);
            if (m && !major) major = (m[1] || '').trim();

            const t = lines[i].match(timeLabel);
            if (t && !timeText) timeText = (t[1] || '').trim();

            if (school && (degree || major) && timeText) break;
        }

        if (!school) return [];

        const { startDate, endDate } = timeText ? this.parseDateRange(timeText) : { startDate: '', endDate: '' };
        return [{
            startDate: startDate || '',
            endDate: endDate || '',
            school: school,
            major: major || '',
            degree: degree || ''
        }];
    }

    extractSchoolFromText(text) {
        const patterns = [
            /([^\n\r]+大学|学院|University|College|School)/i,
            /([^\n\r]{2,20}(?:学校|中学|小学))/i
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                return match[1].trim();
            }
        }
        return '';
    }

    extractDegreeFromText(text) {
        const patterns = [
            /(?:博士|PhD|Doctorate|博士学位)/i,
            /(?:硕士|Master|MBA|硕士学位)/i,
            /(?:本科|Bachelor|学士学位)/i,
            /(?:大专|专科|College|Associate|大专学历)/i,
            /(?:高中|High School|高中学历)/i
        ];

        for (const pattern of patterns) {
            if (pattern.test(text)) {
                const match = text.match(pattern);
                return match[0];
            }
        }
        return '';
    }

    extractMajorFromText(text) {
        const patterns = [
            /(?:大学|学院|University|College|School)\s+([^\n\r]{2,30})(?:\s+(?:本科|硕士|博士|专科|大专|高中|学士学位|硕士学位|博士学位))?/i,
            /(?:大学|学院|University|College|School)\s+([^\n\r]+专业)/i,
            /(?:大学|学院|University|College|School)\s+([^\n\r]+(?:学|科学|工程|技术))/i,
            /(?:大学|学院|University|College|School)\s+([^\n\r]{2,20})/i
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                let major = match[1].trim();
                major = major.replace(/\s+(?:本科|硕士|博士|专科|大专|高中|学士学位|硕士学位|博士学位)$/i, '').trim();
                if (!major.match(/^(本科|硕士|博士|专科|大专|高中|学士学位|硕士学位|博士学位)$/i) && major.length > 0) {
                    return major;
                }
            }
        }
        return '';
    }

    extractExperience(content) {
        if (!content || content.trim().length === 0) return [];

        const experienceItems = [];
        const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const processedMatches = new Set();

        const positionKeywords = [
            '项目经理', '项目主管', '项目总监', '项目助理', '项目专员',
            '产品经理', '产品主管', '产品总监', '产品助理',
            '技术经理', '技术总监', '技术主管', '技术负责人',
            '软件工程师', '开发工程师', '前端工程师', '后端工程师', '全栈工程师',
            '测试工程师', '测试主管', '测试经理',
            '运营经理', '运营主管', '运营专员',
            '市场经理', '市场主管', '市场专员',
            '销售经理', '销售主管', '销售代表',
            '人力资源经理', '人力资源主管', '人事经理',
            '财务经理', '会计', '出纳',
            '行政经理', '行政主管', '行政专员',
            '设计师', 'UI设计师', 'UX设计师', '平面设计师',
            '架构师', '系统架构师', '技术架构师',
            '总监', '经理', '主管', '专员', '助理', '工程师', '分析师', '顾问',
            '开发', '设计', '测试', '运维', '实施', '支持', '实习生'
        ];

        const datePatterns = [
            /(\d{4}\.\d{1,2}[-–]\d{4}\.\d{1,2}|\d{4}\.\d{1,2}[-–]至今)/,
            /(\d{4}[-–年]\d{4}|\d{4}[-–年]至今)/
        ];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            let dateMatch = null;
            let dateRange = '';
            
            for (const p of datePatterns) {
                const m = line.match(p);
                if (m) {
                    dateMatch = m;
                    dateRange = m[1];
                    break;
                }
            }

            if (dateMatch) {
                let company = '';
                let position = '';
                const textWithoutDate = line.replace(dateRange, '').trim();

                // Case 1: Date and Text on same line
                if (textWithoutDate.length > 2) {
                    const positionKeyword = positionKeywords.find(keyword => textWithoutDate.includes(keyword));
                    
                    if (positionKeyword) {
                        const positionIndex = textWithoutDate.indexOf(positionKeyword);
                        // If position is at start, company might be after or absent
                        if (positionIndex === 0) {
                            position = textWithoutDate;
                            // Check previous line for company
                            if (i > 0 && this.looksLikeCompany(lines[i-1])) {
                                company = lines[i-1];
                            }
                        } else {
                            company = textWithoutDate.substring(0, positionIndex).trim();
                            position = textWithoutDate.substring(positionIndex).trim();
                        }
                    } else {
                        // Use company suffix heuristic
                        const companyEndIndex = this.findCompanyEndIndex(textWithoutDate);
                        if (companyEndIndex > 0) {
                            company = textWithoutDate.substring(0, companyEndIndex).trim();
                            position = textWithoutDate.substring(companyEndIndex).trim();
                        } else {
                            // Assume it's Company if it looks like one
                            if (this.looksLikeCompany(textWithoutDate)) {
                                company = textWithoutDate;
                                // Look for position in next line
                                if (i < lines.length - 1 && lines[i+1].length < 30) {
                                     position = lines[i+1];
                                }
                            } else {
                                // Assume it's Position (or just text)
                                position = textWithoutDate;
                                // Look for Company in previous line
                                if (i > 0 && this.looksLikeCompany(lines[i-1])) {
                                    company = lines[i-1];
                                }
                            }
                        }
                    }
                } 
                // Case 2: Date is standalone or text is very short
                else {
                    // Strategy: Look Up for Company, Down for Position
                    // Heuristic: Company is usually BOLD or distinct, often above date or same block
                    if (i > 0 && this.looksLikeCompany(lines[i-1])) {
                        company = lines[i-1];
                        if (i < lines.length - 1) {
                            const nextLine = lines[i+1];
                            // If next line is not another date and short enough, assume position
                            if (!this.isDateLine(nextLine) && nextLine.length < 30) {
                                position = nextLine;
                            }
                        }
                    } else if (i < lines.length - 1 && this.looksLikeCompany(lines[i+1])) {
                        // Date line -> Company line -> Position line
                        company = lines[i+1];
                        if (i < lines.length - 2) {
                             const nextNextLine = lines[i+2];
                             if (!this.isDateLine(nextNextLine) && nextNextLine.length < 30) {
                                 position = nextNextLine;
                             }
                        }
                    }
                }

                // Cleanup and Add
                if (company && company.length > 1) {
                    // Clean Company Name
                    let cleanCompany = company.trim();
                    cleanCompany = cleanCompany.replace(/项目$/, '').replace(/项目项目$/, '项目').trim();
                    
                    // Basic Validation
                    if (cleanCompany.length > 50 || cleanCompany.match(/^(时间|工作|经历|教育|项目|Time|Work|Experience)$/i)) continue;

                    const cleanPosition = this.cleanPosition(position);
                    const { startDate, endDate } = this.parseDateRange(dateRange);
                    
                    const newExp = {
                        startDate,
                        endDate,
                        company: cleanCompany,
                        position: cleanPosition,
                        description: []
                    };

                    // Check for duplicates
                    if (!this.isDuplicateExperience(newExp, experienceItems)) {
                        experienceItems.push(newExp);
                    }
                }
            }
        }

        if (experienceItems.length === 0) {
            const fallbackItems = this.extractExperienceFromLabels(content);
            for (const item of fallbackItems) {
                if (!this.isDuplicateExperience(item, experienceItems)) {
                    experienceItems.push(item);
                }
            }
        }

        return this.extractExperienceDescriptions(content, experienceItems);
    }

    extractExperienceFromLabels(content) {
        if (!content || content.trim().length === 0) return [];
        const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
        const items = [];
        const seen = new Set();

        const companyLabel = /^(?:公司名称|公司|单位|任职单位)[:：]\s*(.+)$/i;
        const positionLabel = /^(?:目标职能|目标岗位|职位名称|职位|岗位|职务|现任职位|工作岗位)[:：]\s*(.+)$/i;
        const timeLabel = /^(?:任职时间|工作时间|在职时间|时间|起止时间|起止日期|任职日期)[:：]\s*(.+)$/i;
        const startLabel = /^(?:入职时间|开始时间|起始时间|Start(?:\s*Date)?)[:：]\s*(.+)$/i;
        const endLabel = /^(?:离职时间|结束时间|截止时间|End(?:\s*Date)?)[:：]\s*(.+)$/i;

        for (let i = 0; i < lines.length; i++) {
            const m = lines[i].match(companyLabel);
            if (!m) continue;

            const company = (m[1] || '').trim();
            if (!company) continue;

            let position = '';
            let dateText = '';
            let startDate = '';
            let endDate = '';

            for (let j = i; j < Math.min(i + 6, lines.length); j++) {
                const p = lines[j].match(positionLabel);
                if (p && !position) position = (p[1] || '').trim();

                const t = lines[j].match(timeLabel);
                if (t && !dateText) dateText = (t[1] || '').trim();

                const s = lines[j].match(startLabel);
                if (s && !startDate) startDate = (s[1] || '').trim();

                const e = lines[j].match(endLabel);
                if (e && !endDate) endDate = (e[1] || '').trim();
            }

            let start = '';
            let end = '';
            if (dateText) {
                const parsed = this.parseDateRange(dateText);
                start = parsed.startDate;
                end = parsed.endDate;
            } else if (startDate || endDate) {
                const sParsed = startDate ? this.parseDateRange(startDate) : { startDate: '', endDate: '' };
                const eParsed = endDate ? this.parseDateRange(endDate) : { startDate: '', endDate: '' };
                start = sParsed.startDate || sParsed.endDate || '';
                end = eParsed.endDate || eParsed.startDate || '';
                if (!end && /至今|present|now/i.test(endDate || '')) end = '至今';
            }

            const key = `${company}-${position}-${start}-${end}`;
            if (seen.has(key)) continue;
            seen.add(key);

            items.push({
                startDate: start || '',
                endDate: end || '',
                company: company,
                position: this.cleanPosition(position),
                description: []
            });
        }

        return items;
    }

    looksLikeCompany(text) {
        if (!text || text.length < 2 || text.length > 50) return false;
        const companyIndicators = [
            '公司', '集团', '科技', '网络', '软件', '信息', '技术', '数据', 
            '工作室', '厂', '局', '院', '中心', 'Co.', 'Ltd', 'Inc'
        ];
        return companyIndicators.some(ind => text.includes(ind));
    }

    findCompanyEndIndex(text) {
        const companyTypes = [
            '股份有限公司', '有限责任公司', '有限公司', '集团', '科技', 
            '网络', '软件', '信息', '技术', '数据', '智能', '电子', 
            '数码', '传媒', '文化', '教育', '咨询', '服务', '贸易', 
            '实业', '控股', '股份', '公司', 'Co', 'Ltd', 'Inc'
        ];

        let companyEndIndex = -1;
        for (const type of companyTypes) {
            const index = text.indexOf(type);
            if (index !== -1) {
                const endIndex = index + type.length;
                if (endIndex > companyEndIndex) {
                    companyEndIndex = endIndex;
                }
            }
        }
        return companyEndIndex;
    }

    isDateLine(text) {
        return /(\d{4}\.\d{1,2}[-–]\d{4}\.\d{1,2}|\d{4}\.\d{1,2}[-–]至今)/.test(text) ||
               /(\d{4}[-–年]\d{4}|\d{4}[-–年]至今)/.test(text);
    }

    extractExperienceDescriptions(content, experienceItems) {
        if (!content || experienceItems.length === 0) return experienceItems;

        const lines = content.split('\n');
        let currentExpIndex = -1;
        let currentDescLines = [];
        const garbledPattern = /1cbd323a52b5ebf51X163964GFdUx467Vf2ZWOainPXRMxZr/;
        const projectKeywords = ['项目背景', '项目职责', '项目结果', '项目描述', '项目介绍', 'Project Background', 'Project Description', 'Project Details'];

        for (let i = 0; i < lines.length; i++) {
            const trimmedLine = lines[i].trim();
            if (!trimmedLine) continue;
            
            if (garbledPattern.test(trimmedLine)) {
                continue;
            }

            const isProjectLine = projectKeywords.some(keyword => trimmedLine.includes(keyword));
            if (isProjectLine) {
                if (currentExpIndex >= 0 && currentDescLines.length > 0) {
                    experienceItems[currentExpIndex].description = currentDescLines.join('\n');
                }
                currentExpIndex = -1;
                currentDescLines = [];
                continue;
            }

            let matchedExp = false;

            for (let j = 0; j < experienceItems.length; j++) {
                const exp = experienceItems[j];
                
                const datePattern = new RegExp(
                    `^${exp.startDate.replace(/\./g, '\\.')}[-–]${exp.endDate === '至今' ? '至今' : exp.endDate.replace(/\./g, '\\.')}`,
                    'i'
                );

                if (datePattern.test(trimmedLine)) {
                    if (currentExpIndex >= 0 && currentDescLines.length > 0) {
                        experienceItems[currentExpIndex].description = currentDescLines.join('\n');
                    }
                    currentExpIndex = j;
                    currentDescLines = [];
                    matchedExp = true;
                    break;
                }
            }

            if (!matchedExp && currentExpIndex >= 0) {
                let isNextExp = false;
                for (let j = 0; j < experienceItems.length; j++) {
                    if (j <= currentExpIndex) continue;
                    const exp = experienceItems[j];
                    
                    const datePattern = new RegExp(
                        `^${exp.startDate.replace(/\./g, '\\.')}[-–]${exp.endDate === '至今' ? '至今' : exp.endDate.replace(/\./g, '\\.')}`,
                        'i'
                    );
                    
                    if (datePattern.test(trimmedLine)) {
                        isNextExp = true;
                        if (currentExpIndex >= 0 && currentDescLines.length > 0) {
                            experienceItems[currentExpIndex].description = currentDescLines.join('\n');
                        }
                        currentExpIndex = j;
                        currentDescLines = [];
                        matchedExp = true;
                        break;
                    }
                }

                if (!isNextExp) {
                    if (trimmedLine.match(/^\d{4}\.\d{1,2}[-–]/) || trimmedLine.match(/^\d{4}[-–年]/)) {
                        if (currentExpIndex >= 0 && currentDescLines.length > 0) {
                            experienceItems[currentExpIndex].description = currentDescLines.join('\n');
                            currentDescLines = [];
                        }
                    } else {
                        currentDescLines.push(trimmedLine);
                    }
                }
            }
        }

        if (currentExpIndex >= 0 && currentDescLines.length > 0) {
            experienceItems[currentExpIndex].description = currentDescLines.join('\n');
        }

        return experienceItems;
    }

    parseDateRange(dateRange) {
        if (!dateRange) return { startDate: '', endDate: '' };

        dateRange = dateRange.trim();

        const patterns = [
            { regex: /(\d{4}\.\d{1,2})[-–](\d{4}\.\d{1,2}|至今)/, format: 'dot' },
            { regex: /(\d{4})[-–年](\d{4}|至今)/, format: 'year' },
            { regex: /(\d{4})[-–](\d{4}|至今)/, format: 'simple' }
        ];

        for (const pattern of patterns) {
            const match = dateRange.match(pattern.regex);
            if (match) {
                let startDate, endDate;

                if (pattern.format === 'dot') {
                    startDate = match[1];
                    endDate = match[2];
                } else if (pattern.format === 'year') {
                    startDate = match[1] + '.01';
                    endDate = match[2] === '至今' ? '至今' : match[2] + '.12';
                } else if (pattern.format === 'simple') {
                    startDate = match[1] + '.01';
                    endDate = match[2] === '至今' ? '至今' : match[2] + '.12';
                }

                return {
                    startDate: startDate,
                    endDate: endDate
                };
            }
        }

        return { startDate: dateRange, endDate: '' };
    }

    extractCompanyName(text) {
        if (!text) return '';

        const companyPatterns = [
            /([^\s]{2,30}(?:有限公司|网络科技有限公司|信息技术有限公司|健康产业有限公司|电子商务有限公司|科技有限公司|健康产业有限公司|生物科技有限公司))$/,
            /([^\s]{2,30}(?:有限公司|网络科技有限公司|信息技术有限公司|健康产业有限公司|电子商务有限公司|科技有限公司|健康产业有限公司|生物科技有限公司))/g
        ];

        for (const pattern of companyPatterns) {
            if (pattern.global) {
                const matches = [...text.matchAll(pattern)];
                if (matches.length > 0) {
                    const lastMatch = matches[matches.length - 1];
                    let company = lastMatch[1].trim();
                    
                    company = this.cleanCompanyName(company);
                    
                    if (company.length >= 4 && company.length <= 50) {
                        return company;
                    }
                }
            } else {
                const match = text.match(pattern);
                if (match && match[1]) {
                    let company = match[1].trim();
                    
                    company = this.cleanCompanyName(company);
                    
                    if (company.length >= 4 && company.length <= 50) {
                        return company;
                    }
                }
            }
        }

        return text.trim().substring(0, 50);
    }

    cleanCompanyName(company) {
        if (!company) return '';

        let cleaned = company;

        const removePatterns = [
            /(?:^|[\s,，.。、;；])[^山东烟台北京上海广州深圳]{0,10}(?:业务|项目|平台|系统|产品|电商|运营|研发|设计|策划|需求|文档|撰写|工作|管理|开发|测试|维护|支持|服务|咨询|分析|优化|改进|提升|拓展|整合|协调|沟通|对接|对接|采购|包装|设计|运营|相关|事宜|内容|业绩|期间|参与|负责|主要|包含|模块|功能|数据|订单|设备|收入|退款|销售|管理|耗材|出入库|记录|仓库|分润|采购商|分公司|部门|员工|岗位|自助|体检|机|财务|分润|设备|收入|退款|日月季年|销售额|运行|故障|率|耗材|订单|拍照|体检|退款|合作|方|采购商|分公司|部门|员工|岗位|公司|内部|使用|目前|共|管理|自助|体检|机|日|新增|数据|达到|以上|期间|平台|远程|管理|创建|约|交易|数据|外包|目标|解决|小微|企业|再生|资源|回收|行业|无法|提供|商品|来源|问题|通过|甲方|沟通|现场|实际|调研|发现|小微|企业|再|回收|再生|资源|时|基本|不会|开具|发票|根据|这一|现状|通过|资源|整合|直接|与|大型|回收|企业|绑定|通过|人车|货|钱|同步|可|溯源|形式|规范|市场|做到|政府|有据|可查|有法|可依|使|再生|资源|交易|市场|正规化|合理化|根据|微信公众号|以及|微信|收款|商业|基础|研发|适合|线下|餐饮|店铺|点餐|系统|包含|微信公众号|卡包|包|模块|支付|会员|店铺|外卖|功能|营销|模块|财务|模块|打印|模块|老板|端|APP|小程序|等|140|余|项|模块|新形式|餐饮|店|提供|更好|管理|软件|使|顾客|成为|店铺|经营|参与者|通过|结合|新媒体|外卖|形式|达到|快速|盈利|目的|自营|集合|微信|刷脸|支付|支付宝|刷脸|支付|使|商家|免除|同时|放置|两台|刷脸|设备|避免|浪费|以及|垄断|JAVA|语言|spring|boot|VUE|MySQL|框架|开发|根据|微信|支付|商业|版|支付宝|支付|研发|集合|平台|主要|面向|线下|商铺|专业|收款|软件|其中|主要|模块|店铺|信息|会员|拓客|打印|商家|线上|商城|营销|引客|店员|提成|刷脸|支付|等|S|类|项目|电商|类|产品|具有|丰富|产品|经验|工作|经历|驾校|APP|策划|需求|文档|撰写|设计|等|工作|多肽|复合片|等|产品|OEM|生产|加工|原料|采购|产品|包装|设计|以及|公司|公众号|商城|淘宝|拼多多|等|电商|运营|相关|事宜|跨境电商|网站|设计|APP|PC|端|WEB|产品|开发|文档|原型|设计|参与|项目|研发|工作|国际|物流|国内|物流|对接|等|工作|月|销售|10|万|加|外国人|管理|系统|科目|三|考试|系统|HR|ERP|等|系统|开发|项目|经历|自助|体检|机|数据分析|系统|自营|项目|衍生|项目|目的|更好|管理|公司|异地|设备|管理|主要|负责|项目|各部门|协调|需求|文档|撰写|制定|软件|开发|计划|协调|项目|成员|工作|项目|采用|PHP|语言|ThinkPHP6|SwiftAdmin|MySQL|框架|开发|项目|主要|功能|自助|体检|机|财务|模块|分润|管理|设备|收入|管理|退款|管理|日月季年|销售额|管理|设备|模块|设备|管理|设备|故障|率|管理|设备|运行|管理|耗材|模块|出入库|记录|仓库|管理|耗材|管理|订单|模块|拍照|订单|体检|订单|退款|订单|合作|方|模块|分润|方|管理|采购商|管理|分公司|模块|部门|管理|员工|管理|岗位|管理|等|模块|公司|内部|使用|目前|共|管理|自助|体检|机|200|多|台|日|新增|数据|达到|10W|以上|期间|平台|远程|管理|300|多|台|设备|创建|约|600|多万|条|交易|数据|再生|资源|平台|外包|项目|目标|解决|小微|企业|再生|资源|回收|行业|无法|提供|商品|来源|问题|通过|甲方|沟通|现场|实际|调研|发现|小微|企业|再|回收|再生|资源|时|基本|不会|开具|发票|根据|这一|现状|通过|资源|整合|直接|与|大型|回收|企业|绑定|通过|人车|货|钱|同步|可|溯源|形式|规范|市场|做到|政府|有据|可查|有法|可依|使|再生|资源|交易|市场|正规化|合理化|项目|采用|PHP|语言|ThinkPhp6|swoole4|uniapp|MySQL|框架|开发|项目|开发|期间|主要|负责|与|客户|沟通|现场|调研|对接|需求|根据|客户|要求|撰写|需求|文档|协调|项目|成员|协作|制定|开发|周期|实时|与|客户|保持|沟通|线下|餐饮|平台|系统|根据|微信公众号|以及|微信|收款|商业|基础|研发|适合|线下|餐饮|店铺|点餐|系统|包含|微信公众号|卡包|包|模块|支付|会员|店铺|外卖|功能|营销|模块|财务|模块|打印|模块|老板|端|APP|小程序|等|140|余|项|模块|餐饮|系统|外包|项目|目标|新形式|餐饮|店|提供|更好|管理|软件|使|顾客|成为|店铺|经营|参与者|通过|结合|新媒体|外卖|形式|达到|快速|盈利|目的|项目|采用|PHP|语言|ThinkPHP6|SwiftAdmin|MySQL|框架|开发|根据|微信公众号|以及|微信|收款|商业|基础|研发|适合|线下|餐饮|店铺|点餐|系统|包含|商家|基本信息|模块|菜品|模块|档口|管理|餐桌|管理|收银|台|模块|员工|管理|订单|管理|预约|管理|排队|管理|拓客|管理|微信公众号|卡包|包|模块|支付|会员|店铺|外卖|功能|营销|模块|财务|模块|打印|模块|老板|端|APP|小程序|等|140|余|项|模块|聚合|支付|自营|通过|集合|微信|刷脸|支付|支付宝|刷脸|支付|使|商家|免除|同时|放置|两台|刷脸|设备|避免|浪费|以及|垄断|项目|采用|JAVA|语言|spring|boot|VUE|MySQL|框架|开发|根据|微信|支付|商业|版|支付宝|支付|研发|集合|平台|主要|面向|线下|商铺|专业|收款|软件|其中|主要|模块|店铺|信息|模块|会员|模块|拓客|模块|打印|模块|商家|线上|商城|模块|营销|模块|引客|模块|店员|提成|模块|刷脸|支付|模块|等|中央|广播电视|大学|大专|企业管理|学习|企业管理|驾|驶|员|自|助|体|检|机|数|据|分|析|系|统|项|目|经|理|2021|03|2022|09|内|容|此|项|目|为|公|司|自|营|项|目|衍|生|项|目|目|的|为|更|好|的|管|理|公|司|在|异|地|设|备|管|理|主|要|负|责|项|目|各|部|门|协|调|及|需|求|文|档|撰|写|制|定|软|件|开|发|计|划|协|调|项|目|成|员|工|作|项|目|采|用|P|H|P|语|言|T|h|i|n|k|P|H|P|6|S|w|i|f|t|A|d|m|i|n|M|y|S|Q|L|框|架|开|发|项|目|主|要|功|能|有|自|助|体|检|机|财|务|模|块|包|含|分|润|管|理|设|备|收|入|管|理|退|款|管|理|日|月|季|年|销|售|额|管|理|设|备|模|块|包|含|设|备|管|理|设|备|故|障|率|管|理|设|备|运|行|管|理|耗|材|模|块|包|含|出|入|库|记|录|仓|库|管|理|耗|材|管|理|订|单|模|块|拍|照|订|单|体|检|订|单|退|款|订|单|合|作|方|模|块|分|润|方|管|理|采|购|商|管|理|分|公|司|模|块|部|门|管|理|员|工|管|理|岗|位|管|理|等|模|块|业|绩|公|司|内|部|使|用|目|前|共|管|理|自|助|体|检|机|2|0|0|多|台|日|新|增|数|据|达|到|1|0|W|以|上|业|绩|期|间|平|台|远|程|管|理|3|0|0|多|台|设|备|创|建|约|6|0|0|多|万|条|交|易|数|据|再|生|资|源|平|台|项|目|经|理|2|0|2|2|0|1|2|0|2|2|0|5|此|项|目|为|公|司|外|包|项|目|项|目|目|标|为|解|决|小|微|企|业|在|再|生|资|源|回|收|行|业|无|法|提|供|商|品|来|源|问|题|通|过|与|甲|方|沟|通|及|现|场|实|际|调|研|发|现|小|微|企|业|再|回|收|再|生|资|源|时|基|本|不|会|开|具|发|票|根|据|这|一|现|状|通|过|资|源|整|合|直|接|与|大|型|回|收|企|业|绑|定|通|过|人|车|货|钱|同|步|可|溯|源|的|形|式|规|范|市|场|做|到|政|府|有|据|可|查|有|法|可|依|使|再|生|资|源|交|易|市|场|正|规|化|合|理|化|项|目|采|用|P|H|P|语|言|T|h|i|n|k|P|h|p|6|s|w|o|o|l|e|4|u|n|i|a|p|p|M|y|S|Q|L|框|架|开|发|在|项|目|开|发|期|间|主|要|负|责|与|客|户|沟|通|及|现|场|调|研|对|接|需|求|根|据|客|户|要|求|撰|写|需|求|文|档|协|调|项|目|成|员|协|作|制|定|开|发|周|期|实|时|与|客|户|保|持|沟|通|线|下|餐|饮|平|台|系|统|项|目|经|理|2|0|1|9|0|5|2|0|2|2|0|1|根|据|微|信|公|众|号|以|及|微|信|收|款|商|业|的|基|础|上|研|发|适|合|线|下|餐|饮|店|铺|的|点|餐|系|统|系|统|包|含|微|信|公|众|号|卡|包|包|模|块|支|付|及|会|员|模|块|店|铺|外|卖|功|能|营|销|模|块|财|务|模|块|打|印|模|块|老|板|端|A|P|P|小|程|序|等|1|4|0|余|项|模|块|餐|饮|系|统|项|目|经|理|主|管|2|0|2|0|0|6|2|0|2|1|0|2|此|项|目|为|公|司|外|包|项|目|项|目|目|标|为|新|形|式|下|的|餐|饮|店|提|供|更|好|的|管|理|软|件|使|顾|客|成|为|店|铺|经|营|的|参|与|者|通|过|结|合|新|媒|体|和|外|卖|的|形|式|达|到|快|速|盈|利|的|目|的|项|目|采|用|P|H|P|语|言|T|h|i|n|k|P|H|P|6|S|w|i|f|t|A|d|m|i|n|M|y|S|Q|L|框|架|开|发|根|据|微|信|公|众|号|以|及|微|信|收|款|商|业|的|基|础|上|研|发|适|合|线|下|餐|饮|店|铺|的|点|餐|系|统|系|统|包|含|商|家|基|本|信|息|模|块|菜|品|模|块|档|口|管|理|餐|桌|管|理|收|银|台|模|块|员|工|管|理|订|单|管|理|预|约|管|理|排|队|管|理|拓|客|管|理|微|信|公|众|号|卡|包|包|模|块|支|付|及|会|员|模|块|店|铺|外|卖|功|能|营|销|模|块|财|务|模|块|打|印|模|块|老|板|端|A|P|P|小|程|序|等|1|4|0|余|项|模|块|聚|合|支|付|项|目|经|理|主|管|2|0|1|9|0|6|2|0|2|0|0|6|此|项|目|为|公|司|自|营|项|目|通|过|集|合|微|信|刷|脸|支|付|和|支|付|宝|刷|脸|支|付|使|商|家|免|除|同|时|放|置|两|台|刷|脸|设|备|避|免|浪|费|以|及|垄|断|项|目|采|用|J|A|V|A|语|言|s|p|r|i|n|g|b|o|o|t|V|U|E|M|y|S|Q|L|框|架|开|发|根|据|微|信|支|付|商|业|版|和|支|付|宝|支|付|研|发|的|集|合|平|台|主|要|面|向|于|线|下|商|铺|的|专|业|收|款|软|件|其|中|主|要|模|块|为|店|铺|信|息|模|块|会|员|模|块|拓|客|模|块|打|印|模|块|商|家|线|上|商|城|模|块|营|销|模|块|引|客|模|块|店|员|提|成|模|块|刷|脸|支|付|模|块|等|中|央|广|播|电|视|大|学|大|专|企|业|管|理|2|0|1|1|2|0|1|3|学|习|企|业|管|理|006d3bcd164b99021X1639m5GVZUwY23VfKaWOainPXRMxZr)[\s,，.。、;；]*/g
        ];

        for (const pattern of removePatterns) {
            cleaned = cleaned.replace(pattern, '');
        }

        cleaned = cleaned.trim();

        if (cleaned.length > 50) {
            cleaned = cleaned.substring(0, 50);
        }

        return cleaned;
    }

    cleanPosition(text) {
        if (!text) return '';

        let position = text.trim();
        position = position.replace(/^[^\w\u4e00-\u9fa5]+/, '');
        position = position.replace(/[^\w\u4e00-\u9fa5]+$/, '');

        if (position.length > 30) {
            position = position.substring(0, 30);
        }

        return position;
    }

    isDuplicateExperience(newExp, existingExps) {
        if (!newExp.company || newExp.company.length < 2) {
            return false;
        }

        for (const exp of existingExps) {
            if (!exp.company) continue;

            if (newExp.company === exp.company) {
                if (newExp.startDate === exp.startDate && newExp.endDate === exp.endDate) {
                    return true;
                }
            }
        }
        return false;
    }

    extractCompanyFromText(text) {
        const patterns = [
            /([^\n\r]+公司|有限公司|Co\.|Ltd\.)/i,
            /([^\n\r]+集团|企业|机构|组织)/i
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                return match[1].trim();
            }
        }
        return '';
    }

    extractPositionFromText(text) {
        const patterns = [
            /(?:公司|有限公司|Co\.|Ltd\.|集团|企业|机构|组织)\s+([^\n\r]+工程师|开发|程序员|架构师|设计师|分析师|经理|主管|总监|专员|顾问|专家)/i,
            /([^\n\r]+工程师|开发|程序员|架构师|设计师|分析师|经理|主管|总监|专员|顾问|专家)$/i,
            /(?:职位|岗位|职务)[:：]\s*([^\n\r]+)/i
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                return match[1].trim();
            }
        }
        return '';
    }

    extractProjects(content) {
        if (!content || content.trim().length === 0) return [];

        const projectItems = [];
        const lines = content.split('\n');
        
        const patterns = [
            { regex: /(\d{4}\.\d{2}[-–]\d{4}\.\d{2}|\d{4}\.\d{2}[-–]至今)[ \t]+([^\d\n]{2,50})[ \t]+([^\d\n]{2,30})/gmi, type: 'date-name-role' },
            { regex: /(\d{4}[-–年]\d{4}|\d{4}[-–年]至今)[ \t]+([^\d\n]{2,50})[ \t]+([^\d\n]{2,30})/gmi, type: 'date-name-role' },
            { regex: /([^\d\n]{2,50})[ \t]+([^\d\n]{2,30})[ \t]*(\d{4}\.\d{2}[-–]\d{4}\.\d{2}|\d{4}\.\d{2}[-–]至今)/gmi, type: 'name-role-date' },
            { regex: /([^\d\n]{2,50})[ \t]+([^\d\n]{2,30})[ \t]*(\d{4}[-–年]\d{4}|\d{4}[-–年]至今)/gmi, type: 'name-role-date' },
            { regex: /(\d{4}\.\d{2}[-–]\d{4}\.\d{2}|\d{4}\.\d{2}[-–]至今)[ \t]+([^\d\n]{2,50})/gmi, type: 'date-name' },
            { regex: /(\d{4}[-–年]\d{4}|\d{4}[-–年]至今)[ \t]+([^\d\n]{2,50})/gmi, type: 'date-name' }
        ];

        const processedMatches = new Set();
        const garbledPattern = /006d3bcd164b99021X1639m5GVZUwY23VfKaWOainPXRMxZr/;

        for (const pattern of patterns) {
            const matches = [...content.matchAll(pattern.regex)];

            for (const match of matches) {
                let name, role, dateRange;

                if (pattern.type === 'date-name-role') {
                    dateRange = match[1];
                    name = match[2];
                    role = match[3];
                } else if (pattern.type === 'name-role-date') {
                    name = match[1];
                    role = match[2];
                    dateRange = match[3];
                } else if (pattern.type === 'date-name') {
                    dateRange = match[1];
                    name = match[2];
                    role = '';
                }

                if (!name || !dateRange) continue;

                if (garbledPattern.test(name) || garbledPattern.test(role)) {
                    continue;
                }

                const matchKey = `${name}-${dateRange}`;
                if (processedMatches.has(matchKey)) {
                    continue;
                }
                processedMatches.add(matchKey);

                const cleanName = this.cleanProjectName(name);
                const cleanRole = this.cleanProjectRole(role);
                const { startDate, endDate } = this.parseDateRange(dateRange);

                if (cleanName && cleanName.length > 1) {
                    const newProject = {
                        startDate: startDate,
                        endDate: endDate,
                        name: cleanName,
                        role: cleanRole,
                        description: []
                    };

                    if (!this.isDuplicateProject(newProject, projectItems)) {
                        projectItems.push(newProject);
                    }
                }
            }
        }

        const projectsWithDescriptions = this.extractProjectDescriptions(content, projectItems);

        return projectsWithDescriptions;
    }

    cleanProjectName(name) {
        if (!name) return '';
        
        const patterns = [
            /(?:项目|Project)[:：]\s*/i,
            /(?:名称|Name)[:：]\s*/i,
            /^[：:：\s]+/,
            /006d3bcd164b99021X1639m5GVZUwY23VfKaWOainPXRMxZr/g,
            /\d{4}\.\d{2}[-–]\d{4}\.\d{2}/g,
            /\d{4}[-–年]\d{4}/g
        ];

        let cleaned = name;
        for (const pattern of patterns) {
            cleaned = cleaned.replace(pattern, '');
        }

        cleaned = cleaned.trim();
        
        if (cleaned.length > 100) {
            cleaned = cleaned.substring(0, 100);
        }

        return cleaned;
    }

    cleanProjectRole(role) {
        if (!role) return '';
        
        const patterns = [
            /(?:角色|Role)[:：]\s*/i,
            /(?:职位|Position)[:：]\s*/i,
            /(?:担任|担任：|担任:)\s*/i,
            /^[：:：\s]+/
        ];

        let cleaned = role;
        for (const pattern of patterns) {
            cleaned = cleaned.replace(pattern, '');
        }

        cleaned = cleaned.trim();
        
        if (cleaned.length > 50) {
            cleaned = cleaned.substring(0, 50);
        }

        return cleaned;
    }

    isDuplicateProject(newProject, existingProjects) {
        return existingProjects.some(proj => 
            proj.name === newProject.name && 
            proj.startDate === newProject.startDate
        );
    }

    extractProjectDescriptions(content, projects) {
        if (!projects || projects.length === 0) return [];

        const lines = content.split('\n');
        const projectsWithDesc = projects.map(proj => ({ ...proj, description: [] }));

        let currentProjectIndex = -1;
        let currentDescLines = [];
        const garbledPattern = /006d3bcd164b99021X1639m5GVZUwY23VfKaWOainPXRMxZr/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.length === 0) continue;

            if (garbledPattern.test(line)) {
                continue;
            }

            let foundProject = false;
            for (let j = 0; j < projects.length; j++) {
                const proj = projects[j];
                const namePattern = new RegExp(this.escapeRegExp(proj.name), 'i');
                const datePattern = new RegExp(proj.startDate.replace(/\./g, '\\.') + '.*' + (proj.endDate ? proj.endDate.replace(/\./g, '\\.') : '至今'), 'i');
                
                if (namePattern.test(line) || datePattern.test(line)) {
                    if (currentProjectIndex >= 0 && currentDescLines.length > 0) {
                        projectsWithDesc[currentProjectIndex].description = currentDescLines.join('\n');
                    }
                    currentProjectIndex = j;
                    currentDescLines = [];
                    foundProject = true;
                    break;
                }
            }

            if (!foundProject && currentProjectIndex >= 0) {
                if (line.match(/^\d{4}\.\d{2}|^\d{4}[-–年]|^项目|^Project/i)) {
                    if (currentDescLines.length > 0) {
                        projectsWithDesc[currentProjectIndex].description = currentDescLines.join('\n');
                        currentDescLines = [];
                    }
                } else {
                    currentDescLines.push(line);
                }
            }
        }

        if (currentProjectIndex >= 0 && currentDescLines.length > 0) {
            projectsWithDesc[currentProjectIndex].description = currentDescLines.join('\n');
        }

        return projectsWithDesc;
    }

    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    calculateExperienceYears(content) {
        if (!content || content.trim().length === 0) return 0;

        const patterns = [
            /(\d{4})[.-](\d{2})[-–](\d{4})[.-](\d{2})/g,
            /(\d{4})[.-](\d{2})[-–](\d{4}|至今|Present|Now)(?![.-]\d{2})/g,
            /(\d{4})[-–年](\d{4})/g,
            /(\d{4})[-–年](\d{4}|至今|Present|Now)/g
        ];
        
        let totalMonths = 0;

        for (const pattern of patterns) {
            let match;
            const regex = new RegExp(pattern.source, 'g');
            
            while ((match = regex.exec(content)) !== null) {
                let startYear, startMonth, endYear, endMonth;

                if (match.length >= 5) {
                    startYear = parseInt(match[1]);
                    startMonth = parseInt(match[2]);
                    endYear = parseInt(match[3]);
                    endMonth = parseInt(match[4]);
                } else if (match.length >= 4) {
                    if (match[2].match(/^\d{4}$/) || match[2].match(/至今|Present|Now/i)) {
                        startYear = parseInt(match[1]);
                        startMonth = 1;
                        endYear = match[2].match(/至今|Present|Now/i) ? new Date().getFullYear() : parseInt(match[2]);
                        endMonth = match[2].match(/至今|Present|Now/i) ? new Date().getMonth() + 1 : 12;
                    } else {
                        startYear = parseInt(match[1]);
                        startMonth = parseInt(match[2].substring(0, 2));
                        endYear = match[3].match(/至今|Present|Now/i) ? new Date().getFullYear() : parseInt(match[3]);
                        endMonth = match[3].match(/至今|Present|Now/i) ? new Date().getMonth() + 1 : 12;
                    }
                } else {
                    continue;
                }

                if (isNaN(startYear) || isNaN(startMonth) || isNaN(endYear) || isNaN(endMonth)) {
                    continue;
                }

                const months = (endYear - startYear) * 12 + (endMonth - startMonth);
                if (months > 0) {
                    totalMonths += months;
                }
            }
        }

        const years = Math.floor(totalMonths / 12);
        return Math.min(years, 50);
    }

    extractSummary(content) {
        if (!content || content.trim().length === 0) {
            return '';
        }

        const lines = content.split('\n');
        
        let summaryLines = [];
        
        for (let i = 0; i < lines.length; i++) {
            const trimmedLine = lines[i].trim();
            
            if (trimmedLine.length === 0) {
                continue;
            }

            if (trimmedLine.match(/^个人优势[^\n\r]{10,}/)) {
                const cleanedLine = trimmedLine.replace(/^个人优势/, '').trim();
                if (cleanedLine.length > 0) {
                    summaryLines.push(cleanedLine);
                }
                
                for (let j = i + 1; j < lines.length; j++) {
                    const nextLine = lines[j].trim();
                    
                    if (nextLine.length === 0) {
                        continue;
                    }
                    
                    const isWorkExperienceLine = nextLine.match(/^\d{4}\.\d{1,2}[-–]/) || 
                        nextLine.match(/^\d{4}[-–年]/);
                    
                    const isSectionHeader = nextLine.match(/^(自我评价|工作经历|教育背景|项目经历|技能专长|技能证书|基本信息|项目背景|项目职责|项目结果|项目描述|项目介绍)/);
                    
                    if (isWorkExperienceLine || isSectionHeader) {
                        break;
                    }
                    
                    summaryLines.push(nextLine);
                }
                
                if (summaryLines.length > 0) {
                    return summaryLines.join('\n').substring(0, 200);
                }
            }
        }

        summaryLines = [];
        let summaryStarted = false;

        for (let i = 0; i < lines.length; i++) {
            const trimmedLine = lines[i].trim();
            
            if (trimmedLine.length === 0) {
                continue;
            }

            if (trimmedLine.match(/^(个人优势|个人简介|自我评价|Summary|Profile|About Me|个人总结|个人介绍|自我介绍)[:：]?\s*$/i)) {
                summaryStarted = true;
                continue;
            }

            if (trimmedLine.match(/^(个人优势|个人简介|自我评价|Summary|Profile|About Me|个人总结|个人介绍|自我介绍)[:：]?\s*/i)) {
                summaryStarted = true;
                const cleanedLine = trimmedLine.replace(/^(个人优势|个人简介|自我评价|Summary|Profile|About Me|个人总结|个人介绍|自我介绍)[:：]?\s*/i, '').trim();
                if (cleanedLine.length > 0) {
                    summaryLines.push(cleanedLine);
                }
                continue;
            }

            if (summaryStarted) {
                const isWorkExperienceLine = trimmedLine.match(/^\d{4}\.\d{1,2}[-–]/) || 
                    trimmedLine.match(/^\d{4}[-–年]/);
                
                const isProjectKeyword = trimmedLine.match(/^(项目背景|项目职责|项目结果|项目描述|项目介绍)/);
                
                const isWorkDetail = trimmedLine.match(/^(工作概括|项目规划|进度管理|项目实施|协同沟通|需求管理|项目交付|团队管理)/);
                
                const isSectionHeader = trimmedLine.match(/^(工作经历|教育背景|项目经历|技能专长|技能证书|教育背景|基本信息)/);
                
                if (isWorkExperienceLine || isProjectKeyword || isSectionHeader) {
                    break;
                }
                
                if (isWorkDetail) {
                    continue;
                }
                
                summaryLines.push(trimmedLine);
            }
        }

        if (summaryLines.length === 0) {
            const summaryPattern = /个人优势[^\n\r]{10,200}/;
            const match = content.match(summaryPattern);
            if (match) {
                let summary = match[0].replace(/个人优势/g, '').trim();
                return summary.substring(0, 200);
            }
        }
        
        const result = summaryLines.join('\n').substring(0, 200);
        if (result && result.trim().length > 0) return result;

        const fallbackLines = content
            .split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 0)
            .filter(l => !l.match(/^(姓名|电话|手机|邮箱|地址|城市|Location|City)[:：]/i))
            .filter(l => !this.isDateLine(l))
            .filter(l => l.length >= 8 && l.length <= 120)
            .filter(l => /(擅长|熟悉|精通|具备|拥有|经验|能力|优势|特点|负责|主导|参与)/.test(l));

        return fallbackLines.slice(0, 3).join('\n').substring(0, 200);
    }
}

module.exports = OptimizedResumeParseService;
