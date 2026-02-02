
console.log('Script started');
try {
    const jwt = require('jsonwebtoken');
    console.log('JWT required');
    const secret = 'superresumemaster_dev_secret_2024';
    const payload = { id: 2, username: '18605355138', role: 'user' };
    const token = jwt.sign(payload, secret, { expiresIn: '24h' });
    console.log('Token:', token);
} catch (e) {
    console.error('Error:', e);
}
