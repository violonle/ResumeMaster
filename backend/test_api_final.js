const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const secret = process.env.JWT_SECRET || 'superresumemaster_secret_key';

async function testApi() {
  const token = jwt.sign(
    { id: 1, email: 'admin@resumemaster.com', role: 'admin' },
    secret,
    { expiresIn: '24h' }
  );
  console.log('Using Token:', token);

  try {
    const response = await axios.get('http://localhost:3000/api/dashboard/ai-prediction?period=7d', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    console.log('Response Status:', response.status);
    console.log('Response Data:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error Status:', error.response?.status);
    console.error('Error Data:', JSON.stringify(error.response?.data, null, 2));
  }
}

testApi();
