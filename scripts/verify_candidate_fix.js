const axios = require('axios');

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJhZG1pbkByZXN1bWVtYXN0ZXIuY29tIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzY5OTE2NDcyLCJleHAiOjE3NzAwMDI4NzJ9.rWOtCsUIeVV4cE6h-grFVIUlotsoZapceo2jb938S9g';
const BASE_URL = 'http://localhost:3000/api';

async function verifyCandidateLoading() {
    // 职位ID: 2 (前端开发工程师), 3 (产品经理)
    const jobIds = [4, 3];
    
    for (const jobId of jobIds) {
        console.log(`\nTesting Job ID: ${jobId}`);
        
        // 1. 测试不包含淘汰人
        try {
            const res1 = await axios.get(`${BASE_URL}/resumes?jobId=${jobId}`, {
                headers: { 'Authorization': `Bearer ${TOKEN}` }
            });
            console.log(`Default (include_rejected=false): Found ${res1.data.data.length} candidates`);
        } catch (err) {
            console.error(`Default request failed: ${err.message}`);
        }
        
        // 2. 测试包含淘汰人
        try {
            const res2 = await axios.get(`${BASE_URL}/resumes?jobId=${jobId}&include_rejected=true`, {
                headers: { 'Authorization': `Bearer ${TOKEN}` }
            });
            console.log(`With include_rejected=true: Found ${res2.data.data.length} candidates`);
            if (res2.data.data.length > 0) {
                console.log(`Candidate Names: ${res2.data.data.map(c => c.name).join(', ')}`);
            }
        } catch (err) {
            console.error(`Request with include_rejected=true failed: ${err.message}`);
        }
    }
}

verifyCandidateLoading();
