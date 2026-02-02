const axios = require('axios');

async function main() {
  const base = 'http://localhost:3000/api';
  const login = await axios.post(`${base}/auth/login`, { username: 'masteradmin', password: 'Longkou7' });
  const token = login.data && login.data.data && login.data.data.token;
  const api = axios.create({ baseURL: base, headers: { Authorization: `Bearer ${token}` } });

  const listRes = await api.get('/library/resumes?is_talent_pool=true&page=1&pageSize=50');
  const list = (listRes.data && listRes.data.data) || [];
  const ids = list.map(x => x.id).slice(0, 10);

  for (const rid of ids) {
    const latest = (await api.get(`/analysis/latest/${rid}`)).data.data;
    const direct = (await api.get(`/ai/result/${rid}`)).data.data;
    const latestReport = latest ? latest.report : null;
    const directReport = direct ? direct.report : null;
    const latestEmpty = !latestReport || latestReport === '暂无报告' || latestReport === '暂无详细报告内容' || (typeof latestReport === 'object' && Object.keys(latestReport).length === 0);
    const directEmpty = !directReport || directReport === '暂无报告' || directReport === '暂无详细报告内容' || (typeof directReport === 'object' && Object.keys(directReport).length === 0);
    console.log(
      `resume:${rid}\tlatestId:${latest && latest.id}\tdirectId:${direct && direct.id}` +
      `\tlatestEmpty:${latestEmpty}\tdirectEmpty:${directEmpty}`
    );
  }
}

main().catch(e => {
  console.error('verify failed:', (e.response && e.response.status) || null, (e.response && e.response.data) || e.message);
  process.exit(1);
});

