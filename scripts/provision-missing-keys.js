const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.local' });
const { provisionGeminiKey } = require('../lib/gemini-provisioner');

async function main() {
    const prisma = new PrismaClient();

    try {
        // Find users without Gemini key
        const users = await prisma.user.findMany({
            where: {
                geminiApiKey: null
            }
        });

        console.log(`Found ${users.length} users without Gemini API key.`);

        for (const user of users) {
            console.log(`Provisioning key for user ${user.id} (${user.email})...`);
            try {
                const key = await provisionGeminiKey(user.id, user.email);

                await prisma.user.update({
                    where: { id: user.id },
                    data: { geminiApiKey: key }
                });

                console.log(`Successfully provisioned key for user ${user.id}`);
            } catch (error) {
                console.error(`Failed to provision key for user ${user.id}:`, error);
            }
        }

        console.log('Migration completed.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
