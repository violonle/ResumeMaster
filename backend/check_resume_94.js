const fs = require('fs');
const path = require('path');
const { sequelize, Resume } = require('./models/index');

async function checkResumeData() {
    try {
        await sequelize.authenticate();
        console.log('数据库连接成功');
        
        const resume = await Resume.findByPk(94);
        if (!resume) {
            console.log('未找到ID为94的简历');
            return;
        }
        
        console.log('=== 简历基本信息 ===');
        console.log('ID:', resume.id);
        console.log('姓名:', resume.name);
        console.log('邮箱:', resume.email);
        console.log('电话:', resume.phone);
        
        console.log('\n=== 简历原始内容 ===');
        console.log('原始内容长度:', resume.raw_text ? resume.raw_text.length : 0);
        console.log('原始内容前500字符:', resume.raw_text ? resume.raw_text.substring(0, 500) : '');
        
        console.log('\n=== 解析后的数据 ===');
        console.log('工作经历:', resume.work_experience ? JSON.stringify(resume.work_experience, null, 2) : 'null');
        console.log('教育经历:', resume.education ? JSON.stringify(resume.education, null, 2) : 'null');
        console.log('项目经历:', resume.projects ? JSON.stringify(resume.projects, null, 2) : 'null');
        console.log('技能:', resume.skills ? JSON.stringify(resume.skills, null, 2) : 'null');
        console.log('工作年限:', resume.experience_years);
        
        console.log('\n=== 检查原始内容中是否包含教育背景 ===');
        if (resume.raw_text) {
            console.log('是否包含"教育背景":', resume.raw_text.includes('教育背景'));
            console.log('是否包含"教育":', resume.raw_text.includes('教育'));
            console.log('是否包含"学历":', resume.raw_text.includes('学历'));
            console.log('是否包含"Education":', resume.raw_text.includes('Education'));
            
            const educationIndex = resume.raw_text.indexOf('教育背景');
            if (educationIndex >= 0) {
                console.log('教育背景位置:', educationIndex);
                console.log('教育背景附近内容:', resume.raw_text.substring(educationIndex, educationIndex + 200));
            }
        }
        
        await sequelize.close();
    } catch (error) {
        console.error('错误:', error);
    }
}

checkResumeData();