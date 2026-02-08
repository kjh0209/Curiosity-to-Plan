const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.local' });

async function main() {
    const prisma = new PrismaClient();

    try {
        const user = await prisma.user.findFirst();
        if (user) {
            const key = user.geminiApiKey;
            if (!key) {
                console.log('Gemini API Key: null');
            } else if (key.startsWith('gemini_user_')) {
                console.log('Gemini API Key: Placeholder (Shared Key Identifier)');
                console.log('Key Prefix:', key.substring(0, 20) + '...');
            } else {
                console.log('Gemini API Key: Real Key (Dedicated)');
                console.log('Key Prefix:', key.substring(0, 5) + '...');
            }
        } else {
            console.log('No user found');
        }
    } finally {
        await prisma.$disconnect();
    }
}

main();
