const { sequelize, Resume } = require('./models');

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

function extractAllSections(content) {
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

    console.log('\n=== Section Extraction Debug ===');
    console.log('Text length:', content.length);

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
                    console.log(`Found section "${section}" at position ${matchIndex}`);
                    console.log(`  -> Saved ${beforeMatch.length} characters to section "${currentSection}"`);
                }
            }
            
            currentSection = section;
            remainingText = remainingText.substring(matchIndex + match[0].length).trim();
            console.log(`  -> Switched to section "${section}"`);
        }
    }
    
    if (remainingText.length > 0) {
        sections[currentSection] = remainingText;
        console.log(`Final: Saved ${remainingText.length} characters to section "${currentSection}"`);
    }

    console.log('\n=== Section Results ===');
    for (const [section, content] of Object.entries(sections)) {
        console.log(`${section}: ${content.length} characters`);
    }

    return sections;
}

async function testSectionExtraction() {
  try {
    await sequelize.authenticate();
    
    const resume = await Resume.findByPk(70);
    if (!resume) {
      console.log('未找到ID为70的简历');
      return;
    }

    const content = cleanTextPreserveNewlines(resume.raw_text);
    console.log('=== 原始文本 ===');
    console.log('文本长度:', content.length);
    
    const sections = extractAllSections(content);
    
    console.log('\n=== 个人优势 ===');
    console.log('长度:', sections.summary.length);
    console.log('前200字符:', sections.summary.substring(0, 200));
    
    console.log('\n=== 工作经历 ===');
    console.log('长度:', sections.experience.length);
    console.log('前200字符:', sections.experience.substring(0, 200));
    
    console.log('\n=== 项目经历 ===');
    console.log('长度:', sections.projects.length);
    console.log('前200字符:', sections.projects.substring(0, 200));
    
    console.log('\n=== 教育经历 ===');
    console.log('长度:', sections.education.length);
    console.log('前200字符:', sections.education.substring(0, 200));
    
    await sequelize.close();
  } catch (err) {
    console.error('测试失败:', err);
  }
}

testSectionExtraction();
