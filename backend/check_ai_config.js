
const { SystemConfig } = require('./models');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function checkAIConfig() {
  try {
    const row = await SystemConfig.findOne({ where: { key: 'ai_config' } });
    if (!row) {
      console.log('No ai_config found in SystemConfig table.');
      return;
    }
    console.log('AI Config found:');
    console.log(JSON.stringify(JSON.parse(row.value), null, 2));
  } catch (error) {
    console.error('Error fetching AI config:', error);
  } finally {
    process.exit();
  }
}

checkAIConfig();
