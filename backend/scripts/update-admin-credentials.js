/**
 * 专门用于修改管理员账号和密码的脚本
 * 账号改为: masteradmin
 * 密码改为: Longkou7
 */
const { sequelize, User } = require('../models');
const bcrypt = require('bcryptjs');

async function updateAdminCredentials() {
    try {
        console.log('--- 开始更新管理员凭据 ---');
        
        const newUsername = 'masteradmin';
        const newPassword = 'Longkou7';
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // 1. 查找旧的 admin 账号
        let adminUser = await User.findOne({ where: { username: 'admin' } });
        
        if (adminUser) {
            console.log(`发现旧账号 "admin"，正在更新为 "${newUsername}"...`);
            await adminUser.update({
                username: newUsername,
                password_hash: hashedPassword,
                role: 'admin'
            });
            console.log('✅ 旧账号已成功更新为 masteradmin');
        } else {
            // 2. 如果没有 admin，检查 masteradmin 是否已存在
            adminUser = await User.findOne({ where: { username: newUsername } });
            if (adminUser) {
                console.log(`账号 "${newUsername}" 已存在，正在更新密码...`);
                await adminUser.update({
                    password_hash: hashedPassword,
                    role: 'admin'
                });
                console.log('✅ 管理员密码更新成功');
            } else {
                // 3. 如果都没有，则创建一个
                console.log(`未找到任何管理员账号，正在新建 "${newUsername}"...`);
                await User.create({
                    username: newUsername,
                    password_hash: hashedPassword,
                    role: 'admin',
                    is_active: true,
                    email: 'admin@resumemaster.com'
                });
                console.log('✅ 新管理员账号创建成功');
            }
        }

        console.log('--- 管理员凭据更新完成 ---');
        process.exit(0);
    } catch (error) {
        console.error('❌ 更新失败:');
        console.error(error);
        process.exit(1);
    }
}

updateAdminCredentials();
