const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../database.sqlite');
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

checkTables()
  .then(() => {
    db.close();
  })
  .catch(err => {
    console.error('查询失败:', err);
    db.close();
  });