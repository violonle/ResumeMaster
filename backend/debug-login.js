const { User } = require('./models');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');

async function debugLogin() {
    try {
        const identifier = '18605355138';
        const password = 'Longkou7';
        
        console.log('--- Searching for users matching:', identifier);
        const users = await User.findAll({
            where: {
                [Op.or]: [
                    { username: identifier },
                    { email: identifier },
                    { phone: identifier }
                ]
            }
        });
        
        console.log(`Found ${users.length} user(s):`);
        for (const user of users) {
            const isMatch = await bcrypt.compare(password, user.password_hash);
            console.log(`- ID: ${user.id}, Username: "${user.username}", Phone: "${user.phone}", Role: ${user.role}, Password Match: ${isMatch}`);
        }
        
        if (users.length === 0) {
            console.log('No user found at all with that identifier.');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

debugLogin();
