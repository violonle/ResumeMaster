const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

async function checkSkillsFormat() {
  return new Promise((resolve, reject) => {
    db.get("SELECT id, file_name, skills, typeof(skills) as skills_type FROM resumes WHERE id = 70", (err, row) => {
      if (err) {
        reject(err);
      } else {
        console.log('=== 简历ID 70 - Skills字段格式检查 ===');
        if (row) {
          console.log('ID:', row.id);
          console.log('文件名:', row.file_name);
          console.log('skills字段值:', row.skills);
          console.log('skills类型:', row.skills_type);
          
          if (row.skills) {
            console.log('skills长度:', row.skills.length);
            console.log('skills前100字符:', row.skills.substring(0, 100));
            
            // 尝试解析JSON
            try {
              const parsed = JSON.parse(row.skills);
              console.log('JSON解析成功，类型:', typeof parsed);
              console.log('JSON内容:', parsed);
              console.log('是否为数组:', Array.isArray(parsed));
              if (Array.isArray(parsed)) {
                console.log('数组长度:', parsed.length);
                console.log('数组元素:', parsed);
              }
            } catch (e) {
              console.log('JSON解析失败:', e.message);
            }
          }
        } else {
          console.log('未找到ID为70的简历');
        }
        resolve(row);
      }
    });
  });
}

async function checkAllResumesWithSkills() {
  return new Promise((resolve, reject) => {
    db.all("SELECT id, file_name, skills FROM resumes WHERE skills IS NOT NULL AND skills != '' LIMIT 5", (err, rows) => {
      if (err) {
        reject(err);
      } else {
        console.log('\n=== 所有包含skills的简历 ===');
        rows.forEach(row => {
          console.log(`ID: ${row.id}, 文件名: ${row.file_name}, skills: ${row.skills}`);
        });
        resolve(rows);
      }
    });
  });
}

async function main() {
  try {
    await checkSkillsFormat();
    await checkAllResumesWithSkills();
  } catch (err) {
    console.error('查询失败:', err);
  } finally {
    db.close();
  }
}

main();
