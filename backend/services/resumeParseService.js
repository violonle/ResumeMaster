const { cleanText } = require('./textExtractor');

class ResumeParseService {
    constructor() {
        this.patterns = {
            name: /(?:姓名|Name)[:：]\s*([^\n\r]+)/i,
            phone: /(?:电话|手机|Phone|Mobile|Tel)[:：]\s*([0-9\-+\s]+)/i,
            email: /(?:邮箱|Email|E-mail)[:：]\s*([^\n\r\s]+)/i,
            location: /(?:地址|城市|Location|City)[:：]\s*([^\n\r]+)/i,
            jobTitle: /(?:职位|应聘|目标|Position|Job Title)[:：]\s*([^\n\r]+)/i,
            education: /(?:教育|学历|Education|Degree)[:：]([^\n\r]+)/i,
            university: /(?:学校|大学|University|School)[:：]([^\n\r]+)/i,
            experience: /(?:工作|工作经历|Work Experience|Experience)[:：]([^\n\r]+)/i,
            skills: /(?:技能|Skills|Skill)[:：]([^\n\r]+)/i
        };
    }

    async parseResumeContent(content, fileType = 'txt', fileName = '') {
        try {
            if (!content || typeof content !== 'string') {
                return { rawText: '', parseError: '内容为空' };
            }

            content = cleanText(content);

            const parsed = {
                rawText: content,
                name: this.extractName(content, fileName),
                email: this.extractEmail(content),
                phone: this.extractPhone(content),
                location: this.extractLocation(content),
                job_title: this.extractJobTitle(content),
                skills: this.extractSkills(content),
                education: this.extractEducation(content),
                work_experience: this.extractExperience(content),
                experience_years: this.calculateExperienceYears(content),
                summary: this.extractSummary(content)
            };

            return parsed;
        } catch (error) {
            console.error('简历解析失败:', error);
            return { rawText: content || '', parseError: error.message };
        }
    }

    extractName(content, fileName = '') {
        // 1. 尝试从文件名提取
        if (fileName) {
            const name = fileName.replace(/\.[^/.]+$/, "");
            const segments = name.split(/[_-\s]+/).filter(s => s.length >= 2 && s.length <= 4);
            for (const segment of segments) {
                if (/^[\u4e00-\u9fa5]{2,4}$/.test(segment)) {
                    const nonNameKeywords = ['简历', '工程师', '开发', '设计', '经理', '项目'];
                    if (!nonNameKeywords.some(k => segment.includes(k))) {
                        return segment;
                    }
                }
            }
        }

        // 2. 尝试正则匹配
        const patterns = [
            /(?:姓名|Name)[:：]\s*([\u4e00-\u9fa5]{2,4})/i,
            /(?:姓名|Name)[:：]\s*([A-Za-z\s.]{2,20})/i,
            /(?:个人简历|简历)\s*([\u4e00-\u9fa5]{2,4})/,
            /^([\u4e00-\u9fa5]{2,4})\s*(?:\n|$)/m
        ];

        for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match && match[1]) {
                const name = match[1].trim();
                const skillKeywords = ['熟悉', '精通', '掌握', '使用', '负责'];
                if (!skillKeywords.some(k => name.includes(k))) {
                    return name;
                }
            }
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
            /(?:地址|城市|Location|City|现居地|所在地|居住地)[:：]\s*([^\n\r]+)/i,
            /(?:北京|上海|广州|深圳|杭州|成都|重庆|武汉|南京|西安|天津|苏州|长沙|郑州|青岛|大连|厦门|宁波|无锡|济南|哈尔滨|长春|沈阳|石家庄|太原|合肥|南昌|福州|昆明|南宁|贵阳|兰州|海口|呼和浩特|银川|西宁|乌鲁木齐|拉萨|港澳台)/,
            /(?:省|市|自治区|特别行政区)/
        ];

        for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match && match[1]) {
                const location = match[1].trim();
                if (location.length <= 50) {
                    return location;
                }
            }
        }
        return '';
    }

    extractJobTitle(content) {
        const patterns = [
            /(?:职位|应聘|目标|Position|Job Title|求职意向|应聘岗位)[:：]\s*([^\n\r]+)/i,
            /(?:目前职位|Current Position|现任)[:：]([^\n\r]+)/i,
            /(?:期望职位|Expected Position|目标职位)[:：]([^\n\r]+)/i
        ];

        for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match && match[1]) {
                const title = match[1].trim();
                if (title.length <= 100 && !title.match(/^[0-9]+$/)) {
                    return title;
                }
            }
        }
        return '';
    }

    extractSkills(content) {
        const patterns = [
            /(?:技能|Skills|Skill|专业技能|技术栈|Technical Skills|核心技能)[:：]([^\n\r]+)/i,
            /(?:熟悉|掌握|精通|了解)\s*([^\n\r]{10,200})/i
        ];

        for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match && match[1]) {
                const skillsText = match[1];
                const skills = skillsText.split(/[,，、;；|\/\s]+/)
                    .map(s => s.trim())
                    .filter(s => s.length > 0 && s.length < 50 && !s.match(/^[0-9]+$/));
                if (skills.length > 0) {
                    return skills;
                }
            }
        }

        const commonSkills = [
            'Java', 'Python', 'JavaScript', 'TypeScript', 'React', 'Vue', 'Angular',
            'Node.js', 'Spring', 'Django', 'Flask', 'MySQL', 'PostgreSQL', 'MongoDB',
            'Docker', 'Kubernetes', 'AWS', 'Azure', 'Git', 'Linux', 'HTML', 'CSS',
            'C++', 'C#', 'Go', 'Rust', 'Swift', 'Kotlin', 'PHP', 'Ruby', 'Scala',
            'TensorFlow', 'PyTorch', 'Keras', 'Scikit-learn', 'Pandas', 'NumPy',
            '数据分析', '机器学习', '深度学习', '人工智能', '大数据', '云计算',
            '项目管理', '产品经理', 'UI/UX', '测试', '运维', 'DevOps', '敏捷开发',
            '前端开发', '后端开发', '全栈开发', '移动开发', 'Web开发', '软件工程',
            '数据库', '算法', '数据结构', '计算机网络', '操作系统', '设计模式',
            '微服务', 'RESTful', 'GraphQL', 'Redis', 'Elasticsearch', 'Nginx',
            'Jenkins', 'CI/CD', 'TDD', 'BDD', '单元测试', '集成测试', '性能测试'
        ];

        const foundSkills = commonSkills.filter(skill => 
            content.toLowerCase().includes(skill.toLowerCase())
        );

        return foundSkills.length > 0 ? foundSkills : [];
    }

    extractEducation(content) {
        const educationSection = this.extractSection(content, ['教育经历', '教育背景', 'Education', '学历', '学位', '教育', '学习经历']);
        
        if (!educationSection) return [];

        const educationItems = [];
        const patterns = [
            /(\d{4})\s*[-–年至]+\s*(\d{4}|至今|Present|Now)\s*([^\n\r]+?)(?=\n|$)/g,
            /([^\n\r]+大学|学院|University|College|School)[^\n\r]*(\d{4})/g
        ];

        let match;
        while ((match = patterns[0].exec(educationSection)) !== null) {
            educationItems.push({
                startYear: match[1],
                endYear: match[2],
                school: match[3].trim(),
                degree: this.extractDegree(educationSection)
            });
        }

        return educationItems.length > 0 ? educationItems : [];
    }

    extractDegree(content) {
        const patterns = [
            /(?:博士|PhD|Doctorate|博士学位)/i,
            /(?:硕士|Master|MBA|硕士学位)/i,
            /(?:本科|Bachelor|学士学位)/i,
            /(?:大专|专科|College|Associate|大专学历)/i,
            /(?:高中|High School|高中学历)/i
        ];

        for (const pattern of patterns) {
            if (pattern.test(content)) {
                return pattern.source.replace(/[\/\|\\]/g, '');
            }
        }
        return '';
    }

    extractExperience(content) {
        const experienceSection = this.extractSection(content, ['工作经历', '工作经验', 'Work Experience', 'Experience', '职业经历', '工作', '工作经历']);

        if (!experienceSection) return [];

        const experienceItems = [];
        const patterns = [
            /(\d{4})\s*[-–年至]+\s*(\d{4}|至今|Present|Now)\s*([^\n\r]+?)(?=\n|$)/g,
            /([^\n\r]+公司|有限公司|Co\.|Ltd\.)[^\n\r]*(\d{4})/g
        ];

        let match;
        while ((match = patterns[0].exec(experienceSection)) !== null) {
            experienceItems.push({
                startYear: match[1],
                endYear: match[2],
                company: match[3].trim(),
                description: this.extractJobDescription(experienceSection)
            });
        }

        return experienceItems.length > 0 ? experienceItems : [];
    }

    extractJobDescription(content) {
        const lines = content.split('\n');
        const descriptions = [];
        
        for (const line of lines) {
            if (line.trim().length > 10 && !line.match(/^\d{4}/) && !line.match(/^[A-Za-z\u4e00-\u9fa5]{2,20}[:：]/)) {
                descriptions.push(line.trim());
            }
        }
        
        return descriptions.slice(0, 5).join(' ');
    }

    extractSection(content, sectionNames) {
        for (const name of sectionNames) {
            const regex = new RegExp(`${name}[:：]?([\\s\\S]*?)(?=\n(?:[A-Za-z\u4e00-\\u9fa5]{2,20}[:：])|$)`, 'i');
            const match = content.match(regex);
            if (match && match[1]) {
                return match[1].trim();
            }
        }
        return null;
    }

    calculateExperienceYears(content) {
        const experienceSection = this.extractSection(content, ['工作经历', '工作经验', 'Work Experience', 'Experience', '职业经历', '工作', '工作经历']);
        
        if (!experienceSection) return 0;

        const yearPattern = /(\d{4})\s*[-–年至]+\s*(\d{4}|至今|Present|Now)/g;
        let totalYears = 0;
        let match;

        while ((match = yearPattern.exec(experienceSection)) !== null) {
            const startYear = parseInt(match[1]);
            const endYear = match[2].match(/至今|Present|Now/i) ? new Date().getFullYear() : parseInt(match[2]);
            const years = endYear - startYear;
            totalYears += years > 0 ? years : 0;
        }

        return Math.min(totalYears, 50);
    }

    extractSummary(content) {
        const summarySection = this.extractSection(content, ['个人简介', '自我评价', 'Summary', 'Profile', 'About Me', '个人总结', '个人介绍']);
        
        if (summarySection) {
            return summarySection.substring(0, 500);
        }

        const firstParagraph = content.match(/^([^\n\r]{50,500})/);
        return firstParagraph ? firstParagraph[1] : '';
    }
}

module.exports = ResumeParseService;