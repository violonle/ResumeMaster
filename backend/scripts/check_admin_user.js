
const { User } = require('../models');
const bcrypt = require('bcryptjs');

async function checkAdmin() {
  try {
    const admin = await User.findOne({
      where: { role: 'admin' }
    });
    
    if (admin) {
      console.log('Admin found:');
      console.log('ID:', admin.id);
      console.log('Username:', admin.username);
      console.log('Email:', admin.email);
      console.log('Role:', admin.role);
      console.log('Password hash exists:', !!admin.password_hash);
      
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash('Longkou7~!', salt);
      
      admin.password_hash = hash;
      await admin.save();
      console.log('Admin password updated to "Longkou7~!"');
      
      const isMatch = await bcrypt.compare('Longkou7~!', admin.password_hash);
      console.log('Password "Longkou7~!" matches:', isMatch);
    } else {
      console.log('No admin user found!');
    }
    process.exit(0);
  } catch (error) {
    console.error('Error checking admin:', error);
    process.exit(1);
  }
}

checkAdmin();
