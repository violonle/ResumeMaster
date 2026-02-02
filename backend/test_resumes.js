const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const secret = process.env.JWT_SECRET || 'superresumemaster_secret_key';

async function testResumes() {
  const token = jwt.sign(
    { id: 1, email: 'admin@resumemaster.com', role: 'admin' },
    secret,
    { expiresIn: '24h' }
  );
  console.log('Using Token:', token);

  // Job 3 (Product Manager)
  const jobId = 3;
  try {
    const url = `http://localhost:3000/api/resumes?jobId=${jobId}&include_rejected=true`;
    console.log('Testing URL:', url);
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    console.log('Response Status:', response.status);
    console.log('Total candidates found:', response.data.data.length);
    response.data.data.forEach(c => {
      console.log(`- ID: ${c.id}, Name: ${c.name}, Status: ${c.status}`);
    });
  } catch (error) {
    console.error('Error Status:', error.response?.status);
    console.error('Error Data:', JSON.stringify(error.response?.data, null, 2));
  }
}

testResumes();
