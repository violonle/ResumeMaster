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

class ImprovedResumeParseService {
    constructor() {
        this.patterns = {
            name: /(?:姓名|Name)[:：]\s*([^\n\r]+)/i,
            phone: /(?:电话|手机|Phone|Mobile|Tel|联系电话|联系方式)[:：]\s*([0-9\-\+\s()]{7,20})/i,
            email: /(?:邮箱|Email|E-mail)[:：]\s*([^\n\r\s]+)/i,
            location: /(?:地址|城市|Location|City)[:：]\s*([^\n\r]+)/i,
            jobTitle: /(?:职位|应聘|目标|Position|Job Title)[:：]\s*([^\n\r]+)/i,
            education: /(?:教育|学历|Education|Degree)[:：]([^\n\r]+)/i,
            university: /(?:学校|大学|University|School)[:：]([^\n\r]+)/i,
            experience: /(?:工作|工作经历|Work Experience|Experience)[:：]([^\n\r]+)/i,
            skills: /(?:技能|Skills|Skill)[:：]([^\n\r]+)/i
        };
    }

    async parseResumeContent(content, fileType = 'txt') {
        try {
            if (!content || typeof content !== 'string') {
                return { rawText: '', parseError: '内容为空' };
            }

            content = cleanTextPreserveNewlines(content);

            const sections = this.extractAllSections(content);

            const parsed = {
                rawText: content,
                name: this.extractName(content),
                email: this.extractEmail(content),
                phone: this.extractPhone(content),
                location: this.extractLocation(content),
                job_title: this.extractJobTitle(content),
                skills: this.extractSkills(sections.skills || content),
                education: this.extractEducation(sections.education || ''),
                work_experience: this.extractExperience(sections.experience || ''),
                projects: this.extractProjects(sections.projects || ''),
                experience_years: this.calculateExperienceYears(sections.experience || ''),
                summary: this.extractSummary(sections.summary || '')
            };

            return parsed;
        } catch (error) {
            console.error('简历解析失败:', error);
            return { rawText: content || '', parseError: error.message };
        }
    }

    extractAllSections(content) {
        const sections = {
            experience: '',
            education: '',
            projects: '',
            skills: '',
            summary: '',
            other: ''
        };
        
        const sectionPatterns = {
            experience: /工作经历|Work Experience|Experience|以往工作|工作经验/i,
            education: /教育经历|Education|学历背景|教育背景/i,
            projects: /项目经历|Projects|项目经验/i,
            skills: /技能|Skills|专业技能|技能专长/i,
            summary: /个人优势|自我评价|个人总结|Summary|Personal Statement/i
        };

        let currentSection = 'other';
        let remainingText = content;
        
        const sectionOrder = ['summary', 'experience', 'projects', 'education', 'skills'];
        
        for (const section of sectionOrder) {
            const pattern = sectionPatterns[section];
            const match = remainingText.match(pattern);
            
            if (match) {
                const matchIndex = remainingText.indexOf(match[0]);
                
                if (matchIndex > 0) {
                    const beforeMatch = remainingText.substring(0, matchIndex).trim();
                    if (beforeMatch.length > 0) {
                        sections[currentSection] = beforeMatch;
                    }
                }
                
                currentSection = section;
                remainingText = remainingText.substring(matchIndex + match[0].length).trim();
            }
        }
        
        if (remainingText.length > 0) {
            sections[currentSection] = remainingText;
        }

        return sections;
    }

    extractName(content) {
        const patterns = [
            /(?:姓名|Name)[:：]\s*([A-Za-z\u4e00-\u9fa5\s\-]{2,20})/i,
            /(?:个人简历|简历)\s*([A-Za-z\u4e00-\u9fa5\s\-]{2,10})/,
            /^([A-Za-z\u4e00-\u9fa5]{2,10})\s*(?:\n|$)/m,
            /(?:求职者|应聘者|申请人)[:：]\s*([A-Za-z\u4e00-\u9fa5\s\-]{2,20})/i
        ];

        for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match && match[1]) {
                const name = match[1].trim();
                if (name.length >= 2 && name.length <= 20 && !name.match(/^[0-9]+$/)) {
                    return name;
                }
            }
        }
        
        const chineseNameMatch = content.match(/([一-龥]{2,4})\s*(?:男|女|\d+岁)/);
        if (chineseNameMatch && chineseNameMatch[1]) {
            return chineseNameMatch[1];
        }
        
        return '';
    }

    extractEmail(content) {
        const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
        const match = content.match(emailPattern);
        return match ? match[1] : '';
    }

    extractPhone(content) {
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
                if (title.length <= 50 && !title.match(/工作|经历|教育|项目|技能|个人|优势|自我|评价|总结|简介|介绍|证书|资格|薪资|期望|城市|时长|年|岁|性别|男|女|联系方式|邮箱|电话|手机|地址/)) {
                    return title;
                }
            }
        }
        return '';
    }

    extractExperience(content) {
        if (!content) return [];
        
        const experiences = [];
        
        const datePattern = /(\d{4}\.\d{2})\s*[-—–至到]+\s*(?:至今|现在|present|current|\d{4}\.\d{2})/gi;
        const dateMatches = [...content.matchAll(datePattern)];
        
        for (const dateMatch of dateMatches) {
            const dateStr = dateMatch[0];
            const matchIndex = dateMatch.index;
            
            const beforeDate = content.substring(0, matchIndex).trim();
            const afterDate = content.substring(matchIndex + dateStr.length).trim();
            
            const companyMatch = beforeDate.match(/([^\s]+(?:有限公司|公司|集团|科技|网络|电子|健康|产业|电子商务|网络科技))[^。]*$/);
            const positionMatch = beforeDate.match(/(?:项目经理|主管|经理|工程师|开发|设计|分析师|顾问|专家|专员|总监|负责人)[^。]*$/);
            
            const dateParts = dateStr.split(/[-—–至到]+/);
            
            experiences.push({
                company: companyMatch ? companyMatch[1] : '',
                position: positionMatch ? positionMatch[0] : '',
                startDate: dateParts[0] ? dateParts[0].trim() : '',
                endDate: dateParts[1] ? dateParts[1].trim() : '',
                description: afterDate
            });
        }
        
        return experiences;
    }

    extractEducation(content) {
        if (!content) return [];
        
        const education = [];
        
        const datePattern = /(\d{4})[-—–至到]+(\d{4})/g;
        const dateMatches = [...content.matchAll(datePattern)];
        
        for (const dateMatch of dateMatches) {
            const dateStr = dateMatch[0];
            const matchIndex = dateMatch.index;
            
            const beforeDate = content.substring(0, matchIndex).trim();
            const afterDate = content.substring(matchIndex + dateStr.length).trim();
            
            const schoolMatch = beforeDate.match(/([^\s]+(?:大学|学院|学校))[^。]*$/);
            const degreeMatch = beforeDate.match(/(?:大专|本科|硕士|博士|研究生|专科)[^。]*$/);
            const majorMatch = beforeDate.match(/(?:专业|主修)[^。]*$/);
            
            education.push({
                school: schoolMatch ? schoolMatch[1] : '',
                degree: degreeMatch ? degreeMatch[0] : '',
                major: majorMatch ? majorMatch[0] : '',
                startDate: dateMatch[1] ? dateMatch[1].trim() : '',
                endDate: dateMatch[2] ? dateMatch[2].trim() : '',
                description: afterDate
            });
        }
        
        return education;
    }

    extractProjects(content) {
        if (!content) return [];
        
        const projects = [];
        
        const datePattern = /(\d{4}\.\d{2})\s*[-—–至到]+\s*(?:至今|现在|present|current|\d{4}\.\d{2})/gi;
        const dateMatches = [...content.matchAll(datePattern)];
        
        for (const dateMatch of dateMatches) {
            const dateStr = dateMatch[0];
            const matchIndex = dateMatch.index;
            
            const beforeDate = content.substring(0, matchIndex).trim();
            const afterDate = content.substring(matchIndex + dateStr.length).trim();
            
            const projectNameMatch = beforeDate.match(/([^\s]+(?:系统|平台|项目))[^。]*$/);
            const roleMatch = beforeDate.match(/(?:项目经理|主管|经理|工程师|开发|设计|分析师|顾问|专家|专员|总监|负责人)[^。]*$/);
            
            const dateParts = dateStr.split(/[-—–至到]+/);
            
            projects.push({
                name: projectNameMatch ? projectNameMatch[1] : '',
                role: roleMatch ? roleMatch[0] : '',
                startDate: dateParts[0] ? dateParts[0].trim() : '',
                endDate: dateParts[1] ? dateParts[1].trim() : '',
                description: afterDate
            });
        }
        
        return projects;
    }

    extractSkills(content) {
        if (!content) return [];
        
        const skills = [];
        const lines = content.split('\n');
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;
            
            if (trimmedLine.length > 2 && trimmedLine.length < 50 &&
                !trimmedLine.match(/工作|经历|教育|项目|技能|个人|优势|自我|评价|总结|简介|介绍|证书|资格|薪资|期望|城市|时长|年|岁|性别|男|女|联系方式|邮箱|电话|手机|地址|内容|职责|业绩|学习|专业|学校|大学|学历|学位|本科|大专|硕士|博士/)) {
                skills.push(trimmedLine);
            }
        }
        
        return skills;
    }

    extractSummary(content) {
        if (!content) return '';
        
        const lines = content.split('\n');
        const summaryLines = [];
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;
            
            if (trimmedLine.length > 10 && trimmedLine.length < 500) {
                summaryLines.push(trimmedLine);
            }
        }
        
        return summaryLines.join('\n');
    }

    calculateExperienceYears(content) {
        if (!content) return 0;
        
        const dateMatches = content.match(/(\d{4}\.\d{2}|\d{4}\/\d{2}|\d{4}-\d{2})/g);
        if (!dateMatches || dateMatches.length < 2) return 0;
        
        const dates = dateMatches.map(dateStr => {
            const parts = dateStr.split(/[.\/\-]/);
            if (parts.length >= 2) {
                return parseInt(parts[0]) + parseInt(parts[1]) / 12;
            }
            return parseInt(parts[0]);
        });
        
        const minYear = Math.min(...dates);
        const maxYear = Math.max(...dates);
        
        return Math.round(maxYear - minYear);
    }
}

module.exports = ImprovedResumeParseService;
