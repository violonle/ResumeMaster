const { sequelize } = require('./models');

async function checkUser() {
  try {
    const User = sequelize.models.User;
    const user = await User.findOne({ where: { phone: '18605355138' } });
    if (user) {
      console.log('User found:', user.toJSON());
    } else {
      console.log('User not found');
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

checkUser();
