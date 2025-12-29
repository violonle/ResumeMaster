const OptimizedResumeParseService = require('../services/optimizedResumeParseService');

async function testOptimizedParser() {
    console.log('=== 测试优化简历解析器 ===\n');
    
    const parser = new OptimizedResumeParseService();
    
    // 测试用例1：标准中文简历
    const testResume1 = `
    个人简历
    
    姓名：张三
    性别：男
    年龄：28岁
    电话：13812345678
    邮箱：zhangsan@example.com
    现居地：北京市海淀区
    
    教育背景：
    2016.09 - 2020.06 北京大学 计算机科学与技术 本科
    
    工作经历：
    2020.07 - 至今 腾讯科技有限公司 软件工程师
    负责后端服务开发和维护，参与多个重要项目
    
    技能专长：
    Java, Python, JavaScript, React, Spring Boot, MySQL, Redis
    
    个人优势：
    具备扎实的编程基础和良好的团队合作能力，学习能力强，能够快速适应新技术
    `;

    // 测试用例2：英文简历
    const testResume2 = `
    JOHN SMITH
    Software Engineer
    
    Contact:
    Email: john.smith@email.com
    Phone: +1-555-123-4567
    Location: San Francisco, CA
    
    EDUCATION:
    Bachelor of Science in Computer Science
    Stanford University, 2018-2022
    
    WORK EXPERIENCE:
    2022-Present: Google Inc. - Software Engineer
    Working on cloud infrastructure and distributed systems
    
    SKILLS:
    Python, Java, Go, Kubernetes, AWS, Docker, SQL
    
    STRENGTHS:
    Strong problem-solving skills, excellent communication, team leadership experience
    `;

    // 测试用例3：复杂格式简历
    const testResume3 = `
    【个人信息】
    姓名：李四
    联系方式：
    • 手机：13987654321  
    • 邮箱：lisi.work@company.com
    • 地址：上海市浦东新区陆家嘴金融区
    
    【求职意向】
    高级前端开发工程师
    
    【教育经历】
    2014年9月 - 2018年7月
    上海交通大学 软件工程 学士学位
    
    【工作经历】  
    2018年8月 - 2021年12月
    阿里巴巴（中国）有限公司
    职位：前端开发工程师
    工作内容：负责电商平台前端开发，使用React、Vue等技术栈
    
    2022年1月 - 至今
    字节跳动科技有限公司  
    职位：高级前端开发工程师
    工作内容：负责短视频平台前端架构设计和开发
    
    【专业技能】
    前端：HTML5, CSS3, JavaScript ES6+, TypeScript, React, Vue.js, Angular, Webpack
    后端：Node.js, Express, MongoDB, MySQL
    工具：Git, Docker, Jenkins, Jira, Confluence
    语言：英语(CET-6), 普通话(母语)
    
    【自我评价】
    拥有5年前端开发经验，精通主流前端技术栈，具备良好的代码规范和团队协作能力。
    对新技术保持学习热情，能够快速适应业务变化和技术更新。
    `;

    const testCases = [
        { name: '标准中文简历', content: testResume1 },
        { name: '英文简历', content: testResume2 },
        { name: '复杂格式简历', content: testResume3 }
    ];

    for (const testCase of testCases) {
        console.log(`\n--- 测试: ${testCase.name} ---`);
        try {
            const result = await parser.parseResume(testCase.content);
            const stats = parser.getParsingStats(result);
            
            console.log('解析结果:');
            console.log(`姓名: ${result.name || '未提取'}`);
            console.log(`邮箱: ${result.email || '未提取'}`);
            console.log(`电话: ${result.phone || '未提取'}`);
            console.log(`城市: ${result.location || '未提取'}`);
            console.log(`工作经验: ${result.experience ? result.experience.substring(0, 50) + '...' : '未提取'}`);
            console.log(`学历: ${result.education || '未提取'}`);
            console.log(`技能: ${result.skills || '未提取'}`);
            console.log(`工作经历: ${result.workExperience ? result.workExperience.substring(0, 50) + '...' : '未提取'}`);
            console.log(`教育经历: ${result.educationExperience ? result.educationExperience.substring(0, 50) + '...' : '未提取'}`);
            console.log(`个人优势: ${result.personalStrengths ? result.personalStrengths.substring(0, 50) + '...' : '未提取'}`);
            
            console.log('\n统计信息:');
            console.log(`提取成功率: ${stats.successRate}%`);
            console.log(`提取字段: ${stats.extractedFieldsList.join(', ')}`);
            console.log(`缺失字段: ${stats.missingFields.join(', ')}`);
            
            // 验证结果
            const validation = parser.validateResult(result);
            console.log(`验证结果: ${validation.isValid ? '通过' : '失败'}`);
            if (!validation.isValid) {
                console.log(`错误: ${validation.errors.join(', ')}`);
            }
            
        } catch (error) {
            console.error(`解析失败: ${error.message}`);
        }
    }
}

// 运行测试
testOptimizedParser().catch(console.error);