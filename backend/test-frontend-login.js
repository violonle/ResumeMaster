const axios = require('axios');

async function testFrontendLogin() {
  try {
    const response = await axios.post('http://localhost:3000/api/auth/login', {
      identifier: '18605355138',
      password: 'Longkou7'
    });
    console.log('Login successful:', response.data);
  } catch (error) {
    console.error('Login failed:', error.response ? error.response.data : error.message);
  }
}

testFrontendLogin();
