const axios = require('axios');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NywiZW1haWwiOiJ0ZXN0XzE3Njg0ODc4NjQ3OTRAZXhhbXBsZS5jb20iLCJpYXQiOjE3Njg0ODc4NjUsImV4cCI6MTc2ODU3NDI2NX0.i9ukPPZ-JhbapRuuZD5vu9UZGZcA8wZKx5eGjYXGsWI';
const url = 'http://localhost:3000/api/interview/sessions';

async function createSession() {
  try {
    console.log('Creating session...');
    const response = await axios.post(url, {
      resumeId: 20,
      forceCreate: true
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Session created successfully!');
    const session = response.data.data;
    console.log('Real Session ID:', session.id);
    console.log('Real Session UUID:', session.uuid);
    // console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error creating session:');
    if (error.response) {
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
  }
}

createSession();
