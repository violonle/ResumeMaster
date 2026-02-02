
const axios = require('axios');
const jwt = require('jsonwebtoken');

// Use the secret from .env
const secret = 'superresumemaster_dev_secret_2024';
const token = jwt.sign({ id: 1, email: 'admin@resumemaster.com', role: 'admin' }, secret, { expiresIn: '1h' });

async function testCandidateLoading() {
    const jobIds = [2, 3, 4]; // Frontend (2/4) and PM (3)
    
    for (const jobId of jobIds) {
        console.log(`\nTesting Job ID: ${jobId}`);
        try {
            const response = await axios.get(`http://localhost:3000/api/library/resumes?jobId=${jobId}&include_rejected=true`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.data.success) {
                const data = response.data.data;
                const count = Array.isArray(data) ? data.length : (data && typeof data === 'object' ? Object.values(data).flat().length : 0);
                console.log(`✅ Success! Found ${count} candidates.`);
                if (count > 0) {
                    console.log('Candidates:', JSON.stringify(data, null, 2).substring(0, 500) + '...');
                }
            } else {
                console.log(`❌ Failed: ${JSON.stringify(response.data)}`);
            }
        } catch (error) {
            console.error(`❌ Error: ${error.message}`);
            if (error.response) {
                console.error('Response:', error.response.data);
            }
        }
    }
}

testCandidateLoading();
