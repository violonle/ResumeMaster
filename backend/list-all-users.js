const { User } = require('./models');

async function listAllUsers() {
    try {
        const users = await User.findAll();
        console.log('--- Total Users:', users.length);
        users.forEach(u => {
            console.log(`ID: ${u.id}, Username: "${u.username}", Phone: "${u.phone}", Email: "${u.email}", Role: ${u.role}, Active: ${u.is_active}`);
        });
    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

listAllUsers();
