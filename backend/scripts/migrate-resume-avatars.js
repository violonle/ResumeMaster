/**
 * 数据库迁移脚本：为现有简历分配头像
 * 运行方式：node backend/scripts/migrate-resume-avatars.js
 */

const { Resume } = require('../models');
const { Op } = require('sequelize');

async function migrateResumeAvatars() {
  console.log('开始为现有简历分配头像...');
  
  try {
    // 获取所有没有头像或头像格式不对的简历
    const resumes = await Resume.findAll({
      where: {
        [Op.or]: [
          { avatar: { [Op.is]: null } },
          { avatar: { [Op.eq]: '' } },
          { avatar: { [Op.like]: '/dist/avatar/%' } },
          { avatar: { [Op.like]: '%avatar01.png' } }
        ]
      }
    });
    
    console.log(`找到 ${resumes.length} 条需要更新头像的简历`);
    
    let updated = 0;
    for (const resume of resumes) {
      // 使用名称进行哈希，确保同一个人的头像是一致的
      const name = resume.name || resume.file_name || '';
      let avatarIndex = 1;
      
      if (name) {
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
          hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        avatarIndex = Math.abs(hash % 12) + 1;
      } else {
        avatarIndex = Math.floor(Math.random() * 12) + 1;
      }
      
      const newAvatar = `/avatars/${avatarIndex}.svg`;
      
      await resume.update({ avatar: newAvatar });
      updated++;
      
      if (updated % 100 === 0) {
        console.log(`已更新 ${updated} 条简历...`);
      }
    }
    
    console.log(`✅ 成功为 ${updated} 条简历分配了头像`);
    
    // 统计现有头像分布
    const distribution = await Resume.findAll({
      attributes: ['avatar', [require('sequelize').fn('COUNT', '*'), 'count']],
      group: ['avatar'],
      where: {
        avatar: { [Op.like]: '/avatars/%' }
      }
    });
    
    console.log('\n头像分布统计：');
    for (const row of distribution) {
      console.log(`  ${row.avatar}: ${row.dataValues.count} 条`);
    }
    
  } catch (error) {
    console.error('❌ 迁移失败:', error);
    throw error;
  }
}

// 直接运行
migrateResumeAvatars()
  .then(() => {
    console.log('\n迁移完成');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n迁移出错:', err);
    process.exit(1);
  });
