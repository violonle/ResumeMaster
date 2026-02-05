const { SystemConfig, sequelize } = require('../models');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function manageAlipayConfig() {
    try {
        console.log('--- Manage Alipay Configuration ---');

        let configRecord = await SystemConfig.findOne({ where: { key: 'payment_alipay' } });
        if (!configRecord) {
            console.log('Configuration not found in database. Creating new record...');
            configRecord = await SystemConfig.create({
                key: 'payment_alipay',
                value: JSON.stringify({}),
                type: 'json',
                description: 'Alipay Payment Configuration',
                is_public: false
            });
        }

        let currentConfig = {};
        try {
            currentConfig = JSON.parse(configRecord.value) || {};
        } catch (e) {
            console.error('Error parsing current config:', e.message);
        }

        console.log('\nCurrent Configuration:');
        console.log(JSON.stringify(currentConfig, null, 2));

        console.log('\nOptions:');
        console.log('1. Update Alipay Public Key (支付宝公钥)');
        console.log('2. Update App ID');
        console.log('3. Toggle Sandbox Mode');
        console.log('4. Exit');

        const choice = await question('\nEnter choice (1-4): ');

        if (choice === '1') {
            const newKey = await question('Enter new Alipay Public Key (one line or pasted): ');
            if (newKey && newKey.trim().length > 10) {
                currentConfig.alipayPublicKey = newKey.trim();
                console.log('Updating Alipay Public Key...');
                await updateConfig(configRecord, currentConfig);
            } else {
                console.log('Invalid key provided.');
            }
        } else if (choice === '2') {
            const newAppId = await question('Enter new App ID: ');
            if (newAppId) {
                currentConfig.appId = newAppId.trim();
                await updateConfig(configRecord, currentConfig);
            }
        } else if (choice === '3') {
            currentConfig.sandbox = !currentConfig.sandbox;
            console.log(`Sandbox mode set to: ${currentConfig.sandbox}`);
            await updateConfig(configRecord, currentConfig);
        } else {
            console.log('Exiting...');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        rl.close();
        // Allow time for DB operations to complete if needed? No, await should handle it.
        // Close sequelize connection to exit cleanly
        try {
            await sequelize.close();
        } catch (e) { }
    }
}

async function updateConfig(record, newConfig) {
    record.value = JSON.stringify(newConfig);
    await record.save();
    console.log('✅ Configuration saved successfully!');
}

manageAlipayConfig();
