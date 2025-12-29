const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

async function checkTables() {
  return new Promise((resolve, reject) => {
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
      if (err) {
        reject(err);
      } else {
        console.log('=== 数据库中的所有表 ===');
        rows.forEach(row => {
          console.log('-', row.name);
        });
        resolve(rows);
      }
    });
  });
}

async function checkResumesTable() {
  return new Promise((resolve, reject) => {
    db.all("PRAGMA table_info('resumes')", (err, rows) => {
      if (err) {
        reject(err);
      } else {
        console.log('\n=== resumes 表结构 ===');
        rows.forEach(row => {
          console.log(`- ${row.name}: ${row.type}`);
        });
        resolve(rows);
      }
    });
  });
}

async function checkResumeCount() {
  return new Promise((resolve, reject) => {
    db.get("SELECT COUNT(*) as count FROM resumes", (err, row) => {
      if (err) {
        reject(err);
      } else {
        console.log('\n=== resumes 表记录数 ===');
        console.log('总记录数:', row.count);
        resolve(row);
      }
    });
  });
}

async function checkResume70() {
  return new Promise((resolve, reject) => {
    db.get("SELECT id, file_name, skills, parsed_data FROM resumes WHERE id = 70", (err, row) => {
      if (err) {
        reject(err);
      } else {
        console.log('\n=== 简历ID 70 ===');
        if (row) {
          console.log('ID:', row.id);
          console.log('文件名:', row.file_name);
          console.log('skills字段:', row.skills);
          console.log('parsed_data:', row.parsed_data);
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
    await checkTables();
    await checkResumesTable();
    await checkResumeCount();
    await checkResume70();
  } catch (err) {
    console.error('查询失败:', err);
  } finally {
    db.close();
  }
}

main();
