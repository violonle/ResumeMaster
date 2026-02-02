
const axios = require('axios');

async function testLogin() {
  try {
    const response = await axios.post('http://localhost:3000/api/auth/login', {
      identifier: '18605355138',
      password: 'Longkou7'
    });
    console.log('Login Success:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('Login Failed:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
  }
}

testLogin();
