// Test the actual parser with debug output
const OptimizedResumeParseService = require('../services/optimizedResumeParseService');

async function debugParser() {
    const parser = new OptimizedResumeParseService();
    
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

    console.log('Original text:');
    console.log(JSON.stringify(testResume2));
    console.log('');
    
    // Test name extraction directly
    const { cleanText } = require('../services/enhancedTextExtractor');
    const cleanedText = cleanText(testResume2);
    
    console.log('Cleaned text:');
    console.log(JSON.stringify(cleanedText));
    console.log('');
    
    // Test name patterns directly
    const namePatterns = [
        /^\s*([A-Z][a-z]+\s+[A-Z][a-z]+)(?:\n|$)/i,  // 英文姓名在文档开头（首字母大写）
        /^\s*([A-Z]+\s+[A-Z]+)(?:\n|$)/i,  // 英文全大写姓名在文档开头
        /^\s*([\u4e00-\u9fa5]{2,4})(?:\n|$)/i  // 中文姓名在文档开头
    ];
    
    console.log('Testing name patterns on cleaned text:');
    for (let i = 0; i < namePatterns.length; i++) {
        const pattern = namePatterns[i];
        const matches = [];
        let match;
        
        pattern.lastIndex = 0;
        
        while ((match = pattern.exec(cleanedText)) !== null) {
            if (match[1] || match[0]) {
                matches.push(match[1] || match[0]);
            }
            if (matches.length > 10) break;
        }
        
        console.log(`Pattern ${i + 1}: ${pattern}`);
        console.log('Matches:', matches);
    }
    console.log('');
    
    // Run full parser
    console.log('Running full parser:');
    const result = await parser.parseResume(testResume2);
    console.log('Final result:', result.name);
}

debugParser().catch(console.error);