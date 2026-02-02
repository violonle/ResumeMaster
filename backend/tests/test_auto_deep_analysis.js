
/**
 * 自动深度解析全流程集成测试脚本
 * 验证：快评通过 -> 即时触发深度解析 -> 状态追踪
 */
const axios = require('axios');
const API_BASE_URL = 'http://127.0.0.1:3000/api';

async function testAutoFlow() {
    console.log('🚀 开始自动深度解析全流程集成测试...');

    try {
        // 0. 登录获取 Token
        console.log('\nStep 0: 模拟登录获取 Token...');
        const loginPhone = '13800138000';
        const loginResponse = await axios.post(`${API_BASE_URL}/auth/verify-code`, {
            phone: loginPhone,
            code: '123456' // 开发绕过码
        });
        const token = loginResponse.data.data.token;
        console.log('✅ 登录成功，获取 Token');

        const config = {
            headers: { Authorization: `Bearer ${token}` }
        };

        // 1. 创建一个开启了自动快评和自动深度解析的职位
        console.log('\nStep 1: 创建测试职位...');
        const jobResponse = await axios.post(`${API_BASE_URL}/jobs`, {
            title: '测试自动深度解析职位-' + Date.now(),
            description: '这是一个用于测试自动流水线的职位',
            status: 'active',
            enable_auto_screening: true,
            auto_screening_score: 60,
            enable_deep_analysis: true
        }, config);
        const jobId = jobResponse.data.data.id;
        console.log(`✅ 职位创建成功: ID = ${jobId}`);

        // 2. 模拟简历上传并关联职位
        // 注意：这里的 API 路径可能需要根据实际情况调整
        // 模拟 apply 流程，通常是上传简历后关联职位
        console.log('\nStep 2: 模拟简历上传与关联...');
        
        // 先创建一个简历
        const resumeResponse = await axios.post(`${API_BASE_URL}/resumes`, {
            name: '测试工程师-' + Date.now(),
            email: 'test@example.com',
            raw_text: '精通 Java, Spring Boot, MySQL, 具备 5 年开发经验。我是一名优秀的后端开发工程师，擅长架构设计。',
            file_name: 'test_resume.pdf',
            file_size: 1024,
            file_type: 'pdf',
            file_path: 'uploads/test.pdf'
        }, config);
        const resumeId = resumeResponse.data.data.id;
        console.log(`✅ 简历创建成功: ID = ${resumeId}`);

        // 关联职位（触发自动快评）
        console.log('🔗 关联简历到职位...');
        await axios.post(`${API_BASE_URL}/recruitment/resumes/${resumeId}/apply`, {
            jobId: jobId
        }, config);
        console.log('✅ 简历已投递到职位');

        // 3. 轮询检查状态流转
        console.log('\nStep 3: 监控状态流转 (快评 -> 深度解析)...');
        let attempts = 0;
        const maxAttempts = 20;
        const interval = 5000; // 5秒检查一次，给 AI 解析留出时间

        while (attempts < maxAttempts) {
            const statusResponse = await axios.get(`${API_BASE_URL}/recruitment/pipeline?jobId=${jobId}`, config);
            const rj = statusResponse.data.data.find(r => r.resume_id === resumeId || r.id === resumeId);

            if (rj) {
                console.log(`[Attempt ${attempts + 1}] 快评状态: ${rj.status}, 匹配分: ${rj.score}, 深度解析状态: ${rj.deep_analysis_status}, 触发来源: ${rj.deep_analysis_trigger}`);

                if (rj.deep_analysis_status === 'completed') {
                    console.log('\n✨ 测试成功: 自动深度解析已完成！');
                    return;
                }
                
                if (rj.deep_analysis_status === 'failed') {
                    console.log(`\n❌ 测试失败: 深度解析失败 - ${rj.deep_analysis_error}`);
                    return;
                }
            } else {
                console.log(`[Attempt ${attempts + 1}] 尚未找到关联记录...`);
            }
            
            await new Promise(resolve => setTimeout(resolve, interval));
            attempts++;
        }

        console.log('\n⏳ 测试超时: 状态未能在预期时间内流转到完成。');

    } catch (error) {
        console.error('\n❌ 测试执行出错:', error.response?.data || error.message);
    }
}

testAutoFlow();
