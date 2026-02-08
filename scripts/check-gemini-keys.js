const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.local' });

async function main() {
    const prisma = new PrismaClient();

    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                geminiApiKey: true,
                geminiModel: true,
                openaiApiKey: true, // Also check OpenAI key for context
            },
        });

        console.log(`Found ${users.length} users:`);
        console.log("----------------------------------------------------------------");
        console.log("| ID | Email | Gemini Key Status | Model | OpenAI Key |");
        console.log("----------------------------------------------------------------");

        users.forEach(user => {
            let keyStatus = "MISSING";
            if (user.geminiApiKey) {
                if (user.geminiApiKey.startsWith("gemini_user_")) {
                    keyStatus = "SHARED (Virt)";
                } else {
                    keyStatus = "DEDICATED (Real)";
                }
            }

            const email = user.email ? user.email.substring(0, 15) + "..." : "No Email";
            const model = user.geminiModel || "default";
            const hasOpenAI = user.openaiApiKey ? "YES" : "NO";

            console.log(`| ${user.id.substring(0, 5)}... | ${email.padEnd(18)} | ${keyStatus.padEnd(14)} | ${model.padEnd(15)} | ${hasOpenAI.padEnd(10)} |`);
        });
        console.log("----------------------------------------------------------------");

    } catch (e) {
        console.error("Error querying database:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
