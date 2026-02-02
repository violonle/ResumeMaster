
const axios = require('axios');

async function testApi() {
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJhZG1pbkByZXN1bWVtYXN0ZXIuY29tIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzY5OTE2NDcyLCJleHAiOjE3NzAwMDI4NzJ9.rWOtCsUIeVV4cE6h-grFVIUlotsoZapceo2jb938S9g'; // We don't have a real one easily, but we can check if it hits the server
  try {
    console.log('Testing /api/dashboard/ai-prediction...');
    const response = await axios.get('http://localhost:3000/api/dashboard/ai-prediction', {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      timeout: 20000
    });
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    if (error.response) {
      console.log('Response error status:', error.response.status);
      console.log('Response error data:', error.response.data);
    } else {
      console.log('Error message:', error.message);
    }
  }
}

testApi();
