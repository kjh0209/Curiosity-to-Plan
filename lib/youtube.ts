// YouTube Data API v3 integration
// Supports multiple API keys for quota distribution
// Each key is from a different Google Cloud project (10,000 units/day each)
// Set YOUTUBE_API_KEYS=key1,key2,key3 in .env

interface YouTubeVideo {
    videoId: string;
    title: string;
    channelTitle: string;
    thumbnail: string;
    viewCount?: string;
    duration?: string;       // Formatted duration like "5:30"
    durationMinutes?: number; // Duration in minutes for time tracking
    url: string;
}

interface YouTubeSearchResult {
    videos: YouTubeVideo[];
    error?: string;
}

type SortOrder = "relevance" | "viewCount" | "rating" | "date";

// --- YouTube Key Pool ---
interface YTKeyState {
    key: string;
    cooldownUntil: number;
}

const ytKeys: YTKeyState[] = [];

function loadYTKeys() {
    if (ytKeys.length > 0) return;

    const multi = process.env.YOUTUBE_API_KEYS;
    if (multi) {
        for (const k of multi.split(",").map((s) => s.trim()).filter(Boolean)) {
            ytKeys.push({ key: k, cooldownUntil: 0 });
        }
    }
    if (ytKeys.length === 0) {
        const single = process.env.YOUTUBE_API_KEY;
        if (single) {
            ytKeys.push({ key: single, cooldownUntil: 0 });
        }
    }
    if (ytKeys.length > 0) {
        console.log(`YouTube key pool: ${ytKeys.length} key(s)`);
    }
}

function getAvailableYTKey(): string | null {
    loadYTKeys();
    if (ytKeys.length === 0) return null;

    const now = Date.now();
    // Find first non-cooldown key
    for (const ks of ytKeys) {
        if (ks.cooldownUntil <= now) return ks.key;
    }
    // All in cooldown — return the one expiring soonest
    let best = ytKeys[0];
    for (const ks of ytKeys) {
        if (ks.cooldownUntil < best.cooldownUntil) best = ks;
    }
    return best.key;
}

function getNextYTKey(failedKey: string): string | null {
    const now = Date.now();
    const idx = ytKeys.findIndex((k) => k.key === failedKey);
    for (let i = 1; i < ytKeys.length; i++) {
        const next = ytKeys[(idx + i) % ytKeys.length];
        if (next.cooldownUntil <= now) return next.key;
    }
    return null;
}

function markYTKeyExhausted(key: string) {
    const ks = ytKeys.find((k) => k.key === key);
    if (ks) {
        // YouTube daily quota resets at midnight Pacific Time
        // Set cooldown for 1 hour (keys will be retried periodically)
        ks.cooldownUntil = Date.now() + 60 * 60 * 1000;
        console.warn(`YouTube key ...${key.slice(-6)} quota exhausted, cooldown 1h`);
    }
}

function markYTKeySuccess(key: string) {
    const ks = ytKeys.find((k) => k.key === key);
    if (ks) ks.cooldownUntil = 0;
}

// --- Search with Key Rotation ---

/**
 * Search YouTube for videos and return the top result
 * @param query - Search query
 * @param language - Language code (en, ko, ja, etc.)
 * @param order - Sort order (relevance, viewCount, rating, date)
 * @param maxResults - Number of results to return
 */
export async function searchYouTubeVideos(
    query: string,
    language: string = "en",
    order: SortOrder = "relevance",
    maxResults: number = 3,
    maxDurationMinutes?: number  // Filter out videos longer than this
): Promise<YouTubeSearchResult> {
    loadYTKeys();

    if (ytKeys.length === 0) {
        console.warn("No YouTube API keys configured, returning search URL fallback");
        return makeFallback(query, "API key not configured");
    }

    let currentKey = getAvailableYTKey();

    for (let attempt = 0; attempt < ytKeys.length; attempt++) {
        if (!currentKey) return makeFallback(query, "All YouTube keys exhausted");

        try {
            const result = await doYouTubeSearch(currentKey, query, language, order, maxResults, maxDurationMinutes);
            markYTKeySuccess(currentKey);
            return result;
        } catch (error: any) {
            // YouTube returns 403 for quota exceeded
            if (error.status === 403 || error.message?.includes("quota") || error.message?.includes("Quota")) {
                markYTKeyExhausted(currentKey);
                const nextKey = getNextYTKey(currentKey);
                if (nextKey) {
                    console.log(`YouTube 403 on ...${currentKey.slice(-6)}, rotating to ...${nextKey.slice(-6)}`);
                    currentKey = nextKey;
                    continue;
                }
            }
            console.error("YouTube search error:", error);
            return makeFallback(query, String(error));
        }
    }

    return makeFallback(query, "All YouTube keys exhausted");
}

async function doYouTubeSearch(
    apiKey: string,
    query: string,
    language: string,
    order: SortOrder,
    maxResults: number,
    maxDurationMinutes?: number
): Promise<YouTubeSearchResult> {
    const regionMap: Record<string, string> = {
        ko: "KR", ja: "JP", zh: "CN", es: "ES", fr: "FR", de: "DE", en: "US",
    };
    const regionCode = regionMap[language] || "US";

    // Search for videos
    const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
    searchUrl.searchParams.set("part", "snippet");
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("type", "video");
    searchUrl.searchParams.set("order", order);
    searchUrl.searchParams.set("maxResults", maxResults.toString());
    searchUrl.searchParams.set("regionCode", regionCode);
    searchUrl.searchParams.set("relevanceLanguage", language);
    searchUrl.searchParams.set("key", apiKey);

    const searchResponse = await fetch(searchUrl.toString());

    if (!searchResponse.ok) {
        const errorData = await searchResponse.json();
        const err: any = new Error(errorData.error?.message || "YouTube API error");
        err.status = searchResponse.status;
        throw err;
    }

    const searchData = await searchResponse.json();

    if (!searchData.items || searchData.items.length === 0) {
        return { videos: [], error: "No videos found" };
    }

    // Get video statistics and duration
    const videoIds = searchData.items.map((item: any) => item.id.videoId).join(",");
    const statsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
    statsUrl.searchParams.set("part", "statistics,contentDetails");
    statsUrl.searchParams.set("id", videoIds);
    statsUrl.searchParams.set("key", apiKey);

    const statsResponse = await fetch(statsUrl.toString());
    const statsData = statsResponse.ok ? await statsResponse.json() : { items: [] };

    // Build video objects
    let videos: YouTubeVideo[] = searchData.items.map((item: any, idx: number) => {
        const stats = statsData.items?.[idx]?.statistics || {};
        const contentDetails = statsData.items?.[idx]?.contentDetails || {};
        const { duration, durationMinutes } = parseDuration(contentDetails.duration);

        return {
            videoId: item.id.videoId,
            title: item.snippet.title,
            channelTitle: item.snippet.channelTitle,
            thumbnail: item.snippet.thumbnails?.medium?.url || "",
            viewCount: stats.viewCount ? formatViewCount(parseInt(stats.viewCount)) : undefined,
            duration,
            durationMinutes,
            url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
        };
    });

    // Filter by max duration if specified
    if (maxDurationMinutes && maxDurationMinutes > 0) {
        const originalCount = videos.length;
        videos = videos.filter(v => !v.durationMinutes || v.durationMinutes <= maxDurationMinutes);
        console.log(`[YouTube] Filtered ${originalCount - videos.length} videos exceeding ${maxDurationMinutes} min`);
    }

    return { videos };
}

function makeFallback(query: string, error: string): YouTubeSearchResult {
    return {
        videos: [{
            videoId: "",
            title: `Search: ${query}`,
            channelTitle: "YouTube",
            thumbnail: "",
            url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=CAMSAhAB`,
        }],
        error,
    };
}

/**
 * Get a single best video for a topic
 */
export async function getBestYouTubeVideo(
    topic: string,
    interest: string,
    language: string = "en",
    sortBy: SortOrder = "relevance"
): Promise<YouTubeVideo | null> {
    const query = `${topic} ${interest} tutorial`;
    const result = await searchYouTubeVideos(query, language, sortBy, 1);
    return result.videos[0] || null;
}

function formatViewCount(count: number): string {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M views`;
    if (count >= 1000) return `${(count / 1000).toFixed(0)}K views`;
    return `${count} views`;
}

/**
 * Parse YouTube ISO 8601 duration format (PT#H#M#S) to readable string and minutes
 */
function parseDuration(isoDuration: string | undefined): { duration?: string; durationMinutes?: number } {
    if (!isoDuration) return {};

    // Parse ISO 8601 duration: PT1H30M45S
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return {};

    const hours = parseInt(match[1] || "0");
    const minutes = parseInt(match[2] || "0");
    const seconds = parseInt(match[3] || "0");

    const totalMinutes = hours * 60 + minutes + seconds / 60;

    let duration: string;
    if (hours > 0) {
        duration = `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    } else {
        duration = `${minutes}:${seconds.toString().padStart(2, "0")}`;
    }

    return { duration, durationMinutes: Math.round(totalMinutes * 10) / 10 };
}
