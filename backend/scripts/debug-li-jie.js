const axios = require('axios');

async function main() {
  const base = 'http://localhost:3000/api';
  const loginRes = await axios.post(`${base}/auth/login`, {
    username: 'masteradmin',
    password: 'Longkou7'
  });

  const token = loginRes.data && loginRes.data.data && loginRes.data.data.token;
  if (!token) throw new Error('missing token');

  const api = axios.create({
    baseURL: base,
    headers: { Authorization: `Bearer ${token}` }
  });

  const listRes = await api.get('/library/resumes?is_talent_pool=true&page=1&pageSize=200');
  const list = (listRes.data && listRes.data.data) || [];

  const matches = list.filter(r => String(r.name || '').trim() === '李杰');
  if (matches.length === 0) {
    console.log('未找到候选人：李杰');
    process.exit(0);
  }

  console.log('李杰匹配数量:', matches.length);

  for (const liJie of matches) {
    console.log('\n---');
    console.log('resumeId:', liJie.id);
    const resultRes = await api.get(`/ai/result/${liJie.id}`);
    const data = resultRes.data && resultRes.data.data;
    if (!data) {
      console.log('未找到分析结果');
      continue;
    }

    console.log('overall_score:', data.overall_score);
    console.log('dimensions:', data.dimensions);
    console.log('ai/result.report:', data.report);

    const dims = data.dimensions || {};
    const zeros = Object.values(dims).filter(v => Number(v || 0) === 0).length;
    console.log('dimensionZeroCount:', zeros);

    const da = data.detailed_analysis || {};
    const evalReport = da.evaluation_report || null;
    console.log('detailed_analysis keys:', Object.keys(da || {}));
    console.log('evaluation_report type:', typeof evalReport);
    if (typeof evalReport === 'object' && evalReport) {
      console.log('evaluation_report keys:', Object.keys(evalReport));
      console.log('evaluation_report.summary:', evalReport.summary);
      console.log('evaluation_report.dimensions:', evalReport.dimensions);
      console.log('evaluation_report.scores_percent:', evalReport.scores_percent);
    }

    const latestRes = await api.get(`/analysis/latest/${liJie.id}`);
    const latest = latestRes.data && latestRes.data.data;
    console.log('analysis/latest.dimensions:', latest && latest.dimensions);
    console.log('analysis/latest.report:', latest && latest.report);
  }
}

main().catch(e => {
  console.error('debug failed:', e.response && e.response.status, (e.response && e.response.data) || e.message);
  process.exit(1);
});
