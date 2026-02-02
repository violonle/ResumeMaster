
const axios = require('axios');

async function testSms() {
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwiZW1haWwiOiJhZG1pbkBleGFtcGxlLmNvbSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc2OTk1MTQ0NywiZXhwIjoxNzcwMDM3ODQ3fQ.oJe7jWFRMqSndE3n9RO1JcLTodCRX2JW8idvhSPIrmk';
  const baseUrl = 'http://localhost:3000/api';

  try {
    console.log('--- Testing Admin SMS Test Interface (Valid Phone) ---');
    const res = await axios.post(`${baseUrl}/admin/system/sms/test`, {
      scene: 'interview',
      phone: '13800138000',
      content: {
        name: '测试用户',
        time: '2026-02-01 10:00',
        jobId: '123',
        link: 'http://localhost:5173/interview.html?resumeJobId=123'
      }
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('Success:', res.data);
  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
  }
}

testSms();
