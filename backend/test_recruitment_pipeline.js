const express = require('express');
const { Resume } = require('./models');
const { authenticate } = require('./middleware/auth');
const Permission = require('./middleware/permission');

async function testRecruitmentPipeline() {
    try {
        console.log('Testing recruitment pipeline API endpoint...\n');
        
        const userId = 5;
        const companyId = 8;
        
        console.log(`User ID: ${userId}, Company ID: ${companyId}`);
        
        const whereClause = {
            user_id: userId
        };

        if (companyId) {
            whereClause.company_id = companyId;
        }

        console.log('\nWhere clause:', whereClause);

        const resumes = await Resume.findAll({
            where: whereClause,
            order: [['upload_date', 'DESC']],
            attributes: [
                'id', 'name', 'file_name', 'email', 'phone', 'job_title', 
                'recruitment_status', 'upload_date', 'parsed_data'
            ]
        });

        console.log(`\nFound ${resumes.length} resumes\n`);

        const statusGroups = {
            '投递': [],
            '快评': [],
            '面试': [],
            'Offer': [],
            '入职': [],
            '淘汰': []};

        resumes.forEach(resume => {
            const status = resume.recruitment_status || '投递';
            if (statusGroups[status]) {
                const parsedData = resume.parsed_data || {};
                statusGroups[status].push({
                    id: resume.id,
                    name: resume.name || parsedData.name || resume.file_name || '未命名',
                    file_name: resume.file_name,
                    email: resume.email || parsedData.email || '',
                    phone: resume.phone || parsedData.phone || '',
                    job_title: resume.job_title || parsedData.jobTitle || parsedData.position || '职位未知',
                    position: resume.job_title || parsedData.jobTitle || parsedData.position || '职位未知',
                    recruitment_status: resume.recruitment_status,
                    upload_date: resume.upload_date,
                    parsed_data: parsedData
                });
            }
        });

        console.log('Status Groups:');
        Object.keys(statusGroups).forEach(status => {
            console.log(`\n${status}: ${statusGroups[status].length} candidates`);
            if (statusGroups[status].length > 0) {
                statusGroups[status].forEach(item => {
                    console.log(`  - ID: ${item.id}, Name: ${item.name}, Status: ${item.recruitment_status}`);
                });
            }
        });

        console.log('\n✓ Test completed successfully!');
        
        process.exit(0);
    } catch (error) {
        console.error('Error testing recruitment pipeline:', error);
        process.exit(1);
    }
}

testRecruitmentPipeline();
