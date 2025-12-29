const { Resume } = require('./models');
const sequelize = require('./config/db');
const OptimizedResumeParseService = require('./services/optimizedResumeParseService');

async function reparseResume94() {
    try {
        console.log('Starting to reparse resume ID 94...');
        
        await sequelize.authenticate();
        console.log('Database connected successfully.');

        const resume = await Resume.findByPk(94);
        
        if (!resume) {
            console.error('Resume with ID 94 not found');
            process.exit(1);
        }

        console.log('Resume found:', resume.name);
        console.log('Raw text length:', resume.raw_text ? resume.raw_text.length : 0);

        const parser = new OptimizedResumeParseService();
        const parsedData = await parser.parseResumeContent(resume.raw_text);

        console.log('\n=== Parsed Skills ===');
        console.log(JSON.stringify(parsedData.skills, null, 2));

        console.log('\n=== Parsed Education ===');
        console.log(JSON.stringify(parsedData.education, null, 2));

        console.log('\n=== Parsed Projects ===');
        console.log(JSON.stringify(parsedData.projects, null, 2));

        await resume.update({
            parsed_data: parsedData,
            skills: JSON.stringify(parsedData.skills || []),
            education: JSON.stringify(parsedData.education || []),
            projects: JSON.stringify(parsedData.projects || []),
            work_experience: JSON.stringify(parsedData.workExperience || []),
            updated_at: new Date()
        });

        console.log('\n✓ Resume 94 has been reparsed and updated successfully!');

        await sequelize.close();
        process.exit(0);
    } catch (error) {
        console.error('Error reparsing resume:', error);
        process.exit(1);
    }
}

reparseResume94();