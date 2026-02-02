
const jwt = require('jsonwebtoken');
const secret = 'superresumemaster_dev_secret_2024';
const payload = { id: 2, username: '18605355138', role: 'user' };
const token = jwt.sign(payload, secret, { expiresIn: '24h' });
console.log(token);
