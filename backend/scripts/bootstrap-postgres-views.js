const fs = require('fs');
const path = require('path');

async function ensurePostgresViews(sequelize) {
  try {
    if (sequelize.getDialect() !== 'postgres') return;
    const sqlPath = path.join(__dirname, '../sql/postgres_views.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await sequelize.query(sql);
    // Try to refresh MV if exists
    try {
      await sequelize.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_pipeline_summary;');
    } catch (_) {
      // Fallback non-concurrently
      try { await sequelize.query('REFRESH MATERIALIZED VIEW mv_pipeline_summary;'); } catch (__){ }
    }
    console.log('[PG Views] ensured unified read models');
  } catch (e) {
    console.error('[PG Views] ensure failed:', e.message);
  }
}

module.exports = { ensurePostgresViews };

