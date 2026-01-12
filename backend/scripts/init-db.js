/**
 * 数据库初始化脚本
 * 自动创建数据库和表，并初始化默认管理员数据
 */
const { sequelize, User, Role } = require('../models');
const bcrypt = require('bcryptjs');

async function initDatabase() {
    try {
        console.log('--- 数据库初始化开始 ---');
        
        // 1. 检查数据库连接，但不使用 sync() 自动同步（避免索引爆炸）
        console.log('正在连接数据库...');
        await sequelize.authenticate();
        console.log('✅ 数据库连接成功');

        // 尝试安全地同步表结构，禁用 alter 模式
        console.log('正在同步表结构 (安全模式)...');
        await sequelize.sync({ force: false, alter: false });
        console.log('✅ 数据库表结构同步完成');

        // 2. 初始化角色
        console.log('正在初始化系统角色...');
        let superRole = await Role.findOne({ where: { key: 'SUPER_ADMIN' } });
        if (!superRole) {
            superRole = await Role.create({
                key: 'SUPER_ADMIN',
                name: '超级管理员',
                description: '系统最高权限',
                status: 'active'
            });
            console.log('✅ 已创建 SUPER_ADMIN 角色');
        } else {
            console.log('ℹ️ SUPER_ADMIN 角色已存在');
        }

        // 3. 初始化默认管理员
        console.log('正在检查默认管理员账号...');
        const adminUser = await User.findOne({ where: { username: 'masteradmin' } });
        
        if (!adminUser) {
            console.log('正在创建默认管理员 (masteradmin/Longkou7)...');
            const hashedPassword = await bcrypt.hash('Longkou7', 10);
            const created = await User.create({
                username: 'masteradmin',
                role: 'admin',
                is_active: true,
                password_hash: hashedPassword
            });

            // 关联角色
            const UserRole = sequelize.modelManager.getModel('UserRole');
            if (UserRole) {
                await UserRole.findOrCreate({
                    where: { user_id: created.id, role_id: superRole.id },
                    defaults: { user_id: created.id, role_id: superRole.id }
                });
            }
            console.log('✅ 默认管理员账号创建成功');
        } else {
            console.log('ℹ️ 默认管理员账号已存在');
            // 确保密码和权限正确
            const hashedPassword = await bcrypt.hash('Longkou7', 10);
            await adminUser.update({ 
                password_hash: hashedPassword,
                role: 'admin'
            });
            console.log('✅ 已更新默认管理员密码和角色');
        }

        console.log('--- 数据库初始化完成 ---');
        process.exit(0);
    } catch (error) {
        console.error('❌ 数据库初始化失败:');
        console.error(error);
        process.exit(1);
    }
}

initDatabase();
