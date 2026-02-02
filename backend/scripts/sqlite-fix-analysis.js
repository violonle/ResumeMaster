const { Sequelize } = require('sequelize');
const path = require('path');

async function run() {
  const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '../database.sqlite'),
    logging: console.log
  });
  try {
    await sequelize.authenticate();
    const [cols] = await sequelize.query("PRAGMA table_info('analysis_results')");
    const names = cols.map(c => c.name);
    if (!names.includes('job_id')) {
      console.log('[Fix] Adding column job_id INTEGER to analysis_results');
      await sequelize.query("ALTER TABLE analysis_results ADD COLUMN job_id INTEGER");
    }
    if (!names.includes('type')) {
      console.log("[Fix] Adding column type TEXT DEFAULT 'single' to analysis_results");
      await sequelize.query("ALTER TABLE analysis_results ADD COLUMN type TEXT DEFAULT 'single'");
    }
    console.log('[Fix] Done');
  } catch (e) {
    console.error('[Fix] Failed:', e.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

run();
