const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

async function checkResume70() {
  return new Promise((resolve, reject) => {
    db.get("SELECT id, file_name, skills FROM resumes WHERE id = 70", (err, row) => {
      if (err) {
        reject(err);
      } else {
        console.log('=== 简历ID 70 ===');
        if (row) {
          console.log('ID:', row.id);
          console.log('文件名:', row.file_name);
          console.log('skills字段:', row.skills);
          console.log('skills类型:', typeof row.skills);
          if (row.skills) {
            console.log('skills长度:', row.skills.length);
          }
        } else {
          console.log('未找到ID为70的简历');
        }
        resolve(row);
      }
    });
  });
}

async function main() {
  try {
    await checkResume70();
  } catch (err) {
    console.error('查询失败:', err);
  } finally {
    db.close();
  }
}

main();
