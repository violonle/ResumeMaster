// Debug the actual parsing logic
const text = `
JOHN SMITH
Software Engineer

Contact:
Email: john.smith@email.com
Phone: +1-555-123-4567
Location: San Francisco, CA`;

// Simulate the exact parsing logic
const patterns = [
    /^\s*([A-Z][a-z]+\s+[A-Z][a-z]+)(?:\n|$)/i,  // 英文姓名在文档开头（首字母大写）
    /^\s*([A-Z]+\s+[A-Z]+)(?:\n|$)/i,  // 英文全大写姓名在文档开头
    /^\s*([\u4e00-\u9fa5]{2,4})(?:\n|$)/i  // 中文姓名在文档开头
];

const validators = [
    (name) => name.length >= 2 && name.length <= 50,
    (name) => !name.match(/^\d+$/), // 不能全是数字
    (name) => !name.match(/公司|有限|集团|大学|学院|学校|University|College|School/i) // 不能是公司或学校名称
];

console.log('Text to parse:', JSON.stringify(text));
console.log('');

for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    console.log(`Testing pattern ${i + 1}: ${pattern}`);
    
    const matches = [];
    let match;
    
    // Reset regex
    pattern.lastIndex = 0;
    
    while ((match = pattern.exec(text)) !== null) {
        if (match[1] || match[0]) {
            matches.push(match[1] || match[0]);
        }
        if (matches.length > 10) break;
    }
    
    console.log('Found matches:', matches);
    
    for (const candidate of matches) {
        const cleanedCandidate = candidate.trim();
        console.log(`Testing candidate: "${cleanedCandidate}"`);
        
        // Test validators
        const validator1 = cleanedCandidate.length >= 2 && cleanedCandidate.length <= 50;
        const validator2 = !cleanedCandidate.match(/^\d+$/);
        const validator3 = !cleanedCandidate.match(/公司|有限|集团|大学|学院|学校|University|College|School/i);
        
        console.log(`  Length validator: ${validator1}`);
        console.log(`  Number validator: ${validator2}`);
        console.log(`  University validator: ${validator3}`);
        
        const isValid = validator1 && validator2 && validator3;
        console.log(`  Overall valid: ${isValid}`);
        
        if (isValid) {
            console.log(`  ✓ VALID NAME FOUND: "${cleanedCandidate}"`);
        }
        console.log('');
    }
}