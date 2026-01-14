const { sequelize } = require('./backend/models');
const { Op } = require('sequelize');

async function checkSmsConfig() {
  try {
    const SystemConfig = sequelize.models.SystemConfig;
    const keys = [
      'sms.provider', 'sms.accessKeyId', 'sms.accessKeySecret', 'sms.signName', 'sms.templateCode', 'sms.enabled',
      'sms.auth.signName', 'sms.auth.templateCode',
      'sms.interview.signName', 'sms.interview.templateCode',
      'sms.reminder.signName', 'sms.reminder.templateCode',
      'settings'
    ];
    const rows = await SystemConfig.findAll({ where: { key: { [Op.in]: keys } } });
    
    console.log('--- SMS Configuration in Database ---');
    rows.forEach(r => {
      let val = r.value;
      if (r.key.includes('Secret') || r.key.includes('accessKeyId')) {
        val = val ? '***' : '(empty)';
      }
      console.log(`${r.key}: ${val}`);
    });
    
    // Check Xiao Yanwen's resume again
    const Resume = sequelize.models.Resume;
    const xiao = await Resume.findOne({ where: { id: 23 } });
    if (xiao) {
      console.log('\n--- Xiao Yanwen (ID 23) Data ---');
      console.log('Phone:', xiao.phone);
      console.log('Recruitment Status:', xiao.recruitment_status);
      console.log('Name:', xiao.name);
      // console.log('Parsed Data:', JSON.stringify(xiao.parsed_data, null, 2));
    } else {
      console.log('\nXiao Yanwen (ID 23) not found.');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkSmsConfig();
