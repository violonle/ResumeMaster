const { sequelize } = require('./models');
const bcrypt = require('bcryptjs');

async function verifyPassword() {
  try {
    const User = sequelize.models.User;
    const user = await User.findByPk(2);
    if (!user) {
      console.log('User 2 not found');
      return;
    }
    
    const passwords = ['Longkou7', 'longkou7'];
    for (const p of passwords) {
      const match = await bcrypt.compare(p, user.password_hash);
      console.log(`Password "${p}" match: ${match}`);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

verifyPassword();
