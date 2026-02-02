const { User } = require('./models');
const bcrypt = require('bcryptjs');

async function testPasswordCases() {
    try {
        const phone = '18605355138';
        const user = await User.findOne({ where: { phone } });
        if (!user) {
            console.log('User not found');
            return;
        }

        console.log('Testing user:', user.username);
        const test1 = await bcrypt.compare('longkou7', user.password_hash);
        const test2 = await bcrypt.compare('Longkou7', user.password_hash);
        
        console.log('Match with "longkou7" (lowercase):', test1);
        console.log('Match with "Longkou7" (uppercase L):', test2);

        // If neither match what the user is trying, let's fix it to Longkou7 as they mentioned it now
        if (!test2) {
            const hash = await bcrypt.hash('Longkou7', 10);
            await user.update({ password_hash: hash });
            console.log('Password updated to "Longkou7" (uppercase L)');
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

testPasswordCases();
