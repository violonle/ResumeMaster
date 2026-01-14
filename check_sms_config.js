const sms = require('./backend/services/smsService');

async function checkConfig() {
  try {
    const cfg = await sms.getConfig();
    console.log('SMS Config:');
    console.log('- Provider:', cfg.provider);
    console.log('- Enabled:', cfg.enabled);
    console.log('- Has AccessKey:', !!cfg.accessKeyId);
    console.log('- Has Secret:', !!cfg.accessKeySecret);
    console.log('- Sign Name:', cfg.signName);
    console.log('- Template Code:', cfg.templateCode);
    console.log('- Scenarios:', JSON.stringify(cfg.scenarios, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

checkConfig();
