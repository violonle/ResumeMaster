/**
 * 数据库连接测试脚本
 */
const mysql = require('mysql2/promise');

async function testDatabaseConnection() {
    const dbConfig = {
        host: process.env.DB_HOST || '127.0.0.1',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USERNAME || 'root',
        password: process.env.DB_PASSWORD || '123456',
        database: process.env.DB_NAME || 'superresumemaster'
    };

    let connection;
    try {
        console.log('正在测试数据库连接...');
        console.log('配置:', {
            host: dbConfig.host,
            port: dbConfig.port,
            user: dbConfig.user,
            database: dbConfig.database
        });

        connection = await mysql.createConnection(dbConfig);
        
        // 测试连接
        const [rows] = await connection.execute('SELECT NOW() as current_time');
        console.log('✅ 数据库连接成功!');
        console.log('当前时间:', rows[0].current_time);

        // 检查表是否存在
        const [tables] = await connection.execute('SHOW TABLES');
        console.log('\n📊 数据库表:');
        tables.forEach(table => {
            const tableName = Object.values(table)[0];
            console.log(`   - ${tableName}`);
        });

        return true;
        
    } catch (error) {
        console.error('❌ 数据库连接失败:', error.message);
        
        if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.log('\n🔧 可能的解决方案:');
            console.log('1. 检查数据库用户名和密码是否正确');
            console.log('2. 确保MySQL服务正在运行');
            console.log('3. 检查用户权限设置');
        } else if (error.code === 'ECONNREFUSED') {
            console.log('\n🔧 可能的解决方案:');
            console.log('1. 确保MySQL服务正在运行');
            console.log('2. 检查端口配置是否正确');
            console.log('3. 确认防火墙设置');
        } else if (error.code === 'ER_BAD_DB_ERROR') {
            console.log('\n🔧 解决方案:');
            console.log('请运行数据库初始化脚本: node scripts/init-db.js');
        }
        
        return false;
        
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    testDatabaseConnection();
}

module.exports = testDatabaseConnection;
