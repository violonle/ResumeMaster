const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

async function checkResume70UserId() {
  return new Promise((resolve, reject) => {
    db.get("SELECT id, file_name, user_id, company_id FROM resumes WHERE id = 70", (err, row) => {
      if (err) {
        reject(err);
      } else {
        console.log('=== 简历ID 70 的用户信息 ===');
        if (row) {
          console.log('ID:', row.id);
          console.log('文件名:', row.file_name);
          console.log('user_id:', row.user_id);
          console.log('company_id:', row.company_id);
        } else {
          console.log('未找到ID为70的简历');
        }
        resolve(row);
      }
    });
  });
}

async function checkAllUsers() {
  return new Promise((resolve, reject) => {
    db.all("SELECT id, username, role, company_id FROM users LIMIT 5", (err, rows) => {
      if (err) {
        reject(err);
      } else {
        console.log('\n=== 用户列表 ===');
        rows.forEach(row => {
          console.log(`ID: ${row.id}, 用户名: ${row.username}, 角色: ${row.role}, 公司ID: ${row.company_id}`);
        });
        resolve(rows);
      }
    });
  });
}

async function main() {
  try {
    await checkResume70UserId();
    await checkAllUsers();
  } catch (err) {
    console.error('查询失败:', err);
  } finally {
    db.close();
  }
}

main();
