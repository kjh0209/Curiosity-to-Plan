const { PrismaClient } = require('@prisma/client');
const { google } = require('googleapis');
require('dotenv').config({ path: '.env.local' });

const youtube = google.youtube({
    version: 'v3',
    auth: process.env.YOUTUBE_API_KEY
});

function parseDuration(isoDuration) {
    if (!isoDuration) return {};
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return {};

    const hours = parseInt(match[1] || "0");
    const minutes = parseInt(match[2] || "0");
    const seconds = parseInt(match[3] || "0");

    const totalMinutes = hours * 60 + minutes + seconds / 60;

    let duration;
    if (hours > 0) {
        duration = `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    } else {
        duration = `${minutes}:${seconds.toString().padStart(2, "0")}`;
    }

    return { duration, durationMinutes: Math.round(totalMinutes * 10) / 10 };
}

async function main() {
    const prisma = new PrismaClient();

    try {
        const dayPlans = await prisma.dayPlan.findMany();
        let updatedCount = 0;

        // 1. Collect all video IDs
        const videoIdMap = new Map(); // videoId -> [ { planId, resourceIndex } ]

        for (const plan of dayPlans) {
            if (!plan.resources) continue;
            try {
                const resources = JSON.parse(plan.resources);
                resources.forEach((res, idx) => {
                    if (res.type === 'youtube' && !res.duration) {
                        // Extract Video ID
                        let videoId = null;
                        try {
                            const url = new URL(res.url);
                            videoId = url.searchParams.get("v");
                        } catch (e) { }

                        if (videoId) {
                            if (!videoIdMap.has(videoId)) {
                                videoIdMap.set(videoId, []);
                            }
                            videoIdMap.get(videoId).push({ planId: plan.id, resourceIndex: idx });
                        }
                    }
                });
            } catch (e) {
                console.error(`Error parsing resources for DayPlan ${plan.id}`);
            }
        }

        const allVideoIds = Array.from(videoIdMap.keys());
        console.log(`Found ${allVideoIds.length} unique videos to fetch.`);

        if (allVideoIds.length === 0) {
            console.log("No videos to update.");
            return;
        }

        // 2. Fetch details in batches of 50
        const videoDetails = new Map(); // videoId -> { duration, durationMinutes }

        for (let i = 0; i < allVideoIds.length; i += 50) {
            const batchIds = allVideoIds.slice(i, i + 50);
            console.log(`Fetching batch ${i} - ${i + 50}...`);

            try {
                const response = await youtube.videos.list({
                    part: 'contentDetails',
                    id: batchIds.join(',')
                });

                for (const item of response.data.items) {
                    const { duration, durationMinutes } = parseDuration(item.contentDetails.duration);
                    videoDetails.set(item.id, { duration, durationMinutes });
                }
            } catch (e) {
                console.error("Error fetching YouTube batch:", e.message);
            }
        }

        // 3. Update DayPlans
        for (const plan of dayPlans) {
            if (!plan.resources) continue;
            let modified = false;
            let resources = [];
            try {
                resources = JSON.parse(plan.resources);
            } catch (e) { continue; }

            for (let i = 0; i < resources.length; i++) {
                const res = resources[i];
                if (res.type === 'youtube' && !res.duration) {
                    let videoId = null;
                    try {
                        const url = new URL(res.url);
                        videoId = url.searchParams.get("v");
                    } catch (e) { }

                    if (videoId && videoDetails.has(videoId)) {
                        const details = videoDetails.get(videoId);
                        resources[i] = { ...res, ...details };
                        modified = true;
                    }
                }
            }

            if (modified) {
                await prisma.dayPlan.update({
                    where: { id: plan.id },
                    data: { resources: JSON.stringify(resources) }
                });
                updatedCount++;
                process.stdout.write(".");
            }
        }

        console.log(`\nUpdated ${updatedCount} DayPlans.`);

    } catch (e) {
        console.error("Migration failed:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
