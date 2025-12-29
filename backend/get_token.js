const axios = require('axios');
const FormData = require('form-data');

const BACKEND_URL = 'http://localhost:5000';

async function getAuthToken() {
  console.log('=== 获取认证Token ===\n');

  try {
    console.log('步骤1: 注册新用户...');
    const registerData = {
      username: `test_user_${Date.now()}`,
      password: 'Test123456',
      email: `test_${Date.now()}@example.com`
    };

    const registerResponse = await axios.post(`${BACKEND_URL}/api/auth/register`, registerData);
    console.log('✓ 用户注册成功');
    console.log('  用户名:', registerData.username);
    console.log('  用户ID:', registerResponse.data.user?.id);
    console.log('  公司ID:', registerResponse.data.user?.company_id);

    console.log('\n步骤2: 登录获取Token...');
    const loginData = {
      username: registerData.username,
      password: registerData.password
    };

    const loginResponse = await axios.post(`${BACKEND_URL}/api/auth/login`, loginData);
    console.log('✓ 登录成功');
    console.log('  Token:', loginResponse.data.token.substring(0, 50) + '...');

    console.log('\n=== Token获取完成 ===');
    console.log('\n请使用以下Token进行测试:');
    console.log(`Bearer ${loginResponse.data.token}`);

    return loginResponse.data.token;

  } catch (error) {
    console.error('\n✗ 获取Token失败:', error.message);
    if (error.response) {
      console.error('  响应状态:', error.response.status);
      console.error('  响应数据:', error.response.data);
    }
    throw error;
  }
}

getAuthToken().catch(console.error);
