const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.local' });

async function main() {
    const prisma = new PrismaClient();

    try {
        console.log("Updating all users to use gemini-flash-latest...");
        const result = await prisma.user.updateMany({
            where: {
                geminiModel: {
                    not: "gemini-flash-latest"
                }
            },
            data: {
                geminiModel: "gemini-flash-latest"
            }
        });

        console.log(`Updated ${result.count} users to use gemini-flash-latest`);
    } catch (e) {
        console.error("Migration failed:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
