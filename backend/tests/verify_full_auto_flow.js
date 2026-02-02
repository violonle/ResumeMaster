
const axios = require('axios');

// 配置
const BASE_URL = 'http://localhost:3000/api';

let token = '';
let jobId = '';
let resumeId = '';

async function runFullFlowTest() {
    console.log('🚀 开始全自动流程验证测试 (快评 -> 深度解析)...');

    try {
        // 1. 注册/登录获取 Token
        console.log('1. 正在获取认证令牌...');
        try {
            const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
                username: 'masteradmin',
                password: 'Longkou7'
            });
            token = loginRes.data.data.token;
            console.log('✅ 登录成功');
        } catch (e) {
            console.log('❌ 登录失败');
            throw e;
        }

        const headers = { 'Authorization': `Bearer ${token}` };

        // 2. 创建一个开启了“自动快评”和“自动深度解析”的职位
        console.log('2. 创建测试职位 (开启自动快评 & 自动深度解析)...');
        const jobRes = await axios.post(`${BASE_URL}/jobs`, {
            title: '全自动流程测试职位',
            description: '这是一个用于测试自动快评和自动深度解析联动功能的职位。',
            requirements: '精通 Node.js 和 React，有 AI 项目经验。',
            status: 'active',
            enable_auto_screening: true,
            auto_reject_score: 50,
            enable_deep_analysis: true
        }, { headers });
        jobId = jobRes.data.data.id;
        console.log(`✅ 职位创建成功: ID ${jobId}`);

        // 3. 模拟上传简历
        console.log('3. 模拟上传简历...');
        const resumeRes = await axios.post(`${BASE_URL}/resumes`, {
            file_name: '自动测试候选人.pdf',
            file_size: 1024,
            file_type: 'pdf',
            raw_text: '我有5年 Node.js 开发经验，熟悉全栈开发，做过很多 AI 相关的产品。'
        }, { headers });
        resumeId = resumeRes.data.data.id;
        console.log(`✅ 简历创建成功: ID ${resumeId}`);

        // 4. 关联职位并触发自动流程
        console.log('4. 关联职位并触发自动流程...');
        await axios.post(`${BASE_URL}/recruitment/resumes/${resumeId}/apply`, {
            jobId: jobId
        }, { headers });
        console.log(`✅ 职位关联成功: 简历 ${resumeId} -> 职位 ${jobId}`);

        // 5. 等待自动快评完成
        console.log('5. 等待自动快评完成 (状态应变为 screening 且有分数)...');
        let qualified = false;
        for (let i = 0; i < 20; i++) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            const statusRes = await axios.get(`${BASE_URL}/recruitment/candidates?resume_id=${resumeId}`, { headers });
            const rj = statusRes.data.data.find(r => r.job_id === jobId);
            
            if (rj && rj.match_score > 0) {
                console.log(`✅ 自动快评完成! 分数: ${rj.match_score}, 招聘状态: ${rj.status}`);
                if (rj.match_score >= 50) qualified = true;
                break;
            }
            console.log(`   等待中... (${i+1}/20)`);
        }

        if (!qualified) {
            throw new Error('自动快评未通过或未在预期时间内完成');
        }

        // 6. 验证自动深度解析是否被触发
        console.log('6. 验证自动深度解析联动 (状态应变为 processing 或 completed)...');
        let deepCompleted = false;
        for (let i = 0; i < 20; i++) {
            const statusRes = await axios.get(`${BASE_URL}/recruitment/candidates?resume_id=${resumeId}`, { headers });
            const rj = statusRes.data.data.find(r => r.job_id === jobId);
            
            console.log(`   [${new Date().toLocaleTimeString()}] 深度解析状态: ${rj.deep_analysis_status}`);
            
            if (rj.deep_analysis_status === 'completed') {
                deepCompleted = true;
                console.log('✅ 自动深度解析联动验证成功!');
                break;
            } else if (rj.deep_analysis_status === 'failed') {
                throw new Error(`深度解析失败: ${rj.deep_analysis_error}`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        if (deepCompleted) {
            console.log('\n✨✨ 全流程自动化验证通过！ ✨✨');
            console.log('1. 简历上传 -> 自动触发快评 [OK]');
            console.log('2. 快评合格 -> 自动触发深度解析 [OK]');
            console.log('3. 深度解析完成 -> 状态更新 [OK]');
        } else {
            console.log('\n❌ 深度解析超时，请检查后端日志。');
        }

    } catch (error) {
        console.error('\n❌ 测试流程出错:');
        if (error.response) {
            console.error(`API 错误 (${error.response.status}):`, JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.message);
        }
    }
}

runFullFlowTest();
