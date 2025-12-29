const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

async function checkSkillsField() {
  return new Promise((resolve, reject) => {
    db.get("SELECT id, skills, parsed_data FROM resumes WHERE id = 70", (err, row) => {
      if (err) {
        reject(err);
      } else {
        console.log('=== 简历ID 70 (直接查询SQLite) ===');
        console.log('skills字段 (原始):', row.skills);
        console.log('skills类型:', typeof row.skills);
        console.log('parsed_data字段 (原始):', row.parsed_data);
        console.log('parsed_data类型:', typeof row.parsed_data);
        
        if (row.skills) {
          try {
            const parsedSkills = JSON.parse(row.skills);
            console.log('skills解析后:', parsedSkills);
          } catch (e) {
            console.log('skills解析失败:', e.message);
          }
        }
        
        if (row.parsed_data) {
          try {
            const parsedData = JSON.parse(row.parsed_data);
            console.log('parsed_data解析后.skills:', parsedData.skills);
          } catch (e) {
            console.log('parsed_data解析失败:', e.message);
          }
        }
        
        resolve(row);
      }
    });
  });
}

checkSkillsField()
  .then(() => {
    db.close();
  })
  .catch(err => {
    console.error('查询失败:', err);
    db.close();
  });