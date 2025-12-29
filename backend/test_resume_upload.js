const fs = require('fs');
const path = require('path');
const http = require('http');

const API_BASE_URL = 'http://localhost:3000';
let authToken = null;

function fileToBase64(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return fileBuffer.toString('base64');
}

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(data) });
        } catch (error) {
          resolve({ statusCode: res.statusCode, data: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function login() {
  console.log('=== 登录获取访问令牌 ===\n');

  const loginData = JSON.stringify({
    username: 'test_user_resume',
    password: 'testpass123'
  });

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(loginData)
    }
  };

  try {
    const response = await makeRequest(options, loginData);
    
    if (response.statusCode === 200 && response.data.success) {
      authToken = response.data.data.token;
      console.log('✓ 登录成功');
      console.log('用户ID:', response.data.data.user.id);
      console.log('用户名:', response.data.data.user.username);
      console.log('令牌:', authToken.substring(0, 20) + '...\n');
      return true;
    } else {
      console.log('✗ 登录失败');
      console.log('错误信息:', response.data.error || response.data);
      
      if (response.data.error && response.data.error.code === 'INVALID_CREDENTIALS') {
        console.log('\n尝试注册新用户...');
        return await register();
      }
      return false;
    }
  } catch (error) {
    console.log('✗ 登录请求失败:', error.message);
    return false;
  }
}

async function register() {
  const registerData = JSON.stringify({
    username: 'test_user_resume',
    password: 'testpass123',
    email: 'test_resume@example.com'
  });

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/register',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(registerData)
    }
  };

  try {
    const response = await makeRequest(options, registerData);
    
    if (response.statusCode === 201 && response.data.success) {
      authToken = response.data.data.token;
      console.log('✓ 注册成功');
      console.log('用户ID:', response.data.data.user.id);
      console.log('用户名:', response.data.data.user.username);
      console.log('令牌:', authToken.substring(0, 20) + '...\n');
      return true;
    } else {
      console.log('✗ 注册失败');
      console.log('错误信息:', response.data.error || response.data);
      return false;
    }
  } catch (error) {
    console.log('✗ 注册请求失败:', error.message);
    return false;
  }
}

async function testResumeUpload() {
  console.log('=== 测试简历上传和解析功能 ===\n');

  if (!await login()) {
    console.log('无法获取访问令牌，测试终止');
    return;
  }

  const testResumes = [
    {
      path: '/Users/yangyong/工作/Projects/SuperResumeMaster/backend/uploads/resumes/test_resume.txt',
      name: 'test_resume.txt'
    },
    {
      path: '/Users/yangyong/工作/Projects/SuperResumeMaster/backend/uploads/resumes/测试简历.txt',
      name: '测试简历.txt'
    }
  ];

  for (const resume of testResumes) {
    console.log(`\n测试文件: ${resume.name}`);
    console.log('='.repeat(50));

    try {
      const fileBase64 = fileToBase64(resume.path);
      
      const postData = JSON.stringify({
        file_name: resume.name,
        file_base64: `data:text/plain;base64,${fileBase64}`
      });

      const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/library/upload',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'Authorization': `Bearer ${authToken}`
        }
      };

      const response = await makeRequest(options, postData);
      console.log('响应状态码:', response.statusCode);
      
      if (response.statusCode === 201 && response.data.success) {
        console.log('✓ 上传成功');
        console.log('简历ID:', response.data.data.id);
        console.log('文件名:', response.data.data.file_name);
        console.log('解析状态:', response.data.data.status);
        
        if (response.data.data.parsed_data) {
          console.log('\n解析结果:');
          console.log('  姓名:', response.data.data.parsed_data.name || '未解析');
          console.log('  职位:', response.data.data.parsed_data.job_title || '未解析');
          console.log('  邮箱:', response.data.data.parsed_data.email || '未解析');
          console.log('  电话:', response.data.data.parsed_data.phone || '未解析');
          console.log('  地址:', response.data.data.parsed_data.location || '未解析');
          console.log('  工作经验:', response.data.data.parsed_data.work_experience ? `${response.data.data.parsed_data.work_experience.length}条` : '0条');
          console.log('  教育背景:', response.data.data.parsed_data.education ? `${response.data.data.parsed_data.education.length}条` : '0条');
          console.log('  技能:', response.data.data.parsed_data.skills ? `${response.data.data.parsed_data.skills.length}项` : '0项');
          
          if (response.data.data.parsed_data.work_experience && response.data.data.parsed_data.work_experience.length > 0) {
            console.log('\n  第一条工作经历:');
            const exp = response.data.data.parsed_data.work_experience[0];
            console.log('    公司:', exp.company || '未解析');
            console.log('    职位:', exp.position || '未解析');
            console.log('    时间:', `${exp.startDate || ''} - ${exp.endDate || ''}`);
          }
        }
      } else {
        console.log('✗ 上传失败');
        console.log('错误信息:', response.data.error || response.data);
      }
    } catch (error) {
      console.log('✗ 请求失败:', error.message);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n=== 测试完成 ===');
}

testResumeUpload().catch(console.error);
