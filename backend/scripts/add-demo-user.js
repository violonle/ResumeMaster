/**
 * 创建演示账号脚本
 * 用户名: demo
 * 密码: test123
 */
const { sequelize, User } = require('../models');
const bcrypt = require('bcryptjs');
const seedDemo = require('./seed-demo');

async function addDemoUser() {
    try {
        console.log('--- 开始创建演示账号 ---');
        
        const username = 'demo';
        const password = 'test123';
        const hashedPassword = await bcrypt.hash(password, 10);

        // 1. 检查账号是否已存在
        let user = await User.findOne({ where: { username } });
        
        if (user) {
            console.log(`账号 "${username}" 已存在，正在更新密码...`);
            await user.update({
                password_hash: hashedPassword,
                role: 'premium', // 给演示账号高级权限
                is_active: true
            });
            console.log('✅ 演示账号信息已更新');
        } else {
            // 2. 创建新账号
            console.log(`正在创建新账号 "${username}"...`);
            user = await User.create({
                username,
                password_hash: hashedPassword,
                role: 'premium', // 给演示账号高级权限
                is_active: true,
                email: 'demo@resumemaster.com',
                subscription_status: 'active',
                subscription_end_date: new Date(Date.now() + 365 * 86400000) // 一年有效期
            });
            console.log('✅ 演示账号创建成功');
        }

        // 3. 为该账号写入演示数据
        await seedDemo(username);

        console.log(`\n账号信息:`);
        console.log(`用户名: ${username}`);
        console.log(`密  码: ${password}`);
        console.log(`角  色: premium`);
        
        console.log('\n--- 演示账号处理完成 ---');
        process.exit(0);
    } catch (error) {
        console.error('❌ 处理失败:');
        console.error(error);
        process.exit(1);
    }
}

addDemoUser();
