const { User } = require('./models');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '.env') });

async function resetPasswords() {
  try {
    const usersToReset = ['masteradmin', 'admin'];
    const newPassword = 'admin123';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    for (const username of usersToReset) {
      const user = await User.findOne({ where: { username } });
      if (user) {
        user.password_hash = hashedPassword;
        await user.save();
        console.log(`[SUCCESS] Password for user "${username}" has been reset to: ${newPassword}`);
      } else {
        console.log(`[WARNING] User "${username}" not found.`);
      }
    }
  } catch (error) {
    console.error('[ERROR] Failed to reset passwords:', error);
  } finally {
    process.exit();
  }
}

resetPasswords();
