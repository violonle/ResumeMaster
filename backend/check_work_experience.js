const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

async function checkWorkExperience() {
  return new Promise((resolve, reject) => {
    db.get("SELECT id, file_name, work_experience, parsed_data FROM resumes WHERE id = 70", (err, row) => {
      if (err) {
        reject(err);
      } else {
        console.log('=== 简历ID 70 - 工作经历检查 ===');
        if (row) {
          console.log('ID:', row.id);
          console.log('文件名:', row.file_name);
          
          console.log('\n=== work_experience字段 ===');
          if (row.work_experience) {
            try {
              const workExp = JSON.parse(row.work_experience);
              console.log('类型:', typeof workExp);
              console.log('是否为数组:', Array.isArray(workExp));
              console.log('数量:', workExp.length);
              console.log('内容:');
              workExp.forEach((exp, i) => {
                console.log(`  ${i+1}. 公司: ${exp.company || exp.name || '未知'}, 职位: ${exp.jobTitle || exp.position || exp.role || '未知'}, 时间: ${exp.startDate || ''} - ${exp.endDate || ''}`);
              });
            } catch (e) {
              console.log('解析失败:', e.message);
              console.log('原始值:', row.work_experience.substring(0, 500));
            }
          } else {
            console.log('work_experience为空');
          }
          
          console.log('\n=== parsed_data.workExperience字段 ===');
          if (row.parsed_data) {
            try {
              const pd = JSON.parse(row.parsed_data);
              if (pd.workExperience) {
                console.log('类型:', typeof pd.workExperience);
                console.log('是否为数组:', Array.isArray(pd.workExperience));
                console.log('数量:', pd.workExperience.length);
                console.log('内容:');
                pd.workExperience.forEach((exp, i) => {
                  console.log(`  ${i+1}. 公司: ${exp.company || exp.name || '未知'}, 职位: ${exp.jobTitle || exp.position || exp.role || '未知'}, 时间: ${exp.startDate || ''} - ${exp.endDate || ''}`);
                });
              } else {
                console.log('parsed_data.workExperience为空');
              }
            } catch (e) {
              console.log('解析parsed_data失败:', e.message);
            }
          } else {
            console.log('parsed_data为空');
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
    await checkWorkExperience();
  } catch (err) {
    console.error('查询失败:', err);
  } finally {
    db.close();
  }
}

main();
