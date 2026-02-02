
const jwt = require('jsonwebtoken');
require('dotenv').config();

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NiwiZW1haWwiOiJ0ZXN0XzE3Njk5Mzk5NzQzMzRAZXhhbXBsZS5jb20iLCJyb2xlIjoidXNlciIsImlhdCI6MTc2OTkzOTk3NCwiZXhwIjoxNzcwMDI2Mzc0fQ.334W_fiCJjDINv03Y-RAsRzJlq1G0fyV-c9KomdaRd4\n'.trim();
const secret = process.env.JWT_SECRET || 'superresume-secret-key-2024'; // from config/auth.js

console.log('Token to verify:', token);
console.log('Secret used:', secret);

try {
  const decoded = jwt.verify(token, secret);
  console.log('✓ Success:', decoded);
} catch (err) {
  console.error('✗ Failed:', err.message);
}
