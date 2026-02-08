const { GoogleGenerativeAI } = require("@google/generative-ai");
const { PrismaClient } = require("@prisma/client");
require('dotenv').config({ path: '.env.local' });

async function main() {
    const prisma = new PrismaClient();
    const user = await prisma.user.findFirst({
        where: { NOT: { geminiApiKey: null } }
    });

    if (!user || !user.geminiApiKey) {
        console.log("No key found");
        return;
    }

    const key = user.geminiApiKey.startsWith("gemini_user_")
        ? process.env.GEMINI_API_KEY
        : user.geminiApiKey;

    console.log("Using Key:", key.substring(0, 10));

    const genAI = new GoogleGenerativeAI(key);
    // Try gemini-1.5-flash
    const modelName = "gemini-1.5-flash"; // Standard name, maybe v1beta supports it now?
    // If not, try "gemini-flash-latest"

    console.log(`Testing model: ${modelName}`);
    const model = genAI.getGenerativeModel({ model: modelName });

    try {
        const result = await model.generateContent("Hello?");
        console.log("Success:", result.response.text());
    } catch (e) {
        console.log("Failed with gemini-1.5-flash. Trying gemini-flash-latest...");
        try {
            const model2 = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
            const result2 = await model2.generateContent("Hello?");
            console.log("Success with gemini-flash-latest:", result2.response.text());
        } catch (e2) {
            console.error("All failed.");
            console.error(e2.message);
        }
    } finally {
        await prisma.$disconnect();
    }
}

main();
