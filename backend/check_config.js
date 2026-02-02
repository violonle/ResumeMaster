const { sequelize } = require('./models');

async function checkConfig() {
  try {
    const SystemConfig = sequelize.models.SystemConfig;
    if (!SystemConfig) {
      console.log('SystemConfig model not found');
      return;
    }
    const configs = await SystemConfig.findAll();
    console.log(`Found ${configs.length} config entries:`);
    configs.forEach(c => {
      console.log(`- ${c.key}: ${c.value}`);
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sequelize.close();
  }
}

checkConfig();
