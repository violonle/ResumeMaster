/**
 * 提示词模板同步脚本
 * 用于将代码中的默认提示词模板同步到数据库中
 */
const promptService = require('../services/promptService');
const { sequelize } = require('../models');

async function syncPrompts() {
    console.log('🚀 开始同步提示词模板...');
    try {
        // 确保数据库连接
        await sequelize.authenticate();
        console.log('✅ 数据库连接成功');

        // 执行同步
        await promptService.ensureDefaultPrompts();
        console.log('✅ 提示词模板同步完成');

        // 检查同步后的结果
        const { PromptTemplate } = require('../models');
        const count = await PromptTemplate.count();
        console.log(`📊 当前数据库中共有 ${count} 个提示词模板`);
        
        const prompts = await PromptTemplate.findAll({ attributes: ['key', 'name'] });
        prompts.forEach(p => {
            console.log(`  - [${p.key}] ${p.name}`);
        });

    } catch (error) {
        console.error('❌ 同步失败:', error);
    } finally {
        await sequelize.close();
        process.exit(0);
    }
}

syncPrompts();
