const { Subscription, sequelize } = require('../models');
const { Op } = require('sequelize');

async function clean() {
  try {
    const deleted = await Subscription.destroy({
      where: {
        [Op.or]: [
          { company_id: null },
          { start_at: null },
          { end_at: null }
        ]
      }
    });
    console.log('Deleted ' + deleted + ' invalid subscriptions.');
  } catch (e) {
    console.error(e);
  } finally {
    await sequelize.close();
  }
}

clean();
