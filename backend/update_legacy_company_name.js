
const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

// 数据库路径
const dbPath = path.join(__dirname, 'database.sqlite');

async function updateLegacyData() {
    const sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: dbPath,
        logging: console.log
    });

    try {
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');

        // 直接使用 SQL 更新 interview_sessions 表
        const [results, metadata] = await sequelize.query(
            "UPDATE interview_sessions SET company_name = '某公司' WHERE company_name = '有公司'"
        );
        
        console.log('Update completed.');
        console.log('Rows affected:', metadata.changes);

    } catch (error) {
        console.error('Unable to connect to the database or update data:', error);
    } finally {
        await sequelize.close();
    }
}

updateLegacyData();
