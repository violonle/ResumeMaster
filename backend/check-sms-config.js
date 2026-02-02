const { sequelize } = require('./models');
const { Op } = require('sequelize');

async function checkSmsConfig() {
  try {
    const SystemConfig = sequelize.models.SystemConfig;
    if (!SystemConfig) {
      console.log('SystemConfig model not found');
      process.exit(1);
    }

    const keys = [
      'sms.provider', 'sms.accessKeyId', 'sms.accessKeySecret', 'sms.signName', 'sms.enabled',
      'sms.templateCode', 'sms.auth.templateCode', 'sms.interview.templateCode', 'sms.offer.templateCode'
    ];
    
    const rows = await SystemConfig.findAll({ where: { key: { [Op.in]: keys } } });
    
    console.log('--- DB SMS Config ---');
    rows.forEach(r => {
      let val = r.value;
      if (r.key.includes('Secret') || r.key.includes('accessKeyId')) {
        val = '***';
      }
      console.log(`${r.key}: ${val}`);
    });

    console.log('\n--- Env SMS Config ---');
    console.log('SMS_ENABLED:', process.env.SMS_ENABLED);
    console.log('SMS_PROVIDER:', process.env.SMS_PROVIDER);
    console.log('ALIYUN_SMS_SIGN_NAME:', process.env.ALIYUN_SMS_SIGN_NAME);
    console.log('ALIYUN_SMS_TEMPLATE_CODE_INTERVIEW:', process.env.ALIYUN_SMS_TEMPLATE_CODE_INTERVIEW);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

checkSmsConfig();
