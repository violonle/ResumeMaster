/**
 * 数据库初始化脚本
 * 自动创建数据库和表
 */
const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');

// 数据库配置
const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '123456',
    database: process.env.DB_NAME || 'superresumemaster'
};

async function initDatabase() {
    // 创建连接（不指定数据库）
    const connection = mysql.createConnection({
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.user,
        password: dbConfig.password
    });

    try {
        console.log('正在连接数据库服务器...');
        
        // 创建数据库
        await new Promise((resolve, reject) => {
            connection.query(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        console.log(`✅ 数据库 ${dbConfig.database} 创建成功`);

        // 关闭当前连接，重新连接到指定数据库
        connection.end();
        
        const dbConnection = mysql.createConnection({
            host: dbConfig.host,
            port: dbConfig.port,
            user: dbConfig.user,
            password: dbConfig.password,
            database: dbConfig.database,
            multipleStatements: true
        });

        // 读取并执行初始化SQL
        const initSql = `
-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) UNIQUE,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    avatar VARCHAR(500),
    company_name VARCHAR(200),
    role ENUM('admin', 'premium', 'enterprise', 'user', 'hr', 'guest') DEFAULT 'user',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 创建简历表
CREATE TABLE IF NOT EXISTS resumes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size INT NOT NULL,
    file_type VARCHAR(20) NOT NULL,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    parsed_data JSON,
    status ENUM('uploaded', 'analyzed', 'archived') DEFAULT 'uploaded',
    tags JSON,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_upload_date (upload_date),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 创建分析结果表
CREATE TABLE IF NOT EXISTS analysis_results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    resume_id INT NOT NULL,
    analysis_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    overall_score INT NOT NULL,
    dimensions JSON,
    suggestions JSON,
    strengths JSON,
    weaknesses JSON,
    target_job JSON,
    detailed_analysis JSON,
    ai_provider VARCHAR(50),
    INDEX idx_resume_id (resume_id),
    INDEX idx_analysis_date (analysis_date),
    INDEX idx_overall_score (overall_score),
    FOREIGN KEY (resume_id) REFERENCES resumes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 创建职位表
CREATE TABLE IF NOT EXISTS jobs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    requirements TEXT,
    salary_range VARCHAR(100),
    location VARCHAR(100),
    experience_required VARCHAR(50),
    status ENUM('active', 'paused', 'closed', 'draft') DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 创建用户会话表（可选）
CREATE TABLE IF NOT EXISTS user_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_expires_at (expires_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `;

        await new Promise((resolve, reject) => {
            dbConnection.query(initSql, (err, results) => {
                if (err) {
                    console.error('❌ 创建表失败:', err);
                    reject(err);
                } else {
                    console.log('✅ 数据表创建成功');
                    resolve();
                }
            });
        });

        // 确保用户角色枚举包含 enterprise（如果已存在则修改列定义）
        await new Promise((resolve, reject) => {
            const alterRoleSql = "ALTER TABLE users MODIFY COLUMN role ENUM('admin','premium','enterprise','user','hr','guest') DEFAULT 'user'";
            dbConnection.query(alterRoleSql, (err) => {
                if (err) {
                    console.warn('⚠️ 修改用户角色枚举失败（忽略）：', err.message);
                    resolve();
                } else {
                    console.log('✅ 用户角色枚举已更新（包含 enterprise）');
                    resolve();
                }
            });
        });

        // 创建默认管理员用户
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash('admin123', 10);
        
        await new Promise((resolve, reject) => {
            dbConnection.query(
                `INSERT IGNORE INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)`,
                ['admin', 'admin@resumemaster.com', hashedPassword, 'admin'],
                (err, results) => {
                    if (err) {
                        console.error('❌ 创建默认管理员失败:', err);
                        reject(err);
                    } else {
                        console.log('✅ 默认管理员用户创建成功');
                        resolve();
                    }
                }
            );
        });

        console.log('\n🎉 数据库初始化完成！');
        console.log('\n📋 默认管理员账户:');
        console.log('   邮箱: admin@resumemaster.com');
        console.log('   密码: admin123');
        console.log('\n⚠️  请尽快修改默认密码！');

        dbConnection.end();
        
    } catch (error) {
        console.error('❌ 数据库初始化失败:', error);
        process.exit(1);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    initDatabase();
}

module.exports = initDatabase;