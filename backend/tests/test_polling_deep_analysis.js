
const axios = require('axios');
const API_BASE_URL = 'http://127.0.0.1:3000/api';

async function testPollingFlow() {
    console.log('🚀 开始测试深度解析轮询机制...');

    try {
        // Step 0: 登录
        const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
            username: 'masteradmin',
            password: 'Longkou7'
        });
        const token = loginResponse.data.data.token;
        const config = { headers: { Authorization: `Bearer ${token}` } };
        console.log('✅ 登录成功');

        // Step 1: 创建职位
        const jobResponse = await axios.post(`${API_BASE_URL}/jobs`, {
            title: '轮询测试职位-' + Date.now(),
            description: '测试轮询机制的职位描述',
            status: 'active',
            enable_auto_screening: true,
            enable_deep_analysis: true,
            auto_reject_score: 50
        }, config);
        const jobId = jobResponse.data.data.id;
        console.log(`✅ 职位创建成功: ID = ${jobId}`);

        // Step 2: 创建简历并关联
        const resumeResponse = await axios.post(`${API_BASE_URL}/resumes`, {
            file_name: '轮询测试候选人.pdf',
            raw_text: '我有丰富的开发经验，精通各种技术。',
            file_size: 1024,
            file_type: 'pdf'
        }, config);
        const resumeId = resumeResponse.data.data.id;
        
        console.log('🔗 关联简历并等待初始处理完成...');
        await axios.post(`${API_BASE_URL}/recruitment/resumes/${resumeId}/apply`, { jobId }, config);

        // 等待几秒让初始的即时触发完成（或者我们后面手动改回状态）
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Step 3: 模拟“遗漏”或“挂起”状态
        console.log('🔧 模拟简历处于“待解析”状态 (deep_analysis_status = "none")...');
        
        const updateCmd = `node -e "const { ResumeJob } = require('./backend/models'); ResumeJob.update({ deep_analysis_status: 'none', deep_analysis_trigger: 'manual' }, { where: { resume_id: ${resumeId}, job_id: ${jobId} } }).then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); })"`;
        const { execSync } = require('child_process');
        try {
            console.log('正在执行状态更新命令...');
            execSync(updateCmd, { cwd: process.cwd() });
            console.log('✅ 数据库状态已重置为 none');
        } catch (e) {
            console.error('❌ 修改数据库失败:', e.message);
            // 尝试另一种路径
            try {
                const updateCmdBackend = `node -e "const { ResumeJob } = require('./models'); ResumeJob.update({ deep_analysis_status: 'none', deep_analysis_trigger: 'manual' }, { where: { resume_id: ${resumeId}, job_id: ${jobId} } }).then(() => process.exit(0))"`;
                execSync(updateCmdBackend, { cwd: require('path').join(process.cwd(), 'backend') });
                console.log('✅ 数据库状态已重置为 none (通过 backend 目录)');
            } catch (e2) {
                console.error('❌ 再次尝试修改数据库失败:', e2.message);
            }
        }

        // Step 4: 触发轮询
        console.log('⏰ 触发深度解析服务轮询...');
        try {
            // 后端现在应该立即返回，不等待任务完成
            await axios.post(`${API_BASE_URL}/ai/trigger-polling`, {}, {
                ...config,
                timeout: 5000 
            });
            console.log('✅ 轮询指令发送成功');
        } catch (error) {
            if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                console.log('⚠️ 轮询触发超时，但可能已在后台启动，继续检查状态...');
            } else {
                console.error('❌ 触发轮询失败:', error.message);
                throw error;
            }
        }
        
        console.log('等待轮询处理 (最多 120 秒)...');
        let attempts = 0;
        const maxAttempts = 24; // 24 * 5s = 120s
        
        while (attempts < maxAttempts) {
            // 检查状态
            const statusRes = await axios.get(`${API_BASE_URL}/recruitment/candidates?resume_id=${resumeId}`, config);
            const rj = statusRes.data.data.find(r => r.job_id === jobId);
            
            if (rj) {
                console.log(`[尝试 ${attempts + 1}/${maxAttempts}] 当前状态: ${rj.deep_analysis_status}, 触发源: ${rj.deep_analysis_trigger}`);
                
                if (rj.deep_analysis_status === 'completed') {
                    console.log('\n✨✨ 轮询触发验证通过！深度解析已由 auto_polling 完成 ✨✨');
                    return;
                } else if (rj.deep_analysis_status === 'failed') {
                    console.error('❌ 深度解析在轮询处理中失败');
                    process.exit(1);
                }
            }
            
            await new Promise(resolve => setTimeout(resolve, 5000));
            attempts++;
        }
        
        throw new Error('轮询处理超时，状态未更新为 completed');

    } catch (error) {
        console.error('❌ 测试出错:', error.response?.data || error.message);
        process.exit(1);
    }
}

testPollingFlow();
