const OpenAI = require('openai');
const dotenv = require('dotenv');
const path = require('path');

// Load .env
dotenv.config({ path: path.join(__dirname, '../.env') });

async function testQwen() {
    const apiKey = process.env.QWEN_API_KEY;
    const baseUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    
    console.log('Testing QWEN with:');
    console.log('Base URL:', baseUrl);
    console.log('API Key:', apiKey ? 'FOUND' : 'MISSING');
    
    if (!apiKey || apiKey === 'your_qwen_api_key') {
        console.error('Error: QWEN_API_KEY is not configured in .env');
        return;
    }

    const client = new OpenAI({
        apiKey: apiKey,
        baseURL: baseUrl
    });

    try {
        console.log('Sending request to qwen-plus...');
        const response = await client.chat.completions.create({
            model: 'qwen-plus',
            messages: [
                { role: 'system', content: 'You are a helpful assistant.' },
                { role: 'user', content: 'Hello, who are you?' }
            ],
            temperature: 0.3
        });

        console.log('Response received:');
        console.log(JSON.stringify(response.choices[0].message.content, null, 2));
    } catch (error) {
        console.error('QWEN call failed:');
        console.error(error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

testQwen();
