// Debug name extraction
const text = `
JOHN SMITH
Software Engineer

Contact:
Email: john.smith@email.com
Phone: +1-555-123-4567
Location: San Francisco, CA`;

const patterns = [
    /^\s*([A-Z][a-z]+\s+[A-Z][a-z]+)(?:\n|$)/i,  // 英文姓名在文档开头（首字母大写）
    /^\s*([A-Z]+\s+[A-Z]+)(?:\n|$)/i,  // 英文全大写姓名在文档开头
    /^\s*([\u4e00-\u9fa5]{2,4})(?:\n|$)/i  // 中文姓名在文档开头
];

console.log('Testing text:', JSON.stringify(text));
console.log('');

for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    console.log(`Pattern ${i + 1}: ${pattern}`);
    const matches = text.match(pattern);
    if (matches) {
        console.log('Match found:', matches[1]);
    } else {
        console.log('No match');
    }
    console.log('');
}