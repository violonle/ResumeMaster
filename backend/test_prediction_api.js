
const axios = require('axios');

async function testPrediction() {
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwiZW1haWwiOiJhZG1pbkBleGFtcGxlLmNvbSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc2OTk1MzE2OCwiZXhwIjoxNzcwMDM5NTY4fQ.w3mK-kyFwMHdKKqUMqg8Gj8DYaKU913a9GaHGkyYeGM';
  const url = 'http://localhost:3000/api/dashboard/ai-prediction?period=7d';
  
  try {
    console.log('Sending request to AI prediction...');
    const res = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      timeout: 120000 // 120s
    });
    console.log('Response:', JSON.stringify(res.data, null, 2));
  } catch (error) {
    if (error.response) {
      console.error('Error Response:', error.response.status, error.response.data);
    } else {
      console.error('Error Message:', error.message);
    }
  }
}

testPrediction();
