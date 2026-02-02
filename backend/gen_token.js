const jwt = require('jsonwebtoken');
const secret = 'superresumemaster_dev_secret_2024';
const payload = { id: 1, username: 'masteradmin', role: 'admin', permissions: ['*'] };
const token = jwt.sign(payload, secret, { expiresIn: '24h' });
console.log(token);
