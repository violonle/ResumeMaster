const { cleanText } = require('./enhancedTextExtractor');

class EnhancedResumeParseService {
    constructor() {
        this.patterns = {
            // 基本信息
            name: /(?:姓名|Name|姓名[:：])\s*([^\n\r]+)/i,
            phone: /(?:电话|手机|Phone|Mobile|Tel|联系电话|联系方式)[:：]\s*([0-9\-\+\s()]{7,20})/i,
            email: /(?:邮箱|Email|E-mail|电子邮件)[:：]\s*([^\n\r\s]+)/i,
            location: /(?:地址|城市|Location|City|现居地|所在地|居住地|籍贯)[:：]\s*([^\n\r]+)/i,
            
            // 求职信息
            jobTitle: /(?:职位|应聘|目标|Position|Job Title|求职意向|应聘岗位|期望职位|意向岗位)[:：]\s*([^\n\r]+)/i,
            salary: /(?:薪资|薪水|Salary|期望薪资|月薪|年薪)[:：]\s*([^\n\r]+)/i,
            
            // 教育信息
            education: /(?:教育|学历|Education|Degree|教育背景|教育经历)[:：]([^\n\r]+)/i,
            university: /(?:学校|大学|University|School|毕业院校)[:：]([^\n\r]+)/i,
            major: /(?:专业|Major|所学专业)[:：]([^\n\r]+)/i,
            
            // 工作信息
            experience: /(?:工作|工作经历|Work Experience|Experience|职业经历|工作经验)[:：]([^\n\r]+)/i,
            skills: /(?:技能|Skills|Skill|专业技能|技术栈|Technical Skills|核心技能|掌握技能)[:：]([^\n\r]+)/i,
            
            // 个人信息
            age: /(?:年龄|Age|出生年份)[:：]\s*(\d{1,3})/i,
            gender: /(?:性别|Gender|Sex)[:：]\s*(男|女|Male|Female|Mr\.?|Ms\.?)/i,
            birthday: /(?:生日|出生日期|Birthday|Date of Birth)[:：]\s*([^\n\r]+)/i
        };
        
        // 常见技能关键词库
        this.skillKeywords = {
            // 编程语言
            languages: ['Java', 'Python', 'JavaScript', 'TypeScript', 'C++', 'C#', 'Go', 'Rust', 'Swift', 'Kotlin', 'PHP', 'Ruby', 'Scala', 'Perl', 'R', 'MATLAB'],
            
            // 前端技术
            frontend: ['React', 'Vue', 'Angular', 'jQuery', 'Bootstrap', 'HTML5', 'CSS3', 'Sass', 'Less', 'Webpack', 'Vite', 'Next.js', 'Nuxt.js', 'Svelte'],
            
            // 后端技术
            backend: ['Node.js', 'Express', 'Koa', 'Spring', 'Spring Boot', 'Django', 'Flask', 'FastAPI', 'Laravel', 'Rails', 'ASP.NET', 'Microservices'],
            
            // 数据库
            database: ['MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Elasticsearch', 'Oracle', 'SQL Server', 'SQLite', 'MariaDB', 'Cassandra', 'Neo4j', 'InfluxDB'],
            
            // 云服务
            cloud: ['AWS', 'Azure', 'Google Cloud', '阿里云', '腾讯云', '华为云', 'Docker', 'Kubernetes', 'Jenkins', 'CI/CD', 'DevOps'],
            
            // 工具和其他
            tools: ['Git', 'Linux', 'Nginx', 'Apache', 'Tomcat', 'Maven', 'Gradle', 'npm', 'yarn', 'pip', 'conda'],
            
            // 数据分析
            data: ['TensorFlow', 'PyTorch', 'Keras', 'Scikit-learn', 'Pandas', 'NumPy', 'Matplotlib', 'Seaborn', 'Plotly', 'Tableau', 'Power BI'],
            
            // 中文技能
            chinese: ['数据分析', '机器学习', '深度学习', '人工智能', '大数据', '云计算', '项目管理', '产品经理', 'UI/UX', '测试', '运维', '敏捷开发', '前端开发', '后端开发', '全栈开发', '移动开发', 'Web开发', '软件工程', '数据库', '算法', '数据结构', '计算机网络', '操作系统', '设计模式', '微服务', 'RESTful', 'GraphQL']
        };
        
        // 所有技能合并
        this.allSkills = [...this.skillKeywords.languages, ...this.skillKeywords.frontend, ...this.skillKeywords.backend, 
                         ...this.skillKeywords.database, ...this.skillKeywords.cloud, ...this.skillKeywords.tools, 
                         ...this.skillKeywords.data, ...this.skillKeywords.chinese];
    }

    async parseResumeContent(content, fileType = 'txt') {
        try {
            if (!content || typeof content !== 'string') {
                return { rawText: '', parseError: '内容为空' };
            }

            content = cleanText(content);
            
            // 预处理和分段
            const sections = this.preprocessContent(content);

            const parsed = {
                rawText: content,
                name: this.extractName(content),
                email: this.extractEmail(content),
                phone: this.extractPhone(content),
                location: this.extractLocation(content),
                age: this.extractAge(content),
                gender: this.extractGender(content),
                birthday: this.extractBirthday(content),
                job_title: this.extractJobTitle(content),
                salary: this.extractSalary(content),
                skills: this.extractSkills(content),
                education: this.extractEducation(content),
                work_experience: this.extractExperience(content),
                experience_years: this.calculateExperienceYears(content),
                summary: this.extractSummary(content),
                sections: sections
            };

            return parsed;
        } catch (error) {
            console.error('简历解析失败:', error);
            return { rawText: content || '', parseError: error.message };
        }
    }

    preprocessContent(content) {
        const sections = {};
        
        // 定义常见的简历段落标题
        const sectionTitles = {
            personal: ['个人信息', '个人资料', '基本信息', 'Personal Information', 'Profile'],
            contact: ['联系方式', '联系信息', 'Contact', 'Contact Information'],
            objective: ['求职意向', '职业目标', 'Objective', 'Career Objective', '求职目标'],
            education: ['教育背景', '教育经历', 'Education', 'Educational Background'],
            experience: ['工作经历', '工作经验', 'Work Experience', 'Professional Experience', '职业经历'],
            skills: ['技能特长', '专业技能', 'Skills', 'Technical Skills', '技能'],
            projects: ['项目经验', '项目经历', 'Projects', 'Project Experience'],
            awards: ['获奖情况', '荣誉奖项', 'Awards', 'Honors'],
            certificates: ['证书资质', '专业证书', 'Certificates', 'Certifications'],
            languages: ['语言能力', '语言技能', 'Languages', 'Language Skills'],
            selfEvaluation: ['自我评价', '个人评价', 'Self Assessment', 'Self Evaluation']
        };
        
        // 提取各个段落
        Object.keys(sectionTitles).forEach(key => {
            const titles = sectionTitles[key];
            const pattern = new RegExp(`(${titles.join('|')})[:：]?([\\s\\S]*?)(?=\\n[A-Za-z\\u4e00-\\u9fa5]{2,20}[:：]|$)`, 'gi');
            const match = content.match(pattern);
            if (match && match[0]) {
                sections[key] = match[0].replace(new RegExp(`(${titles.join('|')})[:：]?`, 'gi'), '').trim();
            }
        });
        
        return sections;
    }

    extractName(content) {
        const patterns = [
            // 中文姓名模式 - 更严格的匹配
            /(?:姓名|Name)[:：]\s*([A-Za-z\u4e00-\u9fa5]{2,6})(?:\s|$)/i,
            /(?:个人简历|简历)\s*([A-Za-z\u4e00-\u9fa5]{2,6})(?:\s|$)/,
            /^([A-Z][a-z]+\s+[A-Z][a-z]+|[A-Z]+\s+[A-Z]+|[\u4e00-\u9fa5]{2,6})(?:\s|$)/m,
            /(?:求职者|应聘者|申请人)[:：]\s*([A-Za-z\u4e00-\u9fa5]{2,6})(?:\s|$)/i,
            
            // 英文姓名模式 - 改进匹配
            /([A-Z][a-z]+\s+[A-Z][a-z]+|[A-Z]+\s+[A-Z]+)(?:\s|$)/,
            
            // 常见简历标题模式
            /\*?\s*([A-Za-z\u4e00-\u9fa5]{2,6})\s*的?\s*(?:简历|CV|Resume)(?:\s|$)/i
        ];

        for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match && match[1]) {
                const name = match[1].trim();
                // 过滤掉明显的非姓名内容
                if (name.length >= 2 && name.length <= 20 && 
                    !name.match(/^[0-9]+$/) && 
                    !name.match(/^(简历|CV|Resume|个人|姓名|性别|年龄|电话|邮箱)$/i) &&
                    !name.match(/公司|有限|集团|大学|学院|专业|学历|技能|经验|工作|教育/)) {
                    return name;
                }
            }
        }
        return '';
    }

    extractEmail(content) {
        // 更严格的邮箱模式
        const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
        const match = content.match(emailPattern);
        return match ? match[1].toLowerCase() : '';
    }

    extractPhone(content) {
        const patterns = [
            // 中国手机号
            /1[3-9]\d{9}/,
            // 带区号的座机
            /0\d{2,3}[-\s]?\d{7,8}/,
            // 国际格式
            /\+?86[-\s]?1[3-9]\d{9}/,
            // 标签模式
            /(?:电话|手机|Phone|Mobile|Tel|联系电话|联系方式)[:：]?\s*([0-9\-\+\s()]{7,20})/i,
            // 通用数字模式
            /(\d{3,4}[-\s]?\d{7,8})/
        ];

        for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match && match[0]) {
                // 清理格式，返回纯数字
                return match[0].replace(/[^0-9]/g, '');
            }
        }
        return '';
    }

    extractLocation(content) {
        const patterns = [
            // 标签模式
            /(?:地址|城市|Location|City|现居地|所在地|居住地|籍贯)[:：]?\s*([^\n\r]+)/i,
            // 中国主要城市
            /(北京|上海|广州|深圳|杭州|成都|重庆|武汉|南京|西安|天津|苏州|长沙|郑州|青岛|大连|厦门|宁波|无锡|济南|哈尔滨|长春|沈阳|石家庄|太原|合肥|南昌|福州|昆明|南宁|贵阳|兰州|海口|呼和浩特|银川|西宁|乌鲁木齐|拉萨)/,
            // 省份模式
            /([^\n\r]{2,10}(?:省|市|自治区|特别行政区))/,
            // 详细地址模式
            /([^\n\r]{5,50}(?:街道|路|区|县|镇|乡|村|号|栋|楼|室))/i
        ];

        for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match && match[1]) {
                const location = match[1].trim();
                if (location.length <= 50 && !location.match(/公司|有限|集团/)) {
                    return location;
                }
            }
        }
        return '';
    }

    extractAge(content) {
        const patterns = [
            /(?:年龄|Age)[:：]?\s*(\d{1,3})/i,
            /(\d{1,2})\s*岁/i,
            /出生年份[:：]?\s*(19\d{2}|20\d{2})/i
        ];

        for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match && match[1]) {
                const age = parseInt(match[1]);
                if (age > 0 && age < 100) {
                    return age;
                }
            }
        }
        return null;
    }

    extractGender(content) {
        const patterns = [
            /(?:性别|Gender|Sex)[:：]?\s*(男|女|Male|Female|Mr\.?|Ms\.?)/i,
            /^(男|女)\s*$/m
        ];

        for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match && match[1]) {
                const gender = match[1].toLowerCase();
                if (gender === '男' || gender === 'male' || gender === 'mr') return '男';
                if (gender === '女' || gender === 'female' || gender === 'ms') return '女';
            }
        }
        return '';
    }

    extractBirthday(content) {
        const patterns = [
            /(?:生日|出生日期|Birthday|Date of Birth)[:：]?\s*([^\n\r]+)/i,
            /(19\d{2}|20\d{2})\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日/i,
            /\d{4}[\-\/]\d{1,2}[\-\/]\d{1,2}/
        ];

        for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match && match[1]) {
                return match[1].trim();
            }
        }
        return '';
    }

    extractJobTitle(content) {
        const patterns = [
            // 标签模式
            /(?:职位|应聘|目标|Position|Job Title|求职意向|应聘岗位|期望职位|意向岗位)[:：]?\s*([^\n\r]+)/i,
            /(?:目前职位|Current Position|现任)[:：]([^\n\r]+)/i,
            /(?:期望职位|Expected Position|目标职位)[:：]([^\n\r]+)/i,
            
            // 常见职位关键词
            /([^\n\r]{2,50}(?:工程师|开发|程序员|架构师|设计师|分析师|经理|主管|总监|专员|顾问|专家))/i,
            
            // 技术职位
            /([^\n\r]{2,50}(?:前端|后端|全栈|移动|Web|软件|系统|数据库|算法|数据|AI|人工智能|机器学习|深度学习))/i
        ];

        for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match && match[1]) {
                const title = match[1].trim();
                if (title.length <= 100 && !title.match(/^[0-9]+$/) && !title.match(/简历|CV|Resume/i)) {
                    return title;
                }
            }
        }
        return '';
    }

    extractSalary(content) {
        const patterns = [
            /(?:薪资|薪水|Salary|期望薪资|月薪|年薪)[:：]?\s*([^\n\r]+)/i,
            /(\d{4,6})\s*元/i,
            /(\d{1,2})\s*K\/月/i,
            /(\d{1,2})\s*万\/年/i
        ];

        for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match && match[1]) {
                return match[1].trim();
            }
        }
        return '';
    }

    extractSkills(content) {
        // 首先提取专门的技能段落
        const skillsSection = this.extractSection(content, ['技能专长', '专业技能', 'Skills', 'Technical Skills', '技能', '技术栈', '核心技能', '掌握技能']);
        
        // 如果没有找到专门的技能段落，使用整个内容
        const targetContent = skillsSection || content;
        
        const patterns = [
            // 标签模式 - 更精确匹配
            /(?:技能专长|技能|Skills|Skill|专业技能|技术栈|Technical Skills|核心技能|掌握技能)[:：]\s*([^\n\r]+)(?:\n|$)/i,
            /(?:熟悉|掌握|精通|了解)\s*([^\n\r]{10,200})(?:\n|$)/i,
            
            // 技术关键词模式
            /(?:编程语言|开发工具|框架|库|数据库|云服务|操作系统|开发环境)[:：]\s*([^\n\r]+)(?:\n|$)/i
        ];

        let allSkills = [];
        
        // 从标签模式提取
        for (const pattern of patterns) {
            const match = targetContent.match(pattern);
            if (match && match[1]) {
                const skillsText = match[1];
                const skills = skillsText.split(/[,，、;；|\/\s]+/)
                    .map(s => s.trim())
                    .filter(s => s.length > 0 && s.length < 30 && !s.match(/^[0-9]+$/) && 
                           !s.match(/^(技能|Skills|Skill|专业技能|技术栈|Technical|核心技能|掌握技能|编程语言|开发工具|框架|库|数据库|云服务|操作系统|开发环境|熟悉|掌握|精通|了解)$/i));
                if (skills.length > 0) {
                    allSkills = allSkills.concat(skills);
                }
            }
        }

        // 如果没有通过标签模式提取到技能，尝试直接从技能段落中提取关键词
        if (allSkills.length === 0 && skillsSection) {
            const skills = skillsSection.split(/[,，、;；|\/\s]+/)
                .map(s => s.trim())
                .filter(s => s.length > 0 && s.length < 30 && !s.match(/^[0-9]+$/) && 
                       !s.match(/^(技能|Skills|Skill|专业技能|技术栈|Technical|核心技能|掌握技能|编程语言|开发工具|框架|库|数据库|云服务|操作系统|开发环境|熟悉|掌握|精通|了解)$/i));
            allSkills = allSkills.concat(skills);
        }

        // 从整个内容中匹配已知技能
        const foundSkills = this.allSkills.filter(skill => 
            content.toLowerCase().includes(skill.toLowerCase())
        );
        
        allSkills = allSkills.concat(foundSkills);
        
        // 去重和清理 - 增强过滤
        const uniqueSkills = [...new Set(allSkills)].filter(skill => 
            skill.length >= 2 && 
            skill.length <= 30 && 
            !skill.match(/^[0-9\s]+$/) && 
            !skill.match(/^(和|与|或|及|等|的|了|在|有|是|我|你|他|她|它|们|这|那|哪|什么|怎么|为什么|哪里|谁|多少|几个|可以|能够|应该|必须|需要|想要|希望|喜欢|爱|恨|感谢|谢谢|对不起|抱歉|你好|再见|早上好|下午好|晚上好|晚安)$/i) &&
            !skill.match(/^(个人优势|自我评价|个人评价|自我评估|个人简介|Summary|Profile|About Me|个人总结|个人介绍|自我介绍)$/i) &&
            !skill.includes('个人优势:')
        );

        return uniqueSkills;
    }

    extractEducation(content) {
        const educationSection = this.extractSection(content, ['教育背景', '教育经历', 'Education', 'Educational Background', '学历信息']);
        
        if (!educationSection) {
            // 如果没有找到专门的教育背景段落，尝试从整个内容中提取
            return this.extractEducationFromFullContent(content);
        }

        const educationItems = [];
        
        // 教育经历模式 - 适应清理后的文本格式
        const patterns = [
            // 时间 + 学校 + 专业 + 学历（处理实际格式：2016.09 - 2020.06 北京大学...）
            /(\d{4})\s*[.-]\s*(\d{2})\s*[-–]\s*(\d{4})\s*[.-]\s*(\d{2})\s*(.+)/i,
            // 简化的时间 + 内容模式
            /(\d{4})\s*.*\s*(\d{4})\s*(.+)/i,
            // 最宽松的模式
            /(\d{4})\s*(.+)/i
        ];

        // 尝试第一种模式（完整日期格式）
        let match = patterns[0].exec(educationSection);
        if (match) {
            const schoolInfo = match[5].trim(); // 完整的教育信息
            const degree = this.extractDegreeFromText(schoolInfo);
            const major = this.extractMajorFromText(schoolInfo);
            
            educationItems.push({
                startYear: match[1] + '.' + match[2], // 2016.09
                endYear: match[3] + '.' + match[4],   // 2020.06
                school: this.extractSchoolFromText(schoolInfo),
                degree: degree,
                major: major,
                gpa: this.extractGPFFromText(schoolInfo)
            });
        }

        // 如果第一种模式没有找到，尝试第二种模式（简化格式）
        if (educationItems.length === 0) {
            match = patterns[1].exec(educationSection);
            if (match) {
                const schoolInfo = match[3].trim();
                const degree = this.extractDegreeFromText(schoolInfo);
                const major = this.extractMajorFromText(schoolInfo);
                
                educationItems.push({
                    startYear: match[1],
                    endYear: match[2],
                    school: this.extractSchoolFromText(schoolInfo),
                    degree: degree,
                    major: major,
                    gpa: this.extractGPFFromText(schoolInfo)
                });
            }
        }

        // 如果第一种模式没有找到，尝试第二种模式（简化格式）
        if (educationItems.length === 0) {
            match = patterns[1].exec(educationSection);
            if (match) {
                const schoolInfo = match[3].trim();
                const degree = this.extractDegreeFromText(schoolInfo);
                const major = this.extractMajorFromText(schoolInfo);
                
                educationItems.push({
                    startYear: match[1],
                    endYear: match[2],
                    school: this.extractSchoolFromText(schoolInfo),
                    degree: degree,
                    major: major,
                    gpa: this.extractGPFFromText(schoolInfo)
                });
            }
        }

        // 如果第二种模式也没有找到，尝试第三种模式（最宽松）
        if (educationItems.length === 0) {
            match = patterns[2].exec(educationSection);
            if (match) {
                const schoolInfo = match[2].trim();
                const degree = this.extractDegreeFromText(schoolInfo);
                const major = this.extractMajorFromText(schoolInfo);
                
                educationItems.push({
                    startYear: match[1],
                    endYear: '至今',
                    school: this.extractSchoolFromText(schoolInfo),
                    degree: degree,
                    major: major,
                    gpa: this.extractGPFFromText(schoolInfo)
                });
            }
        }

        return educationItems.length > 0 ? educationItems : this.extractEducationFromFullContent(content);
    }
    
    extractEducationFromFullContent(content) {
        const educationItems = [];
        
        // 从整个内容中提取教育背景模式
        const patterns = [
            // 时间 + 学校 + 专业模式
            /(\d{4})\s*[-–年至]+\s*(\d{4}|至今|Present|Now)\s*([^。，；\s]+大学|学院|University|College|School)([^。，；]*)/g,
            // 学校 + 专业 + 时间模式
            /([^。，；\s]+大学|学院|University|College|School)[^。，；]*(\d{4})\s*[-–年至]+\s*(\d{4}|至今|Present|Now)/g
        ];

        let match;
        while ((match = patterns[0].exec(content)) !== null) {
            const schoolInfo = match[3].trim() + (match[4] ? match[4].trim() : '');
            const degree = this.extractDegreeFromText(schoolInfo);
            const major = this.extractMajorFromText(schoolInfo);
            
            educationItems.push({
                startYear: match[1],
                endYear: match[2],
                school: this.extractSchoolFromText(schoolInfo),
                degree: degree,
                major: major,
                gpa: ''
            });
        }

        return educationItems;
    }

    extractSchoolFromText(text) {
        const patterns = [
            /([^\n\r]+大学|学院|University|College|School)/i,
            /([^\n\r]+中学|高中|Middle School|High School)/i
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
            /(博士|PhD|Doctorate|博士学位)/i,
            /(硕士|Master|MBA|硕士学位|研究生)/i,
            /(本科|Bachelor|学士学位|本科)/i,
            /(大专|专科|College|Associate|大专学历|专科)/i,
            /(高中|High School|高中学历|中专|技校)/i
        ];

        for (const pattern of patterns) {
            if (pattern.test(text)) {
                return pattern.source.replace(/[\/\|\^]/g, '');
            }
        }
        return '';
    }

    extractMajorFromText(text) {
        const patterns = [
            /([^\n\r]+专业|Major)/i,
            /([^\n\r]+学|科学|工程|技术)/i
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                return match[1].trim();
            }
        }
        return '';
    }

    extractGPFFromText(text) {
        const patterns = [
            /GPA[:：]?\s*([0-4]\.\d{1,2})/i,
            /绩点[:：]?\s*([0-4]\.\d{1,2})/i,
            /(\d\.\d{1,2})\s*\/\s*4/i
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }
        return '';
    }

    extractExperience(content) {
        const experienceSection = this.extractSection(content, ['工作经历', '工作经验', 'Work Experience', 'Professional Experience', '职业经历', '工作']);

        if (!experienceSection) {
            // 如果没有找到专门的工作经历段落，尝试从整个内容中提取
            return this.extractExperienceFromFullContent(content);
        }

        const experienceItems = [];
        
        // 工作经历模式 - 适应清理后的文本格式
        const patterns = [
            // 时间 + 公司 + 职位（处理实际格式：2020.07 - 至今 腾讯科技有限公司...）
            /(\d{4})\s*[.-]\s*(\d{2})\s*[-–]\s*(\d{4}|至今|Present|Now)\s*[.-]\s*(?:\d{2})?\s*(.+)/i,
            // 简化的时间 + 内容模式
            /(\d{4})\s*.*\s*(\d{4}|至今|Present|Now)\s*(.+)/i,
            // 最宽松的模式
            /(\d{4})\s*(.+)/i
        ];

        // 尝试第一种模式（完整日期格式）
        let match = patterns[0].exec(experienceSection);
        if (match) {
            const companyInfo = match[4].trim(); // 完整的工作信息
            
            experienceItems.push({
                startYear: match[1] + '.' + match[2], // 2020.07
                endYear: match[3],                    // 至今
                company: this.extractCompanyFromText(companyInfo),
                position: this.extractPositionFromText(companyInfo),
                description: this.extractJobDescription(experienceSection)
            });
        }

        // 如果第一种模式没有找到，尝试第二种模式（简化格式）
        if (experienceItems.length === 0) {
            match = patterns[1].exec(experienceSection);
            if (match) {
                const companyInfo = match[3].trim();
                
                experienceItems.push({
                    startYear: match[1],
                    endYear: match[2],
                    company: this.extractCompanyFromText(companyInfo),
                    position: this.extractPositionFromText(companyInfo),
                    description: this.extractJobDescription(experienceSection)
                });
            }
        }

        // 如果第二种模式也没有找到，尝试第三种模式（最宽松）
        if (experienceItems.length === 0) {
            match = patterns[2].exec(experienceSection);
            if (match) {
                const companyInfo = match[2].trim();
                
                experienceItems.push({
                    startYear: match[1],
                    endYear: '至今',
                    company: this.extractCompanyFromText(companyInfo),
                    position: this.extractPositionFromText(companyInfo),
                    description: this.extractJobDescription(experienceSection)
                });
            }
        }

        return experienceItems.length > 0 ? experienceItems : this.extractExperienceFromFullContent(content);
    }
    
    extractExperienceFromFullContent(content) {
        const experienceItems = [];
        
        // 从整个内容中提取工作经历模式
        const patterns = [
            // 时间 + 公司 + 职位模式
            /(\d{4})\s*[-–年至]+\s*(\d{4}|至今|Present|Now)\s*([^。，；\s]+公司|有限公司)([^。，；]*)/g,
            // 公司 + 职位 + 时间模式  
            /([^。，；\s]+公司|有限公司)[^。，；]*(\d{4})\s*[-–年至]+\s*(\d{4}|至今|Present|Now)/g
        ];

        let match;
        while ((match = patterns[0].exec(content)) !== null) {
            experienceItems.push({
                startYear: match[1],
                endYear: match[2],
                company: match[3].trim(),
                position: match[4] ? match[4].trim() : '',
                description: ''
            });
        }

        return experienceItems;
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
            /([^\n\r]+工程师|开发|程序员|架构师|设计师|分析师|经理|主管|总监|专员|顾问|专家)/i,
            /([^\n\r]+职位|岗位|职务)/i
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                return match[1].trim();
            }
        }
        return '';
    }

    extractJobDescription(text) {
        // 提取职位描述 - 移除时间和公司信息后的剩余内容
        const patterns = [
            // 移除时间信息
            /\d{4}\s*[.-]\s*\d{2}\s*[-–]\s*(?:\d{4}|至今|Present|Now)\s*[.-]\s*(?:\d{2})?\s*/i,
            // 移除公司信息（简化处理）
            /([^\s]+公司|有限公司|Co\.|Ltd\.)/i
        ];
        
        let description = text;
        for (const pattern of patterns) {
            description = description.replace(pattern, '');
        }
        
        return description.trim();
    }

    extractSection(content, sectionNames) {
        for (const name of sectionNames) {
            // 尝试不同的匹配模式以适应清理后的文本格式
            const patterns = [
                // 模式1: 匹配到下一个段落标题（使用正向预查）
                new RegExp(`${name}[:：]\\s*([\\s\\S]*?)(?=(?:${this.getAllSectionHeaders().join('|')})|$)`, 'i'),
                // 模式2: 匹配到下一个段落标题或句子结束（更宽松）
                new RegExp(`${name}[:：]\\s*([^.。！？;；]{5,1000}?)(?=[.。！？;；]|(?:${this.getAllSectionHeaders().join('|')})|$)`, 'i'),
                // 模式3: 匹配单行内容
                new RegExp(`${name}[:：]\\s*([^\\n\\r]+?)(?:\\n|$)`, 'i'),
                // 模式4: 匹配到特定长度限制
                new RegExp(`${name}[:：]\\s*([^。，；\\n\\r]{5,1000})(?=[。，；]|$)`, 'i')
            ];
            
            for (const regex of patterns) {
                const match = content.match(regex);
                if (match && match[1]) {
                    const section = match[1].trim();
                    if (section.length > 0 && section.length < 2000) {
                        // 清理段落内容，移除其他段落标题
                        const cleanedSection = this.cleanSectionContent(section);
                        if (cleanedSection.length > 0) {
                            return cleanedSection;
                        }
                    }
                }
            }
        }
        
        return null;
    }
    
    getAllSectionHeaders() {
        return [
            '个人信息', '个人资料', '基本信息', 'Personal Information', 'Profile',
            '联系方式', '联系信息', 'Contact', 'Contact Information',
            '求职意向', '职业目标', 'Objective', 'Career Objective', '求职目标',
            '教育背景', '教育经历', 'Education', 'Educational Background', '学历信息',
            '工作经历', '工作经验', 'Work Experience', 'Professional Experience', '职业经历', '工作',
            '技能特长', '专业技能', 'Skills', 'Technical Skills', '技能',
            '项目经验', '项目经历', 'Projects', 'Project Experience',
            '获奖情况', '荣誉奖项', 'Awards', 'Honors',
            '证书资质', '专业证书', 'Certificates', 'Certifications',
            '语言能力', '语言技能', 'Languages', 'Language Skills',
            '自我评价', '个人评价', 'Self Assessment', 'Self Evaluation',
            '个人优势', '个人简介', 'Summary', 'Profile', 'About Me', '个人总结', '个人介绍', '自我介绍'
        ];
    }
    
    cleanSectionContent(content) {
        // 移除其他段落标题
        const headers = this.getAllSectionHeaders();
        let cleaned = content;
        
        for (const header of headers) {
            const headerRegex = new RegExp(`${header}[:：]?\\s*`, 'gi');
            cleaned = cleaned.replace(headerRegex, '');
        }
        
        return cleaned.trim();
    }

    calculateExperienceYears(content) {
        const experienceSection = this.extractSection(content, ['工作经历', '工作经验', 'Work Experience', 'Professional Experience', '职业经历']);
        
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

        return Math.min(totalYears, 50); // 限制最大50年
    }

    extractSummary(content) {
        const summarySection = this.extractSection(content, ['个人简介', '自我评价', 'Summary', 'Profile', 'About Me', '个人总结', '个人介绍', '自我介绍']);
        
        if (summarySection) {
            return summarySection.substring(0, 500);
        }

        // 如果没有明确的自我评价段落，提取第一段较长的文字
        const firstParagraph = content.match(/^([^\n\r]{50,500})/);
        return firstParagraph ? firstParagraph[1] : '';
    }
}

module.exports = EnhancedResumeParseService;