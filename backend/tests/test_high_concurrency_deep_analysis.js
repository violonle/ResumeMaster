
const axios = require('axios');
const API_BASE_URL = 'http://127.0.0.1:3000/api';

async function testHighConcurrency() {
    console.log('🚀 开始高并发深度解析测试...');
    const CONCURRENCY_COUNT = 5; // 同时上传 5 份简历
    const MAX_CONCURRENT_IN_SERVICE = 3; // 服务端限制的并发数

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
            title: '并发测试职位-' + Date.now(),
            description: '测试高并发场景下的任务调度',
            status: 'active',
            enable_auto_screening: true,
            enable_deep_analysis: true,
            auto_reject_score: 30
        }, config);
        const jobId = jobResponse.data.data.id;
        console.log(`✅ 职位创建成功: ID = ${jobId}`);

        // Step 2: 并发上传简历并关联
        console.log(`📤 正在并发上传 ${CONCURRENCY_COUNT} 份简历 (略微间隔以避免 SQLite 锁)...`);
        const resumeIds = [];
        for (let i = 0; i < CONCURRENCY_COUNT; i++) {
            const resumeRes = await axios.post(`${API_BASE_URL}/resumes`, {
                file_name: `并发测试-${i}.pdf`,
                raw_text: `这是第 ${i} 份并发测试简历。我有丰富的开发经验。`,
                file_size: 1024,
                file_type: 'pdf'
            }, config);
            const resumeId = resumeRes.data.data.id;
            await axios.post(`${API_BASE_URL}/recruitment/resumes/${resumeId}/apply`, { jobId }, config);
            resumeIds.push(resumeId);
            console.log(`  - 简历 ${i+1}/${CONCURRENCY_COUNT} 已就绪 (ID: ${resumeId})`);
            await new Promise(resolve => setTimeout(resolve, 500)); // 500ms 间隔
        }
        console.log(`✅ 所有简历已上传并关联: ${resumeIds.join(', ')}`);

        // Step 3: 监控处理状态
        console.log('📊 正在监控任务调度情况...');
        let finished = false;
        let attempts = 0;
        const maxAttempts = 30; // 30 * 5s = 150s

        while (!finished && attempts < maxAttempts) {
            const statusRes = await axios.get(`${API_BASE_URL}/recruitment/candidates?jobId=${jobId}`, config);
            const candidates = statusRes.data.data;
            
            const stats = {
                none: 0,
                processing: 0,
                completed: 0,
                failed: 0
            };

            candidates.forEach(c => {
                if (resumeIds.includes(c.resume_id)) {
                    stats[c.deep_analysis_status]++;
                }
            });

            console.log(`[尝试 ${attempts + 1}/${maxAttempts}] 状态分布: ` +
                `等待中: ${stats.none}, 处理中: ${stats.processing}, 已完成: ${stats.completed}, 失败: ${stats.failed}`);

            // 验证并发限制
            if (stats.processing > MAX_CONCURRENT_IN_SERVICE) {
                console.error(`❌ 严重错误: 正在处理的任务数 (${stats.processing}) 超过了限制 (${MAX_CONCURRENT_IN_SERVICE})!`);
                process.exit(1);
            }

            if (stats.completed + stats.failed === CONCURRENCY_COUNT) {
                finished = true;
                console.log('\n✨✨ 高并发压力测试通过！所有任务均已处理，且符合并发限制。 ✨✨');
            } else {
                await new Promise(resolve => setTimeout(resolve, 5000));
                attempts++;
            }
        }

        if (!finished) {
            console.error('❌ 测试超时，部分任务未完成');
            process.exit(1);
        }

    } catch (error) {
        console.error('❌ 测试过程中发生错误:', error.response?.data || error.message);
        process.exit(1);
    }
}

testHighConcurrency();
