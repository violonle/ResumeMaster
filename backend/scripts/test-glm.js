const OpenAI = require('openai');
const dotenv = require('dotenv');
const path = require('path');

// Load .env
dotenv.config({ path: path.join(__dirname, '../.env') });

async function testGlm() {
    const apiKey = process.env.GLM_API_KEY;
    const baseUrl = 'https://open.bigmodel.cn/api/paas/v4';
    
    console.log('Testing GLM with:');
    console.log('Base URL:', baseUrl);
    console.log('API Key:', apiKey ? 'FOUND' : 'MISSING');
    
    if (!apiKey || apiKey.includes('your_')) {
        console.error('Error: GLM_API_KEY is not configured in .env');
        return;
    }

    const client = new OpenAI({
        apiKey: apiKey,
        baseURL: baseUrl
    });

    try {
        console.log('Sending request to glm-4-flash...');
        const response = await client.chat.completions.create({
            model: 'glm-4-flash',
            messages: [
                { role: 'system', content: 'You are a helpful assistant.' },
                { role: 'user', content: 'Hello, who are you?' }
            ],
            temperature: 0.3
        });

        console.log('Response received:');
        console.log(JSON.stringify(response.choices[0].message.content, null, 2));
    } catch (error) {
        console.error('GLM call failed:');
        console.error(error.message);
    }
}

testGlm();
