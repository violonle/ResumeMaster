const { sequelize } = require('./models');
const { Op } = require('sequelize');

async function checkDuplicateUsers() {
  try {
    const User = sequelize.models.User;
    const identifier = '18605355138';
    
    const users = await User.findAll({
      where: {
        [Op.or]: [
          { username: identifier },
          { email: identifier },
          { phone: identifier }
        ]
      }
    });
    
    console.log(`Found ${users.length} user(s) for identifier ${identifier}:`);
    users.forEach(u => {
      console.log(`- ID: ${u.id}, Username: ${u.username}, Phone: ${u.phone}, Role: ${u.role}`);
    });
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

checkDuplicateUsers();
