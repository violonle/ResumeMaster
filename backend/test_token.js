const jwt = require('jsonwebtoken');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const secret = process.env.JWT_SECRET || 'superresumemaster_secret_key';

const { User } = require('./models');

async function checkUserAndToken() {
  try {
    const user = await User.findByPk(1);
    if (!user) {
      console.log('User ID 1 not found');
      process.exit(1);
    }
    console.log('User found:', user.username, 'Email:', user.email);

    console.log('Using Secret Prefix:', secret.substring(0, 10) + '...', 'Length:', secret.length);
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      secret,
      { expiresIn: '24h' }
    );
    console.log('Generated Token:', token);

    try {
      const decoded = jwt.verify(token, secret);
      console.log('Verified Decoded:', decoded);
    } catch (e) {
      console.error('Verification failed immediately:', e.message);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkUserAndToken();
