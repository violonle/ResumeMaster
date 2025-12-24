const { Subscription, sequelize } = require('../models');

async function check() {
  try {
    const subs = await Subscription.findAll();
    console.log(JSON.stringify(subs, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await sequelize.close();
  }
}

check();
