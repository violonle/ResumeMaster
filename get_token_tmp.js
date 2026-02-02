const jwt = require('jsonwebtoken');
const { jwtSecret } = require('./backend/config/auth');

const secret = process.env.JWT_SECRET || jwtSecret;
const token = jwt.sign(
  { id: 1, username: 'masteradmin', role: 'admin', permissions: ['*'] },
  secret,
  { expiresIn: '1h' }
);

console.log(token);
