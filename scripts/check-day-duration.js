const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.local' });

async function main() {
    const prisma = new PrismaClient();

    try {
        const dayPlans = await prisma.dayPlan.findMany({
            select: {
                id: true,
                dayNumber: true,
                resources: true
            }
        });

        let totalYoutube = 0;
        let missingDuration = 0;

        for (const plan of dayPlans) {
            if (!plan.resources) continue;

            try {
                const resources = JSON.parse(plan.resources);
                for (const res of resources) {
                    if (res.type === 'youtube') {
                        totalYoutube++;
                        if (!res.duration) {
                            missingDuration++;
                        }
                    }
                }
            } catch (e) {
                console.error(`Error parsing resources for DayPlan ${plan.id}:`, e);
            }
        }

        console.log(`Total YouTube Resources: ${totalYoutube}`);
        console.log(`Missing Duration: ${missingDuration}`);

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
