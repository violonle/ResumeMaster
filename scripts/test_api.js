const axios = require('axios');

async function testCreateSession() {
  try {
    const response = await axios.post('http://localhost:3000/api/interview/sessions', {
      resumeId: 4,
      forceCreate: true
    });
    console.log('Success:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
  }
}

testCreateSession();
