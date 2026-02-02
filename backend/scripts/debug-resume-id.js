const axios = require('axios');

async function main() {
  const resumeId = process.argv[2] ? String(process.argv[2]) : null;
  if (!resumeId) {
    console.log('Usage: node scripts/debug-resume-id.js <resumeId>');
    process.exit(1);
  }

  const base = 'http://localhost:3000/api';
  const login = await axios.post(`${base}/auth/login`, { username: 'masteradmin', password: 'Longkou7' });
  const token = login.data && login.data.data && login.data.data.token;
  const api = axios.create({ baseURL: base, headers: { Authorization: `Bearer ${token}` } });

  const latest = (await api.get(`/analysis/latest/${resumeId}`)).data.data;
  const direct = (await api.get(`/ai/result/${resumeId}`)).data.data;

  const summarizeReport = (r) => {
    if (!r) return null;
    if (typeof r === 'string') return r.slice(0, 60);
    if (typeof r === 'object') return Object.keys(r);
    return typeof r;
  };

  console.log('resumeId:', resumeId);
  console.log('latest.id:', latest && latest.id);
  console.log('latest.overall_score:', latest && latest.overall_score);
  console.log('latest.dimensions:', latest && latest.dimensions);
  console.log('latest.report:', summarizeReport(latest && latest.report));

  console.log('direct.id:', direct && direct.id);
  console.log('direct.overall_score:', direct && direct.overall_score);
  console.log('direct.dimensions:', direct && direct.dimensions);
  console.log('direct.report:', summarizeReport(direct && direct.report));
}

main().catch(e => {
  console.error('debug failed:', (e.response && e.response.status) || null, (e.response && e.response.data) || e.message);
  process.exit(1);
});

